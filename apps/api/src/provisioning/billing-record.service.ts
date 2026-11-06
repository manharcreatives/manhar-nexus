import { isPricedPlan } from '@nexus/shared';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** paidAt + one month or one year (calendar arithmetic in UTC, clamped to the end of a shorter month). */
export function paidUntilFor(paidAt: Date, cycle: string): Date {
  const months = cycle === 'yearly' ? 12 : 1;
  const d = new Date(paidAt.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/** How a payment row says it was made, in the words the client record uses. */
export function billingSourceOf(paymentSource: string | null | undefined): 'LINK' | 'AUTOPAY' | 'MANUAL' {
  if (paymentSource === 'AUTOPAY') return 'AUTOPAY';
  if (paymentSource === 'STAFF' || paymentSource === 'CUSTOMER') return 'LINK';
  return 'MANUAL';
}

/** What the client record (Business) says about what the client pays for and until when. */
@Injectable()
export class BillingRecordService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Called by the provisioning "commercial" step: copies plan, cycle, how they pay, the registration link and the paid
   * until date onto the business, from the registration's paid payment (or marks it MANUAL for a free pilot).
   */
  async recordForBusiness(businessId: string, registrationId: string): Promise<void> {
    const [reg, paid, sub] = await Promise.all([
      this.prisma.registrationRequest.findUnique({ where: { id: registrationId }, select: { planKey: true, billingCycle: true } }),
      this.prisma.registrationPayment.findFirst({ where: { registrationId, status: 'PAID' }, orderBy: { paidAt: 'desc' } }),
      this.prisma.registrationSubscription.findFirst({
        where: { registrationId, status: { notIn: ['CANCELLED', 'CUSTOMER_CANCELLED', 'EXPIRED', 'LINK_EXPIRED'] } },
        orderBy: { createdAt: 'desc' },
        select: { subscriptionId: true },
      }),
    ]);
    const planKey = paid?.planKey ?? (reg && isPricedPlan(reg.planKey) ? reg.planKey : null);
    const billingCycle = paid?.billingCycle ?? (reg && planKey ? reg.billingCycle : null);
    await this.prisma.business.update({
      where: { id: businessId },
      data: {
        planKey,
        billingCycle,
        billingSource: paid ? billingSourceOf(paid.source) : 'MANUAL',
        registrationId,
        subscriptionId: sub?.subscriptionId ?? null,
        ...(paid?.paidAt && billingCycle ? { paidUntil: paidUntilFor(paid.paidAt, billingCycle) } : {}),
      },
    });
  }

  /**
   * A payment (the first one, or an AutoPay debit) was received: the client is paid up to paidAt + one period. Never
   * moves the date backwards and is idempotent for the same input, so a retried webhook changes nothing. Does nothing
   * until the business exists (the commercial step then reads the payment itself).
   */
  async extendPaidUntil(registrationId: string, paidAt: Date, cycle: string): Promise<void> {
    const biz = await this.prisma.business.findUnique({ where: { registrationId }, select: { id: true, paidUntil: true } });
    if (!biz) return;
    const next = paidUntilFor(paidAt, cycle);
    if (biz.paidUntil && biz.paidUntil.getTime() >= next.getTime()) return;
    await this.prisma.business.updateMany({
      where: { id: biz.id, OR: [{ paidUntil: null }, { paidUntil: { lt: next } }] },
      data: { paidUntil: next },
    });
  }
}
