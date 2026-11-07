import { createHash } from 'node:crypto';
import { QuoteError, quotePlan } from '@nexus/shared';
import { Injectable, Optional } from '@nestjs/common';
import type { Prisma, RegistrationRequest } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../common/errors';
import type { ActorContext } from '../common/tenant-scope';
import { logger } from '../logging/logger';
import { PrismaService } from '../prisma/prisma.service';
import { AutoProvisionService } from '../provisioning/auto-provision.service';
import { afterResponse } from './after-response';
import type { PaymentLinkView } from './cashfree.dto';
import type { AcceptMismatchDto, ManualPaymentDto } from './manual-payment.dto';
import { toPaymentView } from './registration-payment.service';

/** A request in one of these states is not a customer we are selling to. */
const CLOSED = new Set(['SPAM', 'REJECTED']);

/**
 * Money that arrived outside the Cashfree link flow: a UPI or bank transfer staff recorded, and a link payment whose
 * amount did not match ("accept as paid"). Both end in a PAID row that starts the same automatic account creation.
 *
 * Every write is one short transaction under a per-request advisory lock that uses only `tx` (the pooled production
 * database allows a single connection per instance). Nothing here calls the network.
 */
@Injectable()
export class ManualPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly autoProvision?: AutoProvisionService,
  ) {}

  /** Staff record a payment received outside Cashfree. 409 when the request is already paid or already has an account. */
  async record(actor: ActorContext, registrationId: string, dto: ManualPaymentDto, now = new Date()): Promise<PaymentLinkView> {
    const reg = await this.registrationOrThrow(registrationId);
    this.assertPayable(reg);

    let quote;
    try {
      quote = quotePlan({ planKey: dto.planKey, cycle: dto.cycle, offerDate: reg.createdAt, launchPack: dto.launchPack === true });
    } catch (err) {
      if (err instanceof QuoteError) throw new ValidationError(err.message);
      throw err;
    }
    const typedPaise = dto.amountRupees !== undefined ? Math.round(dto.amountRupees * 100) : null;
    const differs = typedPaise !== null && typedPaise !== quote.totalPaise;
    if (differs && dto.overrideReason === undefined) {
      throw new ValidationError('The amount differs from the plan price. Say why (overrideReason).', { quotedPaise: quote.totalPaise });
    }
    const amountPaise = differs ? (typedPaise as number) : quote.totalPaise;
    const paidAt = dto.paidOn ? new Date(dto.paidOn) : now;
    // The same reference twice is the same payment: a double click lands on the unique id and answers 409.
    const refHash = createHash('sha256').update(`${registrationId}|${dto.reference.toLowerCase()}`).digest('hex').slice(0, 10);
    const linkId = `MAN-${reg.referenceCode}-${refHash}`.slice(0, 50);
    const manual = { method: dto.method, reference: dto.reference, paidOn: paidAt.toISOString(), recordedBy: actor.id ?? actor.label };
    const quoteJson: Prisma.InputJsonValue = differs
      ? { override: { reason: dto.overrideReason as string }, quotedTotalPaise: quote.totalPaise, manual }
      : { ...(JSON.parse(JSON.stringify(quote)) as Record<string, unknown>), manual } as Prisma.InputJsonValue;

    const row = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${registrationId}))`;
        const fresh = await tx.registrationRequest.findUnique({ where: { id: registrationId }, select: { status: true, businessId: true } });
        if (!fresh) throw new NotFoundError('Registration request not found');
        if (fresh.status === 'CONVERTED' || fresh.businessId) throw new ConflictError('This request already has a restaurant account.');
        if (CLOSED.has(fresh.status)) throw new ValidationError(`Cannot take payment for a ${fresh.status.toLowerCase()} request`, { status: fresh.status });
        if ((await tx.registrationPayment.count({ where: { registrationId, status: 'PAID' } })) > 0) {
          throw new ConflictError('This request has already been paid. Create or check the restaurant account instead.');
        }
        const created = await tx.registrationPayment.create({
          data: {
            registrationId,
            linkId,
            linkUrl: '',
            amountPaise,
            purpose: `Manual payment (${dto.method}) for ${quote.description}`.slice(0, 250),
            status: 'PAID',
            paidAmountPaise: amountPaise,
            paidAt,
            createdBy: actor.id ?? actor.label,
            planKey: quote.planKey,
            billingCycle: quote.cycle,
            quote: quoteJson,
            source: 'MANUAL',
          },
        });
        await tx.registrationRequest.updateMany({ where: { id: registrationId, status: { in: ['NEW', 'CONTACTED'] } }, data: { status: 'QUALIFIED' } });
        return created;
      },
      { timeout: 15_000, maxWait: 10_000 },
    ).catch((err: unknown) => {
      // The unique link id: the same reference was recorded a moment ago (a double click).
      if ((err as { code?: string }).code === 'P2002') throw new ConflictError('This payment reference was already recorded for this request.');
      throw err;
    });

    // The per-business activity history cannot hold this yet (no business exists); the structured log is the record.
    logger.child({ registrationId, paymentId: row.id }).info({ method: dto.method, amountPaise, override: differs, actor: actor.id ?? actor.label }, 'manual payment recorded');
    this.provisionAfterResponse(registrationId);
    return toPaymentView(row);
  }

  /** Staff accept a link payment whose amount did not match what was quoted; the reason is kept with the payment. */
  async acceptMismatch(actor: ActorContext, registrationId: string, paymentId: string, dto: AcceptMismatchDto, now = new Date()): Promise<PaymentLinkView> {
    const reg = await this.registrationOrThrow(registrationId);
    this.assertPayable(reg);
    const payment = await this.prisma.registrationPayment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.registrationId !== registrationId) throw new NotFoundError('Payment not found');
    if (payment.status !== 'AMOUNT_MISMATCH') {
      throw new ConflictError('Only a payment flagged "amount does not match" can be accepted.', { status: payment.status });
    }
    if (payment.paidAmountPaise === null) {
      throw new ConflictError('Cashfree did not report how much was paid. Check the payment in the Cashfree dashboard first.');
    }

    const accepted = { reason: dto.reason, by: actor.id ?? actor.label, at: now.toISOString(), quotedPaise: payment.amountPaise, paidPaise: payment.paidAmountPaise };
    const base = typeof payment.quote === 'object' && payment.quote !== null && !Array.isArray(payment.quote) ? (payment.quote as Record<string, unknown>) : {};
    const row = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${registrationId}))`;
        if ((await tx.registrationPayment.count({ where: { registrationId, status: 'PAID' } })) > 0) {
          throw new ConflictError('This request has already been paid. Create or check the restaurant account instead.');
        }
        // Compare-and-set on the status we validated: two staff clicking at once accept it only once.
        const res = await tx.registrationPayment.updateMany({
          where: { id: paymentId, registrationId, status: 'AMOUNT_MISMATCH' },
          data: { status: 'PAID', paidAt: now, quote: { ...base, accepted } as Prisma.InputJsonValue },
        });
        if (res.count === 0) throw new ConflictError('This payment was already handled by someone else. Reload the page.');
        await tx.registrationRequest.updateMany({ where: { id: registrationId, status: { in: ['NEW', 'CONTACTED'] } }, data: { status: 'QUALIFIED' } });
        return tx.registrationPayment.findUniqueOrThrow({ where: { id: paymentId } });
      },
      { timeout: 15_000, maxWait: 10_000 },
    );
    logger.child({ registrationId, paymentId }).info({ actor: actor.id ?? actor.label, quotedPaise: accepted.quotedPaise, paidPaise: accepted.paidPaise }, 'amount mismatch accepted as paid');
    this.provisionAfterResponse(registrationId);
    return toPaymentView(row);
  }

  /** Never throws and never delays the caller: a lost run is picked up by Check payment, the cron or the claim page. */
  private provisionAfterResponse(registrationId: string): void {
    const auto = this.autoProvision;
    if (!auto) return;
    afterResponse('auto-provision', () => auto.autoProvision(registrationId));
  }

  private assertPayable(reg: Pick<RegistrationRequest, 'status' | 'businessId'>): void {
    if (CLOSED.has(reg.status)) throw new ValidationError(`Cannot take payment for a ${reg.status.toLowerCase()} request`, { status: reg.status });
    if (reg.status === 'CONVERTED' || reg.businessId) throw new ConflictError('This request already has a restaurant account.');
  }

  private async registrationOrThrow(id: string): Promise<RegistrationRequest> {
    const reg = await this.prisma.registrationRequest.findUnique({ where: { id } });
    if (!reg) throw new NotFoundError('Registration request not found');
    return reg;
  }
}
