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

/** What needs a person right now, so a customer who paid is never left without an account unnoticed. */
@Controller('internal/provisioning')
export class AttentionController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('attention')
  @RequirePermission('platform.registration.view')
  async attention(): Promise<{ total: number; items: AttentionItem[] }> {
    const open = { in: ['NEW', 'CONTACTED', 'QUALIFIED'] as ('NEW' | 'CONTACTED' | 'QUALIFIED')[] };
    const [failed, paid, mismatch, closed] = await Promise.all([
      this.prisma.registrationProvisioning.findMany({
        where: { status: 'FAILED', registration: { status: open } },
        select: { lastError: true, registration: { select: { id: true, referenceCode: true, restaurantName: true } } },
        take: 50,
      }),
      // Paid in full but no finished account: manual plans (Many Doors, typed amounts), or an auto run that has not happened yet.
      this.prisma.registrationRequest.findMany({
        where: { status: open, payments: { some: { status: 'PAID' } }, OR: [{ provisioning: null }, { provisioning: { status: { not: 'DONE' } } }] },
        select: { id: true, referenceCode: true, restaurantName: true, provisioning: { select: { status: true } } },
        take: 50,
      }),
      this.prisma.registrationRequest.findMany({
        where: { status: open, payments: { some: { status: 'AMOUNT_MISMATCH' } } },
        select: { id: true, referenceCode: true, restaurantName: true },
        take: 50,
      }),
      // Money arrived on a request marked spam or rejected, or marked converted with no restaurant behind it: nobody must miss that.
      this.prisma.registrationRequest.findMany({
        where: {
          payments: { some: { status: 'PAID' } },
          OR: [{ status: { in: ['SPAM', 'REJECTED'] } }, { status: 'CONVERTED', businessId: null }],
        },
        select: { id: true, referenceCode: true, restaurantName: true },
        take: 50,
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
    return { total: items.length, items };
  }
}
