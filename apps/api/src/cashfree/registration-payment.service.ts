import { randomBytes } from 'node:crypto';
import { QuoteError, quotePlan, type Quote } from '@nexus/shared';
import { Injectable, Optional } from '@nestjs/common';
import type { Prisma, RegistrationPayment } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../common/errors';
import type { ActorContext } from '../common/tenant-scope';
import { logger } from '../logging/logger';
import { PrismaService } from '../prisma/prisma.service';
import { AutoProvisionService } from '../provisioning/auto-provision.service';
import { afterResponse } from './after-response';
import { CashfreeClient } from './cashfree.client';
import type { BreakdownLine, CreatePaymentLinkDto, PaymentLinkView } from './cashfree.dto';
import type { LinkEvent } from './cashfree.events';

/** A request in one of these states is not a customer we are selling to. */
const NOT_PAYABLE = new Set(['CONVERTED', 'SPAM', 'REJECTED']);
const LINK_VALID_DAYS = 7;
const DAY_MS = 86_400_000;

/** Who started the link: Manhar staff from the admin page, or the owner themselves ("Pay now"). */
export type PaymentSource = 'STAFF' | 'CUSTOMER';

export type LinkEventOutcome = 'ignored' | 'updated' | 'duplicate' | 'amount-mismatch';

/** The stored quote JSON is either a Quote (lines, GST, flags) or { override: { reason } } for a typed amount. */
function readQuote(json: unknown): { breakdown: BreakdownLine[] | null; overrideReason: string | null } {
  if (typeof json !== 'object' || json === null) return { breakdown: null, overrideReason: null };
  const q = json as { lines?: unknown; override?: { reason?: unknown } };
  const breakdown = Array.isArray(q.lines)
    ? (q.lines as BreakdownLine[]).filter((l) => typeof l?.label === 'string' && typeof l?.amountPaise === 'number')
    : null;
  const reason = q.override && typeof q.override.reason === 'string' ? q.override.reason : null;
  return { breakdown, overrideReason: reason };
}

export function toPaymentView(row: RegistrationPayment): PaymentLinkView {
  const { breakdown, overrideReason } = readQuote(row.quote);
  return {
    id: row.id,
    registrationId: row.registrationId,
    linkId: row.linkId,
    linkUrl: row.linkUrl,
    amountPaise: row.amountPaise,
    currency: row.currency,
    purpose: row.purpose,
    status: row.status,
    paidAmountPaise: row.paidAmountPaise,
    planKey: row.planKey,
    billingCycle: row.billingCycle,
    breakdown,
    overrideReason,
    source: row.source,
    expiresAt: row.expiresAt,
    paidAt: row.paidAt,
    createdAt: row.createdAt,
  };
}

