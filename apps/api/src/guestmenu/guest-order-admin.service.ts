import { Injectable } from '@nestjs/common';
import {
  GuestOrderDecision,
  GuestSessionStatus,
  InvoiceStatus,
  Prisma,
  ServiceLineStatus,
  ServiceRequestSource,
  ServiceRequestStatus,
  WaiterCallStatus,
} from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../common/errors';
import { TenantScopedRepository } from '../common/tenant-scoped.repository';
import type { TenantScope } from '../common/tenant-scope';
import { AuditService } from '../core/audit/audit.service';
import { NumberingService } from '../core/numbering/numbering.service';
import { canAccessLocation, type Principal } from '../iam/principal';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeBus } from '../realtime/realtime.bus';
import { OrderEditService } from '../restaurant/order/order-edit.service';
import type { EditOp } from '../restaurant/order/order-edit.dto';
import type { EditGuestOrderDto, GuestOrderListQuery } from './guestmenu.dto';
import { OrderingLockedError } from './guestmenu.errors';
import { idempotencyUuid } from './guestmenu.tokens';
import { lower } from './guestmenu.types';

export type AdminGuestStatus = 'AWAITING_CONFIRMATION' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED';

export interface AdminGuestOrderOut {
  id: string;
  guestOrderId: string;
  requestNumber: string | null;
  status: AdminGuestStatus;
  /** Service-request status behind it (DRAFT while waiting; SENT, ACCEPTED ... once confirmed). */
  requestStatus: ServiceRequestStatus;
  decision: GuestOrderDecision;
  mode: 'confirm' | 'auto';
  source: 'GUEST';
  tableId: string;
  tableCode: string;
  areaName: string | null;
  sessionId: string;
  locationId: string;
  guestName: string | null;
  placedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  rejectReason: string | null;
  note: string | null;
  version: number;
  lines: {
    id: string;
    name: string;
    variantName: string | null;
    qty: number;
    /** Base + variant, WITHOUT add-ons (add-ons are listed separately). */
    unitPriceMinor: number;
    addOns: { name: string; priceMinor: number }[];
    note: string | null;
    cancelled: boolean;
  }[];
  totalMinor: number;
}

const INCLUDE = {
  serviceRequest: {
    include: {
      lines: { include: { modifiers: true }, orderBy: { createdAt: 'asc' as const } },
      session: { select: { id: true, status: true, diningTableId: true, locationId: true, diningTable: { select: { code: true, diningArea: { select: { name: true } } } } } },
    },
  },
} satisfies Prisma.GuestOrderInclude;
type Row = Prisma.GuestOrderGetPayload<{ include: typeof INCLUDE }>;

const adminStatus = (r: Row): AdminGuestStatus => {
  if (r.decision === GuestOrderDecision.REJECTED) return 'REJECTED';
  if (r.serviceRequest.status === ServiceRequestStatus.CANCELLED) return 'CANCELLED';
  if (r.serviceRequest.status === ServiceRequestStatus.DRAFT) return 'AWAITING_CONFIRMATION';
  return 'CONFIRMED';
};

@Injectable()
export class GuestOrderAdminService extends TenantScopedRepository {
  constructor(
    prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
    private readonly editor: OrderEditService,
    private readonly bus: RealtimeBus,
  ) {
    super(prisma);
  }

  // ── List ────────────────────────────────────────────────────────────────────────

  async list(scope: TenantScope, principal: Principal, q: GuestOrderListQuery): Promise<AdminGuestOrderOut[]> {
    if (q.locationId && !canAccessLocation(principal, q.locationId)) return [];
    const where: Prisma.GuestOrderWhereInput = { businessId: scope.businessId };
    const sr: Prisma.ServiceRequestWhereInput = {
      source: ServiceRequestSource.GUEST,
      ...(q.locationId ? { locationId: q.locationId } : {}),
      ...(principal.allLocations ? {} : { locationId: q.locationId ?? { in: [...principal.locationIds] } }),
    };
    switch (q.status) {
      case 'AWAITING_CONFIRMATION':
        where.decision = GuestOrderDecision.PENDING;
        sr.status = ServiceRequestStatus.DRAFT;
        sr.session = { status: GuestSessionStatus.OPEN };
        break;
      case 'REJECTED':
        where.decision = GuestOrderDecision.REJECTED;
        break;
      case 'CANCELLED':
        where.decision = { in: [GuestOrderDecision.CONFIRMED, GuestOrderDecision.AUTO_CONFIRMED] };
        sr.status = ServiceRequestStatus.CANCELLED;
        break;
      case 'CONFIRMED':
        where.decision = { in: [GuestOrderDecision.CONFIRMED, GuestOrderDecision.AUTO_CONFIRMED] };
        sr.status = { notIn: [ServiceRequestStatus.DRAFT, ServiceRequestStatus.CANCELLED] };
        break;
      default:
        where.createdAt = { gte: new Date(Date.now() - 24 * 3600_000) };
    }
    where.serviceRequest = sr;
    const rows = await this.prisma.guestOrder.findMany({
      where,
      include: INCLUDE,
      orderBy: q.status === 'AWAITING_CONFIRMATION' ? { createdAt: 'asc' } : { createdAt: 'desc' },
      take: q.take,
    });
    return rows.map((r) => this.toOut(r));
  }

