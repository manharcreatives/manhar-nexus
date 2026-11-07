import { Controller, Get } from '@nestjs/common';
import { RequirePermission } from '../iam/principal';
import { PrismaService } from '../prisma/prisma.service';

export interface AttentionItem {
  registrationId: string;
  referenceCode: string;
  restaurantName: string;
  reason: 'PROVISIONING_FAILED' | 'PAID_NOT_CREATED' | 'AMOUNT_MISMATCH' | 'PAID_ON_CLOSED_REQUEST';
  detail: string | null;
}

const LIST_CAP = 100;

/** What needs a person right now, so a customer who paid is never left without an account unnoticed. */
@Controller('internal/provisioning')
export class AttentionController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('attention')
  @RequirePermission('platform.registration.view')
  async attention(): Promise<{ total: number; items: AttentionItem[] }> {
    const open = { in: ['NEW', 'CONTACTED', 'QUALIFIED'] as ('NEW' | 'CONTACTED' | 'QUALIFIED')[] };
    // Each list is capped (the page only needs the first screenful) but `total` is the real number of open cases.
    const failedWhere = { status: 'FAILED', registration: { status: open } };
    const paidWhere = {
      status: open,
      payments: { some: { status: 'PAID' } },
      OR: [{ provisioning: null }, { provisioning: { status: { not: 'DONE' } } }],
    };
    const mismatchWhere = { status: open, payments: { some: { status: 'AMOUNT_MISMATCH' } } };
    const closedWhere = {
      payments: { some: { status: 'PAID' } },
      OR: [{ status: { in: ['SPAM', 'REJECTED'] } }, { status: 'CONVERTED', businessId: null }],
    };
    const [failedCount, paidCount, mismatchCount, closedCount] = await Promise.all([
      this.prisma.registrationProvisioning.count({ where: failedWhere }),
      this.prisma.registrationRequest.count({ where: paidWhere as never }),
      this.prisma.registrationRequest.count({ where: mismatchWhere as never }),
      this.prisma.registrationRequest.count({ where: closedWhere as never }),
    ]);
    const [failed, paid, mismatch, closed] = await Promise.all([
      this.prisma.registrationProvisioning.findMany({
        where: failedWhere,
        select: { lastError: true, registration: { select: { id: true, referenceCode: true, restaurantName: true } } },
        orderBy: { updatedAt: 'desc' },
        take: LIST_CAP,
      }),
      // Paid in full but no finished account: manual plans (Many Doors, typed amounts), or an auto run that has not happened yet.
      this.prisma.registrationRequest.findMany({
        where: paidWhere as never,
        select: { id: true, referenceCode: true, restaurantName: true, provisioning: { select: { status: true } } },
        orderBy: { updatedAt: 'desc' },
        take: LIST_CAP,
      }),
      this.prisma.registrationRequest.findMany({
        where: mismatchWhere as never,
        select: { id: true, referenceCode: true, restaurantName: true },
        orderBy: { updatedAt: 'desc' },
        take: LIST_CAP,
      }),
      // Money arrived on a request marked spam or rejected, or marked converted with no restaurant behind it: nobody must miss that.
      this.prisma.registrationRequest.findMany({
        where: closedWhere as never,
        select: { id: true, referenceCode: true, restaurantName: true },
        orderBy: { updatedAt: 'desc' },
        take: LIST_CAP,
      }),
    ]);
    const items: AttentionItem[] = [];
    const seen = new Set<string>();
    for (const f of failed) {
      seen.add(f.registration.id);
      items.push({ registrationId: f.registration.id, referenceCode: f.registration.referenceCode, restaurantName: f.registration.restaurantName, reason: 'PROVISIONING_FAILED', detail: f.lastError });
    }
    for (const r of paid) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      items.push({ registrationId: r.id, referenceCode: r.referenceCode, restaurantName: r.restaurantName, reason: 'PAID_NOT_CREATED', detail: null });
    }
    for (const r of mismatch) {
      if (seen.has(r.id)) continue;
      items.push({ registrationId: r.id, referenceCode: r.referenceCode, restaurantName: r.restaurantName, reason: 'AMOUNT_MISMATCH', detail: null });
    }
    for (const r of closed) {
      if (seen.has(r.id)) continue;
      items.push({ registrationId: r.id, referenceCode: r.referenceCode, restaurantName: r.restaurantName, reason: 'PAID_ON_CLOSED_REQUEST', detail: null });
    }
    // A request can sit in two lists; the real total is bounded by the per-list counts and never below what we show.
    return { total: Math.max(items.length, failedCount + paidCount + mismatchCount + closedCount - (failed.length + paid.length + mismatch.length + closed.length - items.length)), items };
  }
}
