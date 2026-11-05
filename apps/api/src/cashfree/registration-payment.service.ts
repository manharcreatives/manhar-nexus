import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { RegistrationPayment } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../common/errors';
import type { ActorContext } from '../common/tenant-scope';
import { logger } from '../logging/logger';
import { PrismaService } from '../prisma/prisma.service';
import { CashfreeClient } from './cashfree.client';
import type { CreatePaymentLinkDto, PaymentLinkView } from './cashfree.dto';
import type { LinkEvent } from './cashfree.events';

/** A request in one of these states is not a customer we are selling to. */
const NOT_PAYABLE = new Set(['CONVERTED', 'SPAM', 'REJECTED']);
const LINK_VALID_DAYS = 7;
const DAY_MS = 86_400_000;

export type LinkEventOutcome = 'ignored' | 'updated' | 'duplicate' | 'amount-mismatch';

export function toPaymentView(row: RegistrationPayment): PaymentLinkView {
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
  ) {}

  async list(registrationId: string): Promise<PaymentLinkView[]> {
    await this.registrationOrThrow(registrationId);
    const rows = await this.prisma.registrationPayment.findMany({
      where: { registrationId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toPaymentView);
  }

  async createLink(actor: ActorContext, registrationId: string, dto: CreatePaymentLinkDto, now = new Date()): Promise<PaymentLinkView> {
    const reg = await this.registrationOrThrow(registrationId);
    if (NOT_PAYABLE.has(reg.status)) {
      throw new ValidationError(`Cannot take payment for a ${reg.status.toLowerCase()} request`, { status: reg.status });
    }
    if ((await this.prisma.registrationPayment.count({ where: { registrationId, status: 'PAID' } })) > 0) {
      throw new ConflictError('This request has already been paid. Create the restaurant account instead.');
    }
    // Fail fast with a clear 503 when the keys are missing, before touching anything else.
    this.cashfree.config();

    const amountPaise = Math.round(dto.amountRupees * 100);
    const linkId = `${reg.referenceCode}-${randomBytes(4).toString('hex')}`;
    const expiresAt = new Date(now.getTime() + LINK_VALID_DAYS * DAY_MS);
    const link = await this.cashfree.createLink({
      linkId,
      amountPaise,
      purpose: dto.purpose,
      customer: { name: reg.contactName, email: reg.email, phone: reg.phone.replace(/\D/g, '').slice(-10) },
      expiresAt,
    });
    const row = await this.prisma.registrationPayment.create({
      data: {
        registrationId,
        linkId,
        cfLinkId: link.cfLinkId,
        linkUrl: link.linkUrl,
        amountPaise,
        purpose: dto.purpose,
        expiresAt,
        createdBy: actor.id ?? actor.label,
      },
    });
    logger.child({ registrationId, linkId, amountPaise }).info('payment link created');
    return toPaymentView(row);
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

  private async registrationOrThrow(id: string) {
    const reg = await this.prisma.registrationRequest.findUnique({ where: { id } });
    if (!reg) throw new NotFoundError('Registration request not found');
    return reg;
  }
}
