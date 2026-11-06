import { PRICED_PLAN_KEYS, isPricedPlan } from '@nexus/shared';
import { Injectable } from '@nestjs/common';
import type { RegistrationPayment } from '@prisma/client';
import type { ActorContext } from '../common/tenant-scope';
import { logger } from '../logging/logger';
import { PrismaService } from '../prisma/prisma.service';
import { TRANSIENT_FAILURE_MESSAGE } from './provisioning.dto';
import { RegistrationProvisioningService } from './registration-provisioning.service';

export const AUTO_ACTOR: ActorContext = { type: 'SYSTEM', label: 'auto-provision' };
const OPEN_STATUSES: ('NEW' | 'CONTACTED' | 'QUALIFIED')[] = ['NEW', 'CONTACTED', 'QUALIFIED'];
/** A run that has not touched its lock for this long crashed; the cron may take it over. */
const STALE_MS = 2 * 60_000;

export type AutoProvisionOutcome = 'created' | 'resumed' | 'failed' | 'skipped';

/**
 * A payment is exactly what it claims only when Cashfree reported the full quoted amount for a fixed-price plan.
 * Typed (override) amounts, mismatches, Many Doors and "not sure" stay with a person.
 */
export function isAutoEligiblePayment(p: Pick<RegistrationPayment, 'status' | 'paidAmountPaise' | 'amountPaise' | 'planKey'>): boolean {
  return p.status === 'PAID' && p.paidAmountPaise !== null && p.paidAmountPaise === p.amountPaise && p.planKey !== null && isPricedPlan(p.planKey);
}

/**
 * Turns a verified payment into a restaurant account with no human in the loop. It runs the same resumable job staff
 * use, so a retry (webhook retry, "Check payment", the cron, a double click) can never create a second business.
 * It never throws: the caller is a webhook that must still answer 200.
 */
@Injectable()
export class AutoProvisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provisioning: RegistrationProvisioningService,
  ) {}

  async autoProvision(registrationId: string, now = new Date()): Promise<AutoProvisionOutcome> {
    try {
      const reg = await this.prisma.registrationRequest.findUnique({ where: { id: registrationId } });
      if (!reg || !(OPEN_STATUSES as string[]).includes(reg.status)) return 'skipped';
      const payments = await this.prisma.registrationPayment.findMany({ where: { registrationId, status: 'PAID' } });
      if (!payments.some(isAutoEligiblePayment)) return 'skipped';

      const job = await this.prisma.registrationProvisioning.findUnique({ where: { registrationId } });
      if (job?.status === 'DONE') return 'skipped';

      const view = await this.provisioning.run(AUTO_ACTOR, registrationId, { commercialStatus: 'ACTIVE' }, now, { auto: true });
      if (view.status === 'FAILED') {
        logger.child({ registrationId, step: view.failedStep }).warn('auto-provisioning stopped; staff attention needed');
        return 'failed';
      }
      return job ? 'resumed' : 'created';
    } catch (err) {
      // 409 = another run is in progress (or just finished): that run does the work.
      if ((err as { httpStatus?: number }).httpStatus !== 409) {
        logger.child({ registrationId }).error({ err }, 'auto-provisioning crashed');
      }
      return 'skipped';
    }
  }

  /**
   * One cron tick: registrations that are paid (eligibly) but not converted and have no job, a crashed job, or a job that
   * failed for an unexplained reason. Jobs that failed with a clear refusal (an email that already has an account) wait for
   * staff, because retrying them blindly would loop forever.
   */
  async runPending(limit = 3, now = new Date()): Promise<{ attempted: number; outcomes: Record<AutoProvisionOutcome, number> }> {
    const stale = new Date(now.getTime() - STALE_MS);
    const candidates = await this.prisma.registrationRequest.findMany({
      where: {
        status: { in: OPEN_STATUSES },
        payments: { some: { status: 'PAID', planKey: { in: [...PRICED_PLAN_KEYS] } } },
        OR: [
          { provisioning: null },
          { provisioning: { status: 'RUNNING', OR: [{ lockedAt: null }, { lockedAt: { lt: stale } }] } },
          { provisioning: { status: 'FAILED', lastError: TRANSIENT_FAILURE_MESSAGE } },
        ],
      },
      orderBy: { updatedAt: 'asc' },
      take: 20,
      select: { id: true },
    });
    const outcomes: Record<AutoProvisionOutcome, number> = { created: 0, resumed: 0, failed: 0, skipped: 0 };
    let attempted = 0;
    for (const c of candidates) {
      if (attempted >= limit) break;
      const outcome = await this.autoProvision(c.id, now);
      outcomes[outcome] += 1;
      if (outcome !== 'skipped') attempted += 1;
    }
    return { attempted, outcomes };
  }
}