  // ── Confirm ─────────────────────────────────────────────────────────────────────

  /** Waiter accepts a guest order: it becomes a normal SENT service request (numbered, visible to the kitchen). Idempotent. */
  async confirm(scope: TenantScope, principal: Principal, id: string): Promise<AdminGuestOrderOut> {
    const found = await this.find(scope, principal, id);
    if (found.decision === GuestOrderDecision.REJECTED) throw new ConflictError('This order was already rejected.', { reason: 'ALREADY_REJECTED' });
    if (found.serviceRequest.status !== ServiceRequestStatus.DRAFT) return this.toOut(found); // already confirmed: replay
    if (found.serviceRequest.session.status !== GuestSessionStatus.OPEN) {
      throw new ConflictError('The table session is closed, so this order can no longer be confirmed.', { reason: 'SESSION_NOT_OPEN' });
    }
    const invoice = await this.prisma.invoice.findFirst({
      where: { businessId: scope.businessId, sessionId: found.serviceRequest.sessionId, status: { not: InvoiceStatus.VOIDED } },
      select: { id: true },
    });
    if (invoice) {
      throw new OrderingLockedError('A bill already exists for this table. Void the bill first, or reject this order and add the items yourself.');
    }
    const locationId = found.serviceRequest.locationId;
    const allocated = await this.numbering.allocate(scope, 'service_request', { locationId });

    const done = await this.prisma.$transaction(async (tx) => {
      // Serialise concurrent confirm / reject / edit of this order on the request row.
      await tx.$queryRaw`SELECT id FROM service_request WHERE id = ${found.serviceRequestId}::uuid FOR UPDATE`;
      const fresh = await tx.guestOrder.findFirstOrThrow({ where: { id: found.id, businessId: scope.businessId }, include: INCLUDE });
      if (fresh.decision === GuestOrderDecision.REJECTED) throw new ConflictError('This order was already rejected.', { reason: 'ALREADY_REJECTED' });
      if (fresh.serviceRequest.status !== ServiceRequestStatus.DRAFT) return { replay: true as const };
      const activeLines = fresh.serviceRequest.lines.filter((l) => l.status !== ServiceLineStatus.CANCELLED);
      if (activeLines.length === 0) throw new ValidationError('The order has no items left. Reject it instead.', { reason: 'EMPTY_ORDER' });

      await tx.serviceRequest.update({
        where: { id: fresh.serviceRequestId },
        data: { status: ServiceRequestStatus.SENT, requestNumber: allocated.formatted, sentAt: new Date(), version: { increment: 1 } },
      });
      await tx.guestOrder.update({
        where: { id: found.id },
        data: { decision: GuestOrderDecision.CONFIRMED, decidedAt: new Date(), decidedByUserId: scope.actor.id ?? null, decidedByLabel: scope.actor.label },
      });
      await this.audit.append(tx, scope, {
        action: 'service_request.sent',
        resourceType: 'service_request',
        resourceId: fresh.serviceRequestId,
        locationId,
        metadata: { requestNumber: allocated.formatted, lineCount: activeLines.length, decision: 'CONFIRMED', source: 'GUEST' },
      });
      return { replay: false as const };
    });
    if (!done.replay) {
      this.bus.emit(scope.businessId, 'orders', locationId);
      this.bus.emit(scope.businessId, 'kitchen', locationId);
    }
    return this.toOut(await this.find(scope, principal, id));
  }

