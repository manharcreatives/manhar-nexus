import { createHash, timingSafeEqual } from 'node:crypto';
import { isPricedPlan } from '@nexus/shared';
import { Injectable } from '@nestjs/common';
import type { RegistrationPayment, RegistrationRequest } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../common/errors';
import type { ActorContext } from '../common/tenant-scope';
import { logger } from '../logging/logger';
import { PrismaService } from '../prisma/prisma.service';
import { customerPayAvailable } from './customer-pay.config';
import type { CustomerLinkView, CustomerPayAnswer, CustomerPayDto, CustomerPayStatus } from './customer-pay.dto';
import { RegistrationPaymentService, toPaymentView } from './registration-payment.service';

const NOT_PAYABLE = new Set(['CONVERTED', 'SPAM', 'REJECTED']);
const CUSTOMER_ACTOR: ActorContext = { type: 'SYSTEM', label: 'customer-pay' };

/** One answer for "no such request" and "wrong email", so the endpoint cannot be used to find out which exists. */
const NOT_FOUND_MESSAGE = 'We could not find a request with that reference code and email.';

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

/**
 * The owner pays for their own request. The caller proves they own it with the reference code AND the email they
 * registered with; the price is only ever the server's quote for the plan on the request (the shared catalog), never
 * anything the browser sends. Every rule that protects staff-made links applies here too: one live link per request,
 * nothing for a spam/rejected/converted request, nothing once paid.
 */
@Injectable()
export class CustomerPayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: RegistrationPaymentService,
  ) {}

  /** Whether the "Pay now" button should be offered at all. */
  available(): boolean {
    return customerPayAvailable();
  }

  async pay(dto: CustomerPayDto, now = new Date()): Promise<CustomerPayAnswer> {
    this.requireAvailable();
    const reg = await this.verifiedRequest(dto);

    if (await this.paidLink(reg.id)) return { outcome: 'paid' };
    // Staff are handling it, or there is no fixed price to charge: a person quotes and sends the link.
    if (NOT_PAYABLE.has(reg.status) || !isPricedPlan(reg.planKey)) return { outcome: 'contact-us' };

    // Serialise per request across all API instances: a second tap waits here, then finds the first one's link.
    // (The lock only guards the check-then-create; the link itself is written through the normal client.)
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${reg.id}))`;
        return this.openOrCreate(reg, now);
      },
      { timeout: 30_000, maxWait: 10_000 },
    );
  }

  private async openOrCreate(reg: RegistrationRequest, now: Date): Promise<CustomerPayAnswer> {
    if (await this.paidLink(reg.id)) return { outcome: 'paid' };
    const open = await this.openLink(reg.id, now);
    if (open) return { outcome: 'link', link: this.linkView(open) };

    try {
      const created = await this.payments.createLink(CUSTOMER_ACTOR, reg.id, {}, now, 'CUSTOMER');
      logger.child({ registrationId: reg.id, source: 'CUSTOMER' }).info('customer started a payment');
      const row = await this.prisma.registrationPayment.findUniqueOrThrow({ where: { id: created.id } });
      return { outcome: 'link', link: this.linkView(row) };
    } catch (err) {
      // Belt and braces if the lock was ever bypassed: hand back the link that exists instead of failing.
      if (err instanceof ConflictError) {
        const raced = await this.openLink(reg.id, now);
        if (raced) return { outcome: 'link', link: this.linkView(raced) };
        if (await this.paidLink(reg.id)) return { outcome: 'paid' };
      }
      if (err instanceof ValidationError) return { outcome: 'contact-us' };
      throw err;
    }
  }

  /**
   * Paid or not, for the thank-you page. If a link is still open it asks Cashfree first (the webhook may be late),
   * and a Cashfree hiccup just means "not yet". Reveals nothing but the one boolean.
   */
  async status(dto: CustomerPayDto, now = new Date()): Promise<CustomerPayStatus> {
    this.requireAvailable();
    const reg = await this.verifiedRequest(dto);
    if (await this.paidLink(reg.id)) return { paid: true };
    const open = await this.openLink(reg.id, now);
    if (!open) return { paid: false };
    try {
      await this.payments.refresh(reg.id, open.id, now);
    } catch (err) {
      logger.child({ registrationId: reg.id }).warn(`customer payment check failed: ${(err as Error).name}`);
    }
    return { paid: (await this.paidLink(reg.id)) !== null };
  }

  private requireAvailable(): void {
    if (!this.available()) throw new NotFoundError('Online payment is not available yet. We will contact you with a payment link.');
  }

  /** The request, only when the email matches; otherwise the same 404 whether the code or the email was wrong. */
  private async verifiedRequest(dto: CustomerPayDto): Promise<RegistrationRequest> {
    const reg = await this.prisma.registrationRequest.findUnique({ where: { referenceCode: dto.referenceCode } });
    // Compare digests of equal length, and also when the code is unknown, so timing does not tell the cases apart.
    const same = timingSafeEqual(digest(dto.email), digest(reg?.email ?? ''));
    if (!reg || !same) throw new NotFoundError(NOT_FOUND_MESSAGE);
    return reg;
  }

  private paidLink(registrationId: string): Promise<RegistrationPayment | null> {
    return this.prisma.registrationPayment.findFirst({ where: { registrationId, status: 'PAID' } });
  }

  private openLink(registrationId: string, now: Date): Promise<RegistrationPayment | null> {
    return this.prisma.registrationPayment.findFirst({
      where: { registrationId, status: 'CREATED', OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: { createdAt: 'desc' },
    });
  }

  private linkView(row: RegistrationPayment): CustomerLinkView {
    const view = toPaymentView(row);
    return { linkUrl: view.linkUrl, amountPaise: view.amountPaise, purpose: view.purpose, breakdown: view.breakdown, expiresAt: view.expiresAt };
  }
}
