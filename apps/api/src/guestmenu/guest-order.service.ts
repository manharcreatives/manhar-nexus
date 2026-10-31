import { Injectable } from '@nestjs/common';
import {
  GuestOrderDecision,
  InvoiceStatus,
  PaymentStatus,
  Prisma,
  QrOrderingMode,
  ServiceLineStatus,
  ServiceRequestSource,
  ServiceRequestStatus,
  WaiterCallReason,
  WaiterCallStatus,
  type GuestMenuToken,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ValidationError } from '../common/errors';
import type { TenantScope } from '../common/tenant-scope';
import { AuditService } from '../core/audit/audit.service';
import { NumberingService } from '../core/numbering/numbering.service';
import { SettingsService } from '../core/settings/settings.service';
import { RealtimeBus } from '../realtime/realtime.bus';
import { billReference } from '../checkout/bill-view/bill-reference';
import { toBillTaxLines } from '../checkout/bill-view/tax-lines';
import { CHECKOUT_SETTINGS_NAMESPACE, UPI_PAYEE_NAME_KEY, UPI_VPA_KEY } from '../checkout/checkout.settings';
import { buildUpiUri, cleanTransactionRef, isValidVpa } from '../checkout/upi/upi-uri';
import { LINE_CONFIG_ERROR_PREFIX, OrderService, type LineSnapshot } from '../restaurant/order/order.service';
import type { AuditRowLike } from '../restaurant/timeline/order-timeline.util';
import { caps } from './guestmenu.config';
import type { PlaceOrderDto, WaiterDto } from './guestmenu.dto';
import {
  BillNotReadyError,
  IdempotencyReuseError,
  OrderingLockedError,
  OrderingOffError,
  RateLimitedError,
  SoldOutError,
  TableClosedError,
  UpiUnavailableError,
} from './guestmenu.errors';
import { fingerprint, idempotencyUuid } from './guestmenu.tokens';
import { lower, type GuestOrderStatus, type OpenSession, type TableContext } from './guestmenu.types';
import { guestStatusOf, guestTimeline } from './guest-status';
import { computeRunningBill, toWireTaxLines, type WireTaxLine } from './running-bill';
import { GUEST_SYSTEM_ACTOR } from './table-context.service';
import { UniqueViolation } from './unique-violation';

export interface PlacedOrder {
  orderId: string;
  status: GuestOrderStatus;
  totalMinor: number;
  replayed: boolean;
}

export interface StateLine {
  itemId: string | null;
  name: string;
  qty: number;
  variantName: string | null;
  addOns: string[];
  note: string | null;
  lineTotalMinor: number;
}
export interface StateOrder {
  id: string;
  status: GuestOrderStatus;
  mine: boolean;
  edited: boolean;
  lines: StateLine[];
  placedAt: string;
  note: string | null;
  totalMinor: number;
  rejectReason?: string | null;
  timeline: { status: GuestOrderStatus; at: string }[];
}
export interface BillOut {
  subtotalMinor: number;
  taxLines: WireTaxLine[];
  totalMinor: number;
  paidMinor: number;
  dueMinor: number;
  status: 'RUNNING' | 'FINAL' | 'PAID';
  reference: string | null;
}
export interface TableStateOut {
  orders: StateOrder[];
  bill: BillOut | null;
  waiterCall: { open: boolean; reason?: string; at?: string };
}

const guestScope = (ctx: TableContext): TenantScope => ({
  businessId: ctx.businessId,
  locationId: ctx.locationId,
  actor: { ...GUEST_SYSTEM_ACTOR, label: `Guest, table ${ctx.tableCode}` },
});

const REASON = { call: WaiterCallReason.CALL, bill: WaiterCallReason.BILL, water: WaiterCallReason.WATER, other: WaiterCallReason.OTHER } as const;