/** The owner's subscription payment: a Cashfree payment link per registration request, settled by webhook. */
@Injectable()
export class RegistrationPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cashfree: CashfreeClient,
    @Optional() private readonly autoProvision?: AutoProvisionService,
  ) {}

  async list(registrationId: string): Promise<PaymentLinkView[]> {
    await this.registrationOrThrow(registrationId);
    const rows = await this.prisma.registrationPayment.findMany({
      where: { registrationId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toPaymentView);
  }

  async createLink(actor: ActorContext, registrationId: string, dto: CreatePaymentLinkDto, now = new Date(), source: PaymentSource = 'STAFF', payerSecretHash?: string): Promise<PaymentLinkView> {
    const reg = await this.registrationOrThrow(registrationId);
    if (NOT_PAYABLE.has(reg.status)) {
      throw new ValidationError(`Cannot take payment for a ${reg.status.toLowerCase()} request`, { status: reg.status });
    }
    if ((await this.prisma.registrationPayment.count({ where: { registrationId, status: 'PAID' } })) > 0) {
      throw new ConflictError('This request has already been paid. Create the restaurant account instead.');
    }
    // Fail fast with a clear 503 when the keys are missing, before touching anything else.
    this.cashfree.config();

    // What to charge: the server's own quote from the plan catalog, or a typed amount with a recorded reason.
    let amountPaise: number;
    let purpose: string;
    let planKey: string | null = null;
    let billingCycle: string | null = null;
    let quote: Prisma.InputJsonValue;
    if (dto.amountRupees !== undefined) {
      amountPaise = Math.round(dto.amountRupees * 100);
      purpose = 'Manhar Nexus subscription';
      quote = { override: { reason: dto.overrideReason ?? '' } };
    } else {
      const priced = this.priceRequest(reg, dto);
      amountPaise = priced.totalPaise;
      purpose = priced.description;
      planKey = priced.planKey;
      billingCycle = priced.cycle;
      quote = JSON.parse(JSON.stringify(priced)) as Prisma.InputJsonValue;
    }

    // One live link per request, so two links can never both be paid.
    await this.closeOpenLinks(registrationId, dto.replaceOpen === true, now);

    const linkId = `${reg.referenceCode}-${randomBytes(4).toString('hex')}`;
    const expiresAt = new Date(now.getTime() + LINK_VALID_DAYS * DAY_MS);
    const link = await this.cashfree.createLink({
      linkId,
      amountPaise,
      purpose,
      customer: { name: reg.contactName, email: reg.email, phone: reg.phone.replace(/\D/g, '').slice(-10) },
      expiresAt,
      // After paying on Cashfree the owner is sent back to our page, which finds their account link. Staff-made links
      // go out over WhatsApp, where nobody holds a payer secret, so only the owner's own link needs it.
      ...(source === 'CUSTOMER' ? this.returnUrlFor(reg.referenceCode) : {}),
    });
    const row = await this.prisma.registrationPayment.create({
      data: {
        registrationId,
        linkId,
        cfLinkId: link.cfLinkId,
        linkUrl: link.linkUrl,
        amountPaise,
        purpose,
        expiresAt,
        createdBy: actor.id ?? actor.label,
        planKey,
        billingCycle,
        quote,
        source,
        ...(payerSecretHash ? { payerSecretHash } : {}),
      },
    });
    logger.child({ registrationId, linkId, amountPaise, planKey, billingCycle }).info('payment link created');
    return toPaymentView(row);
  }

  /** Where Cashfree sends the owner after paying; nothing when the public base URL is not configured. */
  private returnUrlFor(referenceCode: string): { returnUrl?: string } {
    const base = process.env.QR_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '');
    return base ? { returnUrl: `${base}/pay/return?code=${encodeURIComponent(referenceCode)}` } : {};
  }

  /** The catalog price for a request: plan and cycle from the body, else from what the visitor chose. */
  private priceRequest(reg: { planKey: string; billingCycle: string; createdAt: Date }, dto: CreatePaymentLinkDto): Quote {
    try {
      return quotePlan({
        planKey: dto.planKey ?? reg.planKey,
        cycle: dto.cycle ?? reg.billingCycle,
        // The Founding offer is judged at the day they registered, so a lead keeps the price it signed up under.
        offerDate: reg.createdAt,
        launchPack: dto.launchPack === true,
      });
    } catch (err) {
      if (err instanceof QuoteError) throw new ValidationError(err.message, { needsPlan: true });
      throw err;
    }
  }

  /**
   * An open link (still CREATED and not expired) blocks a new one, unless staff chose to replace it. Replacing cancels
   * it at Cashfree FIRST; if Cashfree refuses (for instance it was just paid) we stop, because creating a second live
   * link next to an unpaid-looking one is how a customer gets charged twice.
   */
  private async closeOpenLinks(registrationId: string, replace: boolean, now: Date): Promise<void> {
    const open = await this.prisma.registrationPayment.findMany({
      where: { registrationId, status: 'CREATED', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    });
    if (open.length === 0) return;
    if (!replace) {
      throw new ConflictError(
        'This request already has an open payment link. Check its payment first, or replace it with a new one.',
        { openLinkIds: open.map((p) => p.id) },
      );
    }
    for (const p of open) {
      await this.cashfree.cancelLink(p.linkId);
      await this.prisma.registrationPayment.updateMany({ where: { id: p.id, status: 'CREATED' }, data: { status: 'CANCELLED' } });
    }
  }

  /**
   * Asks Cashfree directly how a link is doing and applies the answer exactly like a webhook would. Staff press
   * "Check payment" when a webhook is late or could not reach us; confirmed against the sandbox, where a paid link
   * reports link_status PAID and link_amount_paid.
   */
  async refresh(registrationId: string, paymentId: string, now = new Date()): Promise<{ outcome: LinkEventOutcome; payment: PaymentLinkView }> {
    const payment = await this.prisma.registrationPayment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.registrationId !== registrationId) throw new NotFoundError('Payment link not found');
    const link = await this.cashfree.getLink(payment.linkId);
    const orderId = link.status === 'PAID' ? await this.cashfree.getPaidOrderId(payment.linkId) : null;
    const outcome = await this.applyLinkEvent(
      { linkId: payment.linkId, linkStatus: link.status.toUpperCase(), amountPaidRupees: link.amountPaidRupees, orderId },
      now,
    );
    const fresh = await this.prisma.registrationPayment.findUnique({ where: { id: paymentId } });
    // Already paid before this check (a webhook got there first): its account creation may have been lost, so staff's
    // "Check payment" nudges it again. The job is idempotent and skips when the account already exists.
    if (outcome === 'duplicate' && fresh?.status === 'PAID') this.provisionAfterResponse(payment.registrationId);
    return { outcome, payment: toPaymentView(fresh ?? payment) };
  }

  /**
   * Applies a verified webhook event. Idempotent: Cashfree retries, and events can arrive out of order.
   *  - PAID is terminal and wins over anything else (money moved); repeats are "duplicate".
   *  - The amount actually paid must equal the link's amount, otherwise the link is flagged AMOUNT_MISMATCH for a
   *    human to look at and the request is NOT treated as paid.
   *  - EXPIRED / CANCELLED only apply to a link that is still CREATED.
   */
  async applyLinkEvent(event: LinkEvent, now = new Date()): Promise<LinkEventOutcome> {
    const payment = await this.prisma.registrationPayment.findUnique({ where: { linkId: event.linkId } });
    if (!payment) return 'ignored';
    const log = logger.child({ linkId: event.linkId, registrationId: payment.registrationId });

    if (event.linkStatus === 'PAID') {
      if (payment.status === 'PAID') return 'duplicate';
      const paidPaise = event.amountPaidRupees === null ? null : Math.round(event.amountPaidRupees * 100);
      if (paidPaise !== payment.amountPaise) {
        await this.prisma.registrationPayment.updateMany({
          where: { id: payment.id, status: { not: 'PAID' } },
          data: { status: 'AMOUNT_MISMATCH', paidAmountPaise: paidPaise, providerOrderId: event.orderId },
        });
        log.warn(`payment amount mismatch: expected ${payment.amountPaise}, event says ${paidPaise}`);
        return 'amount-mismatch';
      }
      // Compare-and-set on "not already paid" so two retries racing cannot both apply.
      const res = await this.prisma.registrationPayment.updateMany({
        where: { id: payment.id, status: { not: 'PAID' } },
        data: { status: 'PAID', paidAmountPaise: paidPaise, providerOrderId: event.orderId, paidAt: now },
      });
      if (res.count === 0) return 'duplicate';
      // Paid: the lead is as qualified as it gets. (Creating the restaurant stays a deliberate staff click.)
      await this.prisma.registrationRequest.updateMany({
        where: { id: payment.registrationId, status: { in: ['NEW', 'CONTACTED'] } },
        data: { status: 'QUALIFIED' },
      });
      log.info('payment received');
      // Exactly once per payment (the compare-and-set above won): create the restaurant account after the response.
      // A typed (override) amount has no plan, so a person decides what that payment buys.
      if (payment.planKey !== null) this.provisionAfterResponse(payment.registrationId);
      return 'updated';
    }

    if (event.linkStatus === 'EXPIRED' || event.linkStatus === 'CANCELLED') {
      const res = await this.prisma.registrationPayment.updateMany({
        where: { id: payment.id, status: 'CREATED' },
        data: { status: event.linkStatus },
      });
      return res.count > 0 ? 'updated' : 'duplicate';
    }

    return 'ignored'; // ACTIVE, PARTIALLY_PAID (links are created without partial payments), anything new
  }

  /** Never throws and never delays the caller (a webhook): a lost run is picked up by Check payment or the cron. */
  private provisionAfterResponse(registrationId: string): void {
    const auto = this.autoProvision;
    if (!auto) return;
    afterResponse('auto-provision', () => auto.autoProvision(registrationId));
  }

  private async registrationOrThrow(id: string) {
    const reg = await this.prisma.registrationRequest.findUnique({ where: { id } });
    if (!reg) throw new NotFoundError('Registration request not found');
    return reg;
  }
}
