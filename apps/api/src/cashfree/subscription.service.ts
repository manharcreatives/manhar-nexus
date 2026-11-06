import { randomBytes } from 'node:crypto';
import { QuoteError, quotePlan, type Quote } from '@nexus/shared';
import { Injectable, Optional } from '@nestjs/common';
import { Prisma, type RegistrationSubscription, type RegistrationSubscriptionCharge } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../common/errors';
import type { ActorContext } from '../common/tenant-scope';
import { logger } from '../logging/logger';
import { PrismaService } from '../prisma/prisma.service';
import { AutoProvisionService } from '../provisioning/auto-provision.service';
import { BillingRecordService } from '../provisioning/billing-record.service';
import { afterResponse } from './after-response';
import { CashfreeClient } from './cashfree.client';
import { PaymentsNotConfiguredError } from './cashfree.errors';
import type { BreakdownLine } from './cashfree.dto';
import { subscriptionsFlag } from './subscription.config';
import type { SubscriptionEvent } from './subscription.events';

const NOT_PAYABLE = new Set(['CONVERTED', 'SPAM', 'REJECTED']);
const DAY_MS = 86_400_000;
/** Mandates the owner may still act on or that still debit: a new one is refused while one of these exists. */
const LIVE = ['INITIALIZED', 'BANK_APPROVAL_PENDING', 'ACTIVE', 'ON_HOLD', 'PAUSED', 'CUSTOMER_PAUSED'];
/** Once here a mandate never leaves (a late, out-of-order ACTIVE must not revive a cancelled one). */
const TERMINAL = new Set(['CANCELLED', 'CUSTOMER_CANCELLED', 'COMPLETED', 'EXPIRED', 'LINK_EXPIRED', 'CARD_EXPIRED']);

export type SubscriptionEventOutcome = 'ignored' | 'updated' | 'duplicate' | 'amount-mismatch';

export interface CreateSubscriptionDto {
  planKey?: string;
  replaceOpen?: boolean;
}

export interface SubscriptionView {
  id: string;
  registrationId: string;
  subscriptionId: string;
  status: string;
  planKey: string;
  amountPaise: number;
  breakdown: BreakdownLine[] | null;
  firstChargeAt: Date | null;
  activatedAt: Date | null;
  cancelledAt: Date | null;
  lastChargeStatus: string | null;
  lastChargeAt: Date | null;
  /** Path of the owner's authorisation page; present only while the mandate still waits for the owner. */
  authPath: string | null;
  createdAt: Date;
  charges: { cfPaymentId: string; kind: string; status: string; amountPaise: number; failureReason: string | null; occurredAt: Date }[];
}

export type CheckoutAnswer =
  | { state: 'ready'; sessionId: string; environment: 'sandbox' | 'production'; restaurantName: string; planName: string; amountPaise: number }
  | { state: 'authorised' | 'closed' };

type Row = RegistrationSubscription & { charges?: RegistrationSubscriptionCharge[] };

export function toSubscriptionView(row: Row): SubscriptionView {
  const q = row.quote as { lines?: unknown } | null;
  const breakdown = q && Array.isArray(q.lines) ? (q.lines as BreakdownLine[]).filter((l) => typeof l?.label === 'string' && typeof l?.amountPaise === 'number') : null;
  return {
    id: row.id,
    registrationId: row.registrationId,
    subscriptionId: row.subscriptionId,
    status: row.status,
    planKey: row.planKey,
    amountPaise: row.amountPaise,
    breakdown,
    firstChargeAt: row.firstChargeAt,
    activatedAt: row.activatedAt,
    cancelledAt: row.cancelledAt,
    lastChargeStatus: row.lastChargeStatus,
    lastChargeAt: row.lastChargeAt,
    authPath: row.status === 'INITIALIZED' ? `/pay/autopay/${row.authToken}` : null,
    createdAt: row.createdAt,
    charges: (row.charges ?? []).map((c) => ({
      cfPaymentId: c.cfPaymentId,
      kind: c.kind,
      status: c.status,
      amountPaise: c.amountPaise,
      failureReason: c.failureReason,
      occurredAt: c.occurredAt,
    })),
  };
}

const WITH_CHARGES = { charges: { orderBy: { occurredAt: 'desc' as const }, take: 3 } };