@Injectable()
export class GuestOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
    private readonly orders: OrderService,
    private readonly settings: SettingsService,
    private readonly bus: RealtimeBus,
  ) {}

  // ── Place an order ──────────────────────────────────────────────────────────────

  async placeOrder(ctx: TableContext, session: OpenSession, token: GuestMenuToken, dto: PlaceOrderDto, clientKey: string): Promise<PlacedOrder> {
    if (ctx.ordering === 'off') throw new OrderingOffError('Ordering from this menu is switched off. Please ask your waiter.');
    const scope = guestScope(ctx);

    const idemKey = idempotencyUuid(token.id, clientKey);
    const requestHash = fingerprint({
      lines: dto.lines.map((l) => ({
        i: l.itemId,
        v: l.variantId ?? null,
        a: [...(l.addOnOptionIds ?? [])].sort(),
        q: l.qty,
        n: l.note ?? null,
      })),
      note: dto.note ?? null,
    });

    // 1. Replay: the same guest retrying the same key gets the original answer, whatever has happened since.
    const prior = await this.findByKey(ctx.businessId, idemKey);
    if (prior) return this.replay(prior, requestHash);

    // 2. A bill already exists: new orders would never reach it.
    await this.assertNoBill(ctx.businessId, session.id);

    // 3. Abuse caps: guest orders waiting for staff, per table visit.
    const pending = await this.prisma.guestOrder.count({
      where: { businessId: ctx.businessId, decision: GuestOrderDecision.PENDING, serviceRequest: { sessionId: session.id, status: ServiceRequestStatus.DRAFT } },
    });
    if (pending >= caps.maxPendingOrders()) {
      throw new RateLimitedError('Your table already has several orders waiting for the waiter. Please wait for them to be confirmed.', 60, { reason: 'PENDING_ORDERS' });
    }

    // 4. Server-side validation and pricing. Nothing the client says about prices is read.
    await this.assertOrderable(ctx.businessId, dto);
    const snapshots = await this.price(scope, dto);
    const totalMinor = snapshots.reduce((s, l) => s + l.unitPriceMinorUnits * l.quantity, 0);

    const auto = ctx.ordering === 'auto';
    const allocated = auto ? await this.numbering.allocate(scope, 'service_request', { locationId: ctx.locationId }) : null;
    const now = new Date();

    try {
      const request = await this.prisma.$transaction(async (tx) => {
        // The table must still be open (a close waits for this share lock, so no order slips in after closing).
        const open = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM guest_session WHERE id = ${session.id}::uuid AND status = 'OPEN' FOR SHARE`;
        if (open.length === 0) throw new TableClosedError('This table has just been closed. Please ask your waiter.');

        const roundNumber = (await tx.serviceRequest.count({ where: { sessionId: session.id, businessId: ctx.businessId } })) + 1;
        const created = await tx.serviceRequest.create({
          data: {
            businessId: ctx.businessId,
            locationId: ctx.locationId,
            sessionId: session.id,
            staffId: null,
            roundNumber,
            idempotencyKey: idemKey,
            notes: dto.note || null,
            source: ServiceRequestSource.GUEST,
            ...(auto ? { status: ServiceRequestStatus.SENT, sentAt: now, requestNumber: allocated?.formatted ?? null } : {}),
            lines: {
              create: snapshots.map((snap) => ({
                businessId: ctx.businessId,
                catalogItemId: snap.catalogItemId,
                variantId: snap.variantId ?? null,
                itemNameSnapshot: snap.itemNameSnapshot,
                variantNameSnapshot: snap.variantNameSnapshot ?? null,
                unitPriceMinorUnits: snap.unitPriceMinorUnits,
                taxRateSnapshot: snap.taxRateSnapshot,
                taxCategoryNameSnapshot: snap.taxCategoryNameSnapshot ?? null,
                quantity: snap.quantity,
                notes: snap.notes ?? null,
                kitchenNote: null,
                modifiers: {
                  create: snap.modifiers.map((m) => ({
                    businessId: ctx.businessId,
                    modifierOptionId: m.modifierOptionId,
                    optionNameSnapshot: m.optionNameSnapshot,
                    priceAdjMinorUnits: m.priceAdjMinorUnits,
                  })),
                },
              })),
            },
          },
        });
        const guestOrder = await tx.guestOrder.create({
          data: {
            businessId: ctx.businessId,
            serviceRequestId: created.id,
            guestTokenId: token.id,
            guestName: token.displayName,
            mode: auto ? QrOrderingMode.AUTO : QrOrderingMode.CONFIRM,
            decision: auto ? GuestOrderDecision.AUTO_CONFIRMED : GuestOrderDecision.PENDING,
            requestHash,
            decidedAt: auto ? now : null,
          },
        });
        await this.audit.append(tx, scope, {
          action: 'service_request.draft_created',
          resourceType: 'service_request',
          resourceId: created.id,
          locationId: ctx.locationId,
          metadata: { source: 'GUEST', guestOrderId: guestOrder.id, sessionId: session.id, roundNumber, lineCount: snapshots.length, mode: lower(guestOrder.mode) },
        });
        if (auto) {
          await this.audit.append(tx, scope, {
            action: 'service_request.sent',
            resourceType: 'service_request',
            resourceId: created.id,
            locationId: ctx.locationId,
            metadata: { requestNumber: allocated?.formatted, lineCount: snapshots.length, decision: 'AUTO_CONFIRMED' },
          });
        }
        return created;
      });

      this.bus.emit(ctx.businessId, 'orders', ctx.locationId);
      if (auto) this.bus.emit(ctx.businessId, 'kitchen', ctx.locationId);
      return { orderId: request.id, status: auto ? 'CONFIRMED' : 'AWAITING_CONFIRMATION', totalMinor, replayed: false };
    } catch (e) {
      // Two identical requests raced past the replay check: the unique key kept exactly one of them.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const winner = await this.findByKey(ctx.businessId, idemKey);
        if (winner) return this.replay(winner, requestHash);
        throw new UniqueViolation();
      }
      throw e;
    }
  }

  private findByKey(businessId: string, idempotencyKey: string) {
    return this.prisma.serviceRequest.findFirst({
      where: { businessId, idempotencyKey },
      include: { guestOrder: true, lines: true },
    });
  }

  private replay(
    prior: NonNullable<Awaited<ReturnType<GuestOrderService['findByKey']>>>,
    requestHash: string,
  ): PlacedOrder {
    if (!prior.guestOrder || prior.guestOrder.requestHash !== requestHash) {
      throw new IdempotencyReuseError('This Idempotency-Key was already used for a different order.');
    }
    const lines = prior.lines.filter((l) => l.status !== ServiceLineStatus.CANCELLED);
    return {
      orderId: prior.id,
      status: guestStatusOf(prior),
      totalMinor: lines.reduce((s, l) => s + l.unitPriceMinorUnits * l.quantity, 0),
      replayed: true,
    };
  }

  private async assertNoBill(businessId: string, sessionId: string): Promise<void> {
    const invoice = await this.prisma.invoice.findFirst({ where: { businessId, sessionId, status: { not: InvoiceStatus.VOIDED } }, select: { id: true } });
    if (invoice) throw new OrderingLockedError('A bill has already been prepared for this table. Please ask your waiter to add anything else.');
  }

  /** Items must be on the live menu and not sold out; items with variants need one. */
  private async assertOrderable(businessId: string, dto: PlaceOrderDto): Promise<void> {
    const ids = [...new Set(dto.lines.map((l) => l.itemId))];
    const items = await this.prisma.catalogItem.findMany({
      where: { businessId, id: { in: ids } },
      select: { id: true, name: true, isActive: true, isAvailable: true, category: { select: { isActive: true } }, variants: { select: { id: true, isAvailable: true } } },
    });
    const byId = new Map(items.map((i) => [i.id, i]));
    for (const line of dto.lines) {
      const item = byId.get(line.itemId);
      if (!item || !item.isActive || !item.category.isActive) {
        throw new ValidationError('An item in your order is no longer on the menu.', { reason: 'ITEM_NOT_ON_MENU', itemId: line.itemId });
      }
      const available = item.variants.filter((v) => v.isAvailable);
      if (!item.isAvailable || (item.variants.length > 0 && available.length === 0)) {
        throw new SoldOutError(`${item.name} is sold out.`, { itemId: item.id, name: item.name });
      }
      if (available.length > 0 && !line.variantId) {
        throw new ValidationError(`Choose an option for ${item.name}.`, { reason: 'VARIANT_REQUIRED', itemId: item.id });
      }
    }
  }

  /** Live-catalog pricing through the same path as staff orders. Unavailable variants/options read as "sold out". */
  private async price(scope: TenantScope, dto: PlaceOrderDto): Promise<LineSnapshot[]> {
    try {
      return await this.orders.resolveLineSnapshots(
        scope,
        dto.lines.map((l) => ({
          catalogItemId: l.itemId,
          variantId: l.variantId,
          quantity: l.qty,
          notes: l.note || undefined,
          modifiers: (l.addOnOptionIds ?? []).map((id) => ({ modifierOptionId: id })),
        })),
      );
    } catch (e) {
      if (e instanceof ValidationError && e.message.startsWith(LINE_CONFIG_ERROR_PREFIX)) {
        const reason = (e.details as { reason?: string } | undefined)?.reason;
        if (reason === 'VARIANT_UNAVAILABLE' || reason === 'OPTION_UNAVAILABLE') throw new SoldOutError('An option you chose just sold out.', e.details);
      }
      throw e;
    }
  }

  // ── Table state (orders, bill, waiter call) ─────────────────────────────────────

  async state(ctx: TableContext, session: OpenSession, token: GuestMenuToken): Promise<TableStateOut> {
    const requests = await this.prisma.serviceRequest.findMany({
      where: { businessId: ctx.businessId, sessionId: session.id },
      include: { guestOrder: true, lines: { include: { modifiers: true }, orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    const visible = requests.filter((r) => {
      const mine = r.guestOrder?.guestTokenId === token.id;
      if (r.status === ServiceRequestStatus.DRAFT) return mine; // a waiter's unsent draft, or another guest's pending order
      if (r.guestOrder?.decision === GuestOrderDecision.REJECTED) return mine;
      return true;
    });

    const events = visible.length
      ? await this.prisma.auditEvent.findMany({
          where: { businessId: ctx.businessId, resourceType: 'service_request', resourceId: { in: visible.map((r) => r.id) } },
          orderBy: { sequence: 'asc' },
          take: 2000,
          select: { id: true, sequence: true, action: true, actorType: true, actorId: true, actorLabel: true, metadata: true, createdAt: true, resourceId: true },
        })
      : [];
    const byRequest = new Map<string, AuditRowLike[]>();
    for (const e of events) {
      if (!e.resourceId) continue;
      const list = byRequest.get(e.resourceId) ?? [];
      list.push(e as AuditRowLike);
      byRequest.set(e.resourceId, list);
    }

    const orders: StateOrder[] = visible.map((r) => {
      const status = guestStatusOf(r);
      const closed = status === 'CANCELLED' || status === 'REJECTED';
      const lines = r.lines.filter((l) => closed || l.status !== ServiceLineStatus.CANCELLED);
      const active = r.lines.filter((l) => l.status !== ServiceLineStatus.CANCELLED);
      return {
        id: r.id,
        status,
        mine: r.guestOrder?.guestTokenId === token.id,
        edited: r.editCount > 0 || r.lines.some((l) => l.editKind !== null),
        placedAt: r.createdAt.toISOString(),
        note: r.notes,
        lines: lines.map((l) => ({
          itemId: l.catalogItemId,
          name: l.itemNameSnapshot,
          qty: l.quantity,
          variantName: l.variantNameSnapshot,
          addOns: l.modifiers.map((m) => m.optionNameSnapshot),
          note: l.notes,
          lineTotalMinor: l.unitPriceMinorUnits * l.quantity,
        })),
        totalMinor: active.reduce((s, l) => s + l.unitPriceMinorUnits * l.quantity, 0),
        rejectReason: status === 'REJECTED' ? r.guestOrder?.rejectReason ?? null : undefined,
        timeline: guestTimeline(byRequest.get(r.id) ?? [], r, { guestOrder: !!r.guestOrder, rejected: status === 'REJECTED' }),
      };
    });

    const [bill, call] = await Promise.all([this.bill(ctx, session.id), this.openCall(ctx.tableId)]);
    return { orders, bill, waiterCall: call ? { open: true, reason: lower(call.reason), at: call.createdAt.toISOString() } : { open: false } };
  }

  /** The running bill, or the real invoice once the cashier has finalised one. Null when nothing is billable yet. */
  async bill(ctx: TableContext, sessionId: string): Promise<BillOut | null> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { businessId: ctx.businessId, sessionId, status: { not: InvoiceStatus.VOIDED } },
      include: { payments: { select: { status: true, amountMinorUnits: true } }, location: { select: { code: true, name: true } } },
    });
    if (invoice && invoice.status !== InvoiceStatus.DRAFT) {
      const captured = invoice.payments.filter((p) => p.status === PaymentStatus.CAPTURED).reduce((s, p) => s + p.amountMinorUnits, 0);
      const paid = invoice.status === InvoiceStatus.PAID ? invoice.grandTotalMinorUnits : Math.min(captured, invoice.grandTotalMinorUnits);
      return {
        subtotalMinor: invoice.subtotalMinorUnits,
        taxLines: toWireTaxLines(toBillTaxLines(invoice.taxBreakdown)),
        totalMinor: invoice.grandTotalMinorUnits,
        paidMinor: paid,
        dueMinor: Math.max(0, invoice.grandTotalMinorUnits - paid),
        status: invoice.status === InvoiceStatus.PAID ? 'PAID' : 'FINAL',
        reference: billReference(invoice.invoiceNumber, invoice.location),
      };
    }
    // A DRAFT invoice can still change: guests keep seeing the live running total computed from the same lines.
    const lines = await this.prisma.serviceRequestLine.findMany({
      where: {
        businessId: ctx.businessId,
        status: { not: ServiceLineStatus.CANCELLED },
        serviceRequest: { sessionId, businessId: ctx.businessId, status: { notIn: [ServiceRequestStatus.DRAFT, ServiceRequestStatus.CANCELLED] } },
      },
      select: { unitPriceMinorUnits: true, quantity: true, taxRateSnapshot: true, taxCategoryNameSnapshot: true },
    });
    if (lines.length === 0) return null;
    const t = computeRunningBill(lines.map((l) => ({ ...l, taxRateSnapshot: l.taxRateSnapshot.toNumber() })));
    return { subtotalMinor: t.subtotalMinor, taxLines: toWireTaxLines(t.taxLines), totalMinor: t.totalMinor, paidMinor: 0, dueMinor: t.totalMinor, status: 'RUNNING', reference: null };
  }

  openCall(tableId: string) {
    return this.prisma.waiterCall.findFirst({ where: { diningTableId: tableId, status: WaiterCallStatus.OPEN }, orderBy: { createdAt: 'desc' } });
  }

  // ── Call the waiter ─────────────────────────────────────────────────────────────

  async callWaiter(ctx: TableContext, session: OpenSession | null, token: GuestMenuToken | null, dto: WaiterDto): Promise<{ open: true; reason: string; at: string }> {
    if (!ctx.settings.callWaiter) throw new OrderingOffError('Calling the waiter from this menu is switched off.');
    const reason = REASON[dto.reason];

    // Calls left over from an earlier visit (or from before the table was opened) are stale: close them first.
    await this.prisma.waiterCall.updateMany({
      where: {
        diningTableId: ctx.tableId,
        status: WaiterCallStatus.OPEN,
        ...(session ? { OR: [{ sessionId: null }, { sessionId: { not: session.id } }] } : { sessionId: { not: null } }),
      },
      data: { status: WaiterCallStatus.ACKNOWLEDGED, acknowledgedAt: new Date() },
    });

    let call;
    try {
      call = await this.prisma.waiterCall.create({
        data: {
          businessId: ctx.businessId,
          locationId: ctx.locationId,
          diningTableId: ctx.tableId,
          sessionId: session?.id ?? null,
          guestTokenId: token?.id ?? null,
          reason,
        },
      });
    } catch (e) {
      // At most one OPEN call per table+reason (partial unique index): pressing twice is the same call.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        call = await this.prisma.waiterCall.findFirst({ where: { diningTableId: ctx.tableId, reason, status: WaiterCallStatus.OPEN } });
        if (!call) throw e;
      } else throw e;
    }
    this.bus.emit(ctx.businessId, 'tables', ctx.locationId);
    return { open: true, reason: lower(call.reason), at: call.createdAt.toISOString() };
  }

  // ── Pay by UPI ──────────────────────────────────────────────────────────────────

  async payIntent(ctx: TableContext, session: OpenSession): Promise<{ upiUri: string; qrPayload: string; amountMinor: number; reference: string }> {
    if (!ctx.settings.upiEnabled || !ctx.upiConfigured) throw new UpiUnavailableError('UPI payment is not available at this restaurant. Please ask your waiter.');
    const invoice = await this.prisma.invoice.findFirst({
      where: { businessId: ctx.businessId, sessionId: session.id, status: { not: InvoiceStatus.VOIDED } },
      include: { payments: { select: { status: true, amountMinorUnits: true } }, location: { select: { code: true, name: true } } },
    });
    if (!invoice || invoice.status === InvoiceStatus.DRAFT) throw new BillNotReadyError('Your bill is not ready yet. Ask your waiter for the bill first.');
    if (invoice.status === InvoiceStatus.PAID) throw new BillNotReadyError('This bill is already paid. Thank you!');
    const captured = invoice.payments.filter((p) => p.status === PaymentStatus.CAPTURED).reduce((s, p) => s + p.amountMinorUnits, 0);
    const due = invoice.grandTotalMinorUnits - captured;
    if (due <= 0) throw new BillNotReadyError('Nothing is due on this bill.');

    const scope: TenantScope = { businessId: ctx.businessId, actor: GUEST_SYSTEM_ACTOR };
    const [vpaSetting, nameSetting, business] = await Promise.all([
      this.settings.getEffective(scope, CHECKOUT_SETTINGS_NAMESPACE, UPI_VPA_KEY, invoice.locationId),
      this.settings.getEffective(scope, CHECKOUT_SETTINGS_NAMESPACE, UPI_PAYEE_NAME_KEY, invoice.locationId),
      this.prisma.business.findUnique({ where: { id: ctx.businessId }, select: { name: true, invoiceName: true } }),
    ]);
    const vpa = typeof vpaSetting.value === 'string' ? vpaSetting.value.trim() : '';
    if (!isValidVpa(vpa)) throw new UpiUnavailableError('UPI payment is not available at this restaurant. Please ask your waiter.');
    const configuredName = typeof nameSetting.value === 'string' ? nameSetting.value.trim() : '';
    const payeeName = configuredName || business?.invoiceName?.trim() || business?.name || 'Restaurant';
    const reference = billReference(invoice.invoiceNumber, invoice.location) ?? invoice.id.slice(0, 8);
    const upiUri = buildUpiUri({
      vpa,
      payeeName,
      amountMinorUnits: due,
      note: `Bill ${reference} Table ${ctx.tableCode}`,
      reference: cleanTransactionRef(reference),
    });
    return { upiUri, qrPayload: upiUri, amountMinor: due, reference };
  }
}