  // ── Reject ──────────────────────────────────────────────────────────────────────

  async reject(scope: TenantScope, principal: Principal, id: string, reason: string): Promise<AdminGuestOrderOut> {
    const found = await this.find(scope, principal, id);
    if (found.decision === GuestOrderDecision.REJECTED) return this.toOut(found); // replay
    if (found.serviceRequest.status !== ServiceRequestStatus.DRAFT) {
      throw new ConflictError('This order was already confirmed. Cancel it from the order instead.', { reason: 'ALREADY_CONFIRMED' });
    }
    const done = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM service_request WHERE id = ${found.serviceRequestId}::uuid FOR UPDATE`;
      const fresh = await tx.guestOrder.findFirstOrThrow({ where: { id: found.id, businessId: scope.businessId }, include: INCLUDE });
      if (fresh.decision === GuestOrderDecision.REJECTED) return false;
      if (fresh.serviceRequest.status !== ServiceRequestStatus.DRAFT) {
        throw new ConflictError('This order was already confirmed. Cancel it from the order instead.', { reason: 'ALREADY_CONFIRMED' });
      }
      await tx.serviceRequestLine.updateMany({
        where: { serviceRequestId: fresh.serviceRequestId, status: { not: ServiceLineStatus.CANCELLED } },
        data: { status: ServiceLineStatus.CANCELLED, cancelReason: reason },
      });
      await tx.serviceRequest.update({
        where: { id: fresh.serviceRequestId },
        data: { status: ServiceRequestStatus.CANCELLED, cancelReason: reason, version: { increment: 1 } },
      });
      await tx.guestOrder.update({
        where: { id: found.id },
        data: { decision: GuestOrderDecision.REJECTED, rejectReason: reason, decidedAt: new Date(), decidedByUserId: scope.actor.id ?? null, decidedByLabel: scope.actor.label },
      });
      await this.audit.append(tx, scope, {
        action: 'service_request.cancelled',
        resourceType: 'service_request',
        resourceId: fresh.serviceRequestId,
        locationId: fresh.serviceRequest.locationId,
        metadata: { reason, source: 'GUEST', decision: 'REJECTED' },
      });
      return true;
    });
    if (done) this.bus.emit(scope.businessId, 'orders', found.serviceRequest.locationId);
    return this.toOut(await this.find(scope, principal, id));
  }

  // ── Edit (while it waits for confirmation) ──────────────────────────────────────

  /**
   * Quantity changes (0 removes the line) and the order note, through the audited, idempotent, version-checked order-edit
   * service (ADR-016/017), so a guest order edit leaves the same append-only trail as any other edit.
   */
  async edit(scope: TenantScope, principal: Principal, id: string, dto: EditGuestOrderDto, clientKey: string): Promise<AdminGuestOrderOut> {
    const found = await this.find(scope, principal, id);
    if (found.decision === GuestOrderDecision.REJECTED || found.serviceRequest.status !== ServiceRequestStatus.DRAFT) {
      throw new ConflictError('Only an order that is still waiting for confirmation can be edited here. Use the order edit for confirmed orders.', { reason: 'NOT_AWAITING_CONFIRMATION' });
    }
    const lineById = new Map(found.serviceRequest.lines.filter((l) => l.status !== ServiceLineStatus.CANCELLED).map((l) => [l.id, l]));
    const ops: EditOp[] = [];
    for (const l of dto.lines) {
      const cur = lineById.get(l.id);
      if (!cur) throw new ValidationError('That item is not part of this order.', { reason: 'LINE_NOT_FOUND', lineId: l.id });
      if (l.qty === 0) ops.push({ op: 'remove', lineId: l.id });
      else if (l.qty !== cur.quantity) ops.push({ op: 'update', lineId: l.id, quantity: l.qty });
    }
    const removing = ops.filter((o) => o.op === 'remove').length;
    if (removing > 0 && removing >= lineById.size) throw new ValidationError('Removing every item leaves an empty order. Reject it instead.', { reason: 'EMPTY_ORDER' });

    await this.editor.editOrder(scope, found.serviceRequestId, {
      idempotencyKey: idempotencyUuid(found.id, clientKey),
      expectedVersion: found.serviceRequest.version,
      reason: 'Edited by staff before confirmation',
      ops,
      ...(dto.note !== undefined ? { notes: dto.note } : {}),
    });
    this.bus.emit(scope.businessId, 'orders', found.serviceRequest.locationId);
    return this.toOut(await this.find(scope, principal, id));
  }

  // ── Waiter calls ────────────────────────────────────────────────────────────────

  async alerts(scope: TenantScope, principal: Principal) {
    const calls = await this.prisma.waiterCall.findMany({
      where: {
        businessId: scope.businessId,
        status: WaiterCallStatus.OPEN,
        ...(principal.allLocations ? {} : { locationId: { in: [...principal.locationIds] } }),
      },
      include: { diningTable: { select: { code: true, diningArea: { select: { name: true } } } } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return calls.map((c) => ({
      id: c.id,
      tableId: c.diningTableId,
      tableCode: c.diningTable.code,
      areaName: c.diningTable.diningArea.name,
      locationId: c.locationId,
      reason: lower(c.reason),
      at: c.createdAt.toISOString(),
    }));
  }

  /** Marks every open call on the table as handled. Idempotent: nothing open = nothing to do. */
  async ackTable(scope: TenantScope, principal: Principal, tableId: string): Promise<void> {
    const table = await this.prisma.diningTable.findFirst({ where: this.scoped(scope, { id: tableId }), select: { locationId: true, code: true } });
    if (!table || !canAccessLocation(principal, table.locationId)) throw new NotFoundError('Dining table not found', { tableId });
    const res = await this.prisma.$transaction(async (tx) => {
      const r = await tx.waiterCall.updateMany({
        where: { businessId: scope.businessId, diningTableId: tableId, status: WaiterCallStatus.OPEN },
        data: { status: WaiterCallStatus.ACKNOWLEDGED, acknowledgedAt: new Date(), acknowledgedByUserId: scope.actor.id ?? null },
      });
      if (r.count > 0) {
        await this.audit.append(tx, scope, {
          action: 'waiter_call.acknowledged',
          resourceType: 'dining_table',
          resourceId: tableId,
          locationId: table.locationId,
          metadata: { tableCode: table.code, calls: r.count },
        });
      }
      return r;
    });
    if (res.count > 0) this.bus.emit(scope.businessId, 'tables', table.locationId);
  }

  // ── helpers ─────────────────────────────────────────────────────────────────────

  private async find(scope: TenantScope, principal: Principal, id: string): Promise<Row> {
    const row = await this.prisma.guestOrder.findFirst({ where: this.scoped(scope, { serviceRequestId: id }), include: INCLUDE });
    if (!row || !canAccessLocation(principal, row.serviceRequest.locationId)) throw new NotFoundError('Guest order not found', { id });
    return this.assertOwned(row, scope);
  }

  private toOut(r: Row): AdminGuestOrderOut {
    const req = r.serviceRequest;
    const active = req.lines.filter((l) => l.status !== ServiceLineStatus.CANCELLED);
    const shown = req.status === ServiceRequestStatus.CANCELLED ? req.lines : active;
    return {
      id: req.id,
      guestOrderId: r.id,
      requestNumber: req.requestNumber,
      status: adminStatus(r),
      requestStatus: req.status,
      decision: r.decision,
      mode: lower(r.mode) as 'confirm' | 'auto',
      source: 'GUEST',
      tableId: req.session.diningTableId,
      tableCode: req.session.diningTable.code,
      areaName: req.session.diningTable.diningArea.name,
      sessionId: req.sessionId,
      locationId: req.locationId,
      guestName: r.guestName,
      placedAt: req.createdAt.toISOString(),
      decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
      decidedBy: r.decidedByLabel,
      rejectReason: r.rejectReason,
      note: req.notes,
      version: req.version,
      lines: shown.map((l) => {
        const addOnSum = l.modifiers.reduce((s, m) => s + m.priceAdjMinorUnits, 0);
        return {
          id: l.id,
          name: l.itemNameSnapshot,
          variantName: l.variantNameSnapshot,
          qty: l.quantity,
          unitPriceMinor: l.unitPriceMinorUnits - addOnSum,
          addOns: l.modifiers.map((m) => ({ name: m.optionNameSnapshot, priceMinor: m.priceAdjMinorUnits })),
          note: l.notes,
          cancelled: l.status === ServiceLineStatus.CANCELLED,
        };
      }),
      totalMinor: active.reduce((s, l) => s + l.unitPriceMinorUnits * l.quantity, 0),
    };
  }
}