/** UPI AutoPay for the owner's MONTHLY plan: a Cashfree PERIODIC mandate, priced by the server, settled by webhook. */
@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cashfree: CashfreeClient,
    @Optional() private readonly autoProvision?: AutoProvisionService,
    @Optional() private readonly billing?: BillingRecordService,
  ) {}

  async list(registrationId: string): Promise<SubscriptionView[]> {
    await this.registrationOrThrow(registrationId);
    const rows = await this.prisma.registrationSubscription.findMany({ where: { registrationId }, orderBy: { createdAt: 'desc' }, include: WITH_CHARGES });
    return rows.map(toSubscriptionView);
  }

  async create(actor: ActorContext, registrationId: string, dto: CreateSubscriptionDto, now = new Date()): Promise<SubscriptionView> {
    if (!subscriptionsFlag()) {
      throw new PaymentsNotConfiguredError('AutoPay is not switched on for this server yet (SUBSCRIPTIONS_ENABLED). Ask the platform owner.');
    }
    const reg = await this.registrationOrThrow(registrationId);
    if (NOT_PAYABLE.has(reg.status)) {
      throw new ValidationError(`Cannot set up AutoPay for a ${reg.status.toLowerCase()} request`, { status: reg.status });
    }
    this.cashfree.config(); // 503 with a plain message when the keys are missing

    // The recurring debit is the plan's MONTHLY price + GST. The one-time Launch Pack is not part of a monthly debit,
    // and the Founding discount only applies to yearly, so neither is ever included here.
    let quote: Quote;
    try {
      quote = quotePlan({ planKey: dto.planKey ?? reg.planKey, cycle: 'monthly', offerDate: reg.createdAt, launchPack: false });
    } catch (err) {
      if (err instanceof QuoteError) throw new ValidationError(err.message, { needsPlan: true });
      throw err;
    }

    await this.closeLive(registrationId, dto.replaceOpen === true);

    // If a payment link was already paid for this request, that covered the first month: the first debit is a month later.
    const paid = await this.prisma.registrationPayment.findFirst({ where: { registrationId, status: 'PAID' }, orderBy: { paidAt: 'desc' } });
    const firstChargeAt = paid?.paidAt ? addMonth(paid.paidAt) : new Date(now.getTime() + DAY_MS);
    const subscriptionId = `${reg.referenceCode}-ap-${randomBytes(4).toString('hex')}`;
    const authToken = randomBytes(24).toString('base64url');
    const publicBase = process.env.QR_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '');
    const sub = await this.cashfree.createSubscription({
      subscriptionId,
      planName: `Nexus ${quote.planName} monthly`,
      amountPaise: quote.totalPaise,
      customer: { name: reg.contactName, email: reg.email, phone: reg.phone.replace(/\D/g, '').slice(-10) },
      firstChargeAt,
      expiresAt: new Date(now.getTime() + 3650 * DAY_MS),
      pspNote: `Manhar Nexus ${quote.planName} monthly`,
      ...(publicBase ? { returnUrl: `${publicBase}/pay/autopay/${authToken}` } : {}),
    });
    const row = await this.prisma.registrationSubscription.create({
      data: {
        registrationId,
        subscriptionId,
        cfSubscriptionId: sub.cfSubscriptionId,
        authToken,
        status: sub.status,
        planKey: quote.planKey,
        amountPaise: quote.totalPaise,
        quote: JSON.parse(JSON.stringify(quote)) as Prisma.InputJsonValue,
        firstChargeAt,
        createdBy: actor.id ?? actor.label,
      },
      include: WITH_CHARGES,
    });
    logger.child({ registrationId, subscriptionId, amountPaise: quote.totalPaise, planKey: quote.planKey }).info('autopay mandate created');
    return toSubscriptionView(row);
  }

  /** A live mandate blocks a new one. Only a mandate the owner has not authorised yet can be replaced; cancel the rest first. */
  private async closeLive(registrationId: string, replace: boolean): Promise<void> {
    const live = await this.prisma.registrationSubscription.findMany({ where: { registrationId, status: { in: LIVE } } });
    if (live.length === 0) return;
    const ids = live.map((s) => s.id);
    if (!replace || live.some((s) => s.status !== 'INITIALIZED')) {
      throw new ConflictError(
        live.some((s) => s.status !== 'INITIALIZED')
          ? 'This request already has an AutoPay mandate that is active or being approved. Cancel it first if you need a new one.'
          : 'This request already has an AutoPay link waiting for the owner. Replace it with a new one, or let the owner use it.',
        { openSubscriptionIds: ids },
      );
    }
    for (const s of live) {
      await this.cashfree.cancelSubscription(s.subscriptionId); // a provider refusal aborts: never leave two live mandates
      await this.prisma.registrationSubscription.updateMany({ where: { id: s.id, status: 'INITIALIZED' }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
    }
  }

  /** Staff cancel. Idempotent: an already closed mandate is returned as it is. */
  async cancel(registrationId: string, id: string, now = new Date()): Promise<SubscriptionView> {
    const row = await this.rowOrThrow(registrationId, id);
    if (TERMINAL.has(row.status)) return toSubscriptionView({ ...row, charges: await this.recentCharges(row.id) });
    await this.cashfree.cancelSubscription(row.subscriptionId);
    await this.prisma.registrationSubscription.updateMany({ where: { id: row.id, status: { notIn: [...TERMINAL] } }, data: { status: 'CANCELLED', cancelledAt: now } });
    logger.child({ registrationId, subscriptionId: row.subscriptionId }).info('autopay mandate cancelled by staff');
    return this.view(row.id);
  }

  /** Ask Cashfree how the mandate is doing (for when a webhook is late) and apply the answer like a webhook. */
  async refresh(registrationId: string, id: string): Promise<{ outcome: SubscriptionEventOutcome; subscription: SubscriptionView }> {
    const row = await this.rowOrThrow(registrationId, id);
    const remote = await this.cashfree.getSubscription(row.subscriptionId);
    const outcome = await this.applyEvent({ kind: 'status', subscriptionId: row.subscriptionId, status: remote.status });
    return { outcome, subscription: await this.view(row.id) };
  }

  /** The owner's authorisation page asks for the checkout session. Public: the random token is the proof. */
  async checkout(token: string, environment: 'sandbox' | 'production'): Promise<CheckoutAnswer> {
    const row = await this.prisma.registrationSubscription.findUnique({ where: { authToken: token }, include: { registration: true } });
    if (!row) throw new NotFoundError('This AutoPay link is not valid.');
    if (!subscriptionsFlag()) throw new PaymentsNotConfiguredError('AutoPay is not available right now.');
    if (row.status !== 'INITIALIZED') return { state: TERMINAL.has(row.status) ? 'closed' : 'authorised' };
    const remote = await this.cashfree.getSubscription(row.subscriptionId);
    if (remote.status !== 'INITIALIZED') {
      await this.applyEvent({ kind: 'status', subscriptionId: row.subscriptionId, status: remote.status });
      return { state: TERMINAL.has(remote.status) ? 'closed' : 'authorised' };
    }
    if (!remote.sessionId) throw new ValidationError('AutoPay could not be started. Please ask us for a new link.');
    return {
      state: 'ready',
      sessionId: remote.sessionId,
      environment,
      restaurantName: row.registration.restaurantName,
      planName: (row.quote as { planName?: string } | null)?.planName ?? row.planKey,
      amountPaise: row.amountPaise,
    };
  }

  /**
   * Applies a verified subscription webhook. Idempotent (Cashfree retries; events can arrive out of order):
   *  - status: moves the mandate forward; a terminal status is never left.
   *  - payment: recorded once per cf_payment_id. A monthly debit whose amount differs from the quote is flagged
   *    AMOUNT_MISMATCH for a human. The first successful monthly debit counts as the owner having paid (a PAID
   *    payment row, so "Create restaurant account" is unlocked and the request becomes QUALIFIED).
   */
  async applyEvent(event: SubscriptionEvent, now = new Date()): Promise<SubscriptionEventOutcome> {
    const sub = await this.prisma.registrationSubscription.findUnique({ where: { subscriptionId: event.subscriptionId } });
    if (!sub) return 'ignored';
    const log = logger.child({ subscriptionId: sub.subscriptionId, registrationId: sub.registrationId });

    if (event.kind === 'status') {
      if (TERMINAL.has(sub.status) || sub.status === event.status) return 'duplicate';
      const data: Prisma.RegistrationSubscriptionUpdateManyMutationInput = { status: event.status };
      if (event.status === 'ACTIVE' && !sub.activatedAt) data.activatedAt = now;
      if (event.status === 'CANCELLED' || event.status === 'CUSTOMER_CANCELLED') data.cancelledAt = now;
      const res = await this.prisma.registrationSubscription.updateMany({ where: { id: sub.id, status: sub.status }, data });
      if (res.count > 0) log.info(`autopay status ${event.status}`);
      return res.count > 0 ? 'updated' : 'duplicate';
    }

    const paidPaise = event.amountRupees === null ? null : Math.round(event.amountRupees * 100);
    const mismatch = event.success && event.paymentType === 'CHARGE' && paidPaise !== sub.amountPaise;
    const status = !event.success ? 'FAILED' : mismatch ? 'AMOUNT_MISMATCH' : 'SUCCESS';
    try {
      await this.prisma.registrationSubscriptionCharge.create({
        data: {
          subscriptionRowId: sub.id,
          cfPaymentId: event.cfPaymentId,
          kind: event.paymentType,
          status,
          amountPaise: paidPaise ?? 0,
          failureReason: event.failureReason,
          occurredAt: event.occurredAt,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return 'duplicate';
      throw err;
    }
    await this.prisma.registrationSubscription.update({ where: { id: sub.id }, data: { lastChargeStatus: status, lastChargeAt: event.occurredAt } });
    if (mismatch) {
      log.warn(`autopay amount mismatch: expected ${sub.amountPaise}, event says ${paidPaise}`);
      return 'amount-mismatch';
    }
    if (event.success && event.paymentType === 'CHARGE') {
      const paidAt = event.occurredAt ?? now;
      const first = await this.recordFirstPayment(sub, paidPaise ?? sub.amountPaise, event, now);
      const registrationId = sub.registrationId;
      if (first) {
        // The first debit is the payment that unlocks the account: create it after the response.
        const auto = this.autoProvision;
        if (auto) afterResponse('auto-provision', () => auto.autoProvision(registrationId));
      } else {
        // A later monthly debit: the client is paid up for another month (a no-op until their business exists).
        const billing = this.billing;
        if (billing) afterResponse('extend-paid-until', () => billing.extendPaidUntil(registrationId, paidAt, 'monthly'));
      }
    }
    return 'updated';
  }

  /** The first successful monthly debit makes the request "paid" the same way a paid payment link does. */
  private async recordFirstPayment(sub: RegistrationSubscription, paidPaise: number, event: Extract<SubscriptionEvent, { kind: 'payment' }>, now: Date): Promise<boolean> {
    const already = await this.prisma.registrationPayment.count({ where: { registrationId: sub.registrationId, status: 'PAID' } });
    if (already > 0) return false;
    const quote = sub.quote as { description?: string } | null;
    await this.prisma.registrationPayment.create({
      data: {
        registrationId: sub.registrationId,
        linkId: `autopay-${event.cfPaymentId}`.slice(0, 50),
        linkUrl: '',
        amountPaise: sub.amountPaise,
        purpose: quote?.description ?? 'Manhar Nexus monthly (UPI AutoPay)',
        status: 'PAID',
        paidAmountPaise: paidPaise,
        providerOrderId: event.cfPaymentId,
        paidAt: event.occurredAt ?? now,
        createdBy: 'autopay-webhook',
        planKey: sub.planKey,
        billingCycle: 'monthly',
        quote: sub.quote as Prisma.InputJsonValue,
        source: 'AUTOPAY',
      },
    });
    await this.prisma.registrationRequest.updateMany({ where: { id: sub.registrationId, status: { in: ['NEW', 'CONTACTED'] } }, data: { status: 'QUALIFIED' } });
    return true;
  }

  private recentCharges(rowId: string) {
    return this.prisma.registrationSubscriptionCharge.findMany({ where: { subscriptionRowId: rowId }, orderBy: { occurredAt: 'desc' }, take: 3 });
  }

  private async view(id: string): Promise<SubscriptionView> {
    const row = await this.prisma.registrationSubscription.findUniqueOrThrow({ where: { id }, include: WITH_CHARGES });
    return toSubscriptionView(row);
  }

  private async rowOrThrow(registrationId: string, id: string): Promise<RegistrationSubscription> {
    const row = await this.prisma.registrationSubscription.findUnique({ where: { id } });
    if (!row || row.registrationId !== registrationId) throw new NotFoundError('AutoPay mandate not found');
    return row;
  }

  private async registrationOrThrow(id: string) {
    const reg = await this.prisma.registrationRequest.findUnique({ where: { id } });
    if (!reg) throw new NotFoundError('Registration request not found');
    return reg;
  }
}

/** The same day next month (clamped to the month's end), so a first-month payment pushes the first debit out. */
function addMonth(d: Date): Date {
  const out = new Date(d.getTime());
  const day = out.getUTCDate();
  out.setUTCDate(1);
  out.setUTCMonth(out.getUTCMonth() + 1);
  const last = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(day, last));
  return out;
}
