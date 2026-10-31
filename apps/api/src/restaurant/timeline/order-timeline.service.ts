import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError } from '../../common/errors';
import { TenantScopedRepository } from '../../common/tenant-scoped.repository';
import type { TenantScope } from '../../common/tenant-scope';
import { canAccessLocation, type Principal } from '../../iam/principal';
import { buildOrderTimeline, type AuditRowLike, type OrderTimeline } from './order-timeline.util';

export interface OrderTimelineResponse extends OrderTimeline {
  order: {
    id: string;
    status: string;
    roundNumber: number;
    requestNumber: string | null;
    sentAt: string | null;
  };
  /** Server clock, so clients can show a running total without trusting their own clock. */
  serverTime: string;
}

/** Read model for the KOS "order timeline" popover. Reads Activity History; writes nothing. */
@Injectable()
export class OrderTimelineService extends TenantScopedRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async timeline(scope: TenantScope, principal: Principal, id: string): Promise<OrderTimelineResponse> {
    const request = await this.prisma.serviceRequest.findFirst({
      where: this.scoped(scope, { id }),
      select: {
        id: true,
        businessId: true,
        locationId: true,
        status: true,
        roundNumber: true,
        requestNumber: true,
        createdAt: true,
        sentAt: true,
        acceptedAt: true,
        preparedAt: true,
        servedAt: true,
      },
    });
    if (!request || !canAccessLocation(principal, request.locationId)) {
      throw new NotFoundError('Service request not found', { id });
    }
    this.assertOwned(request, scope);

    // Index (businessId, resourceType, resourceId) makes this a short range scan.
    const events = await this.prisma.auditEvent.findMany({
      where: { businessId: scope.businessId, resourceType: 'service_request', resourceId: id },
      orderBy: { sequence: 'asc' },
      take: 500,
      select: { id: true, sequence: true, action: true, actorType: true, actorId: true, actorLabel: true, metadata: true, createdAt: true },
    });

    const now = new Date();
    const timeline = buildOrderTimeline(events as AuditRowLike[], request, now);
    return {
      ...timeline,
      order: {
        id: request.id,
        status: request.status,
        roundNumber: request.roundNumber,
        requestNumber: request.requestNumber,
        sentAt: request.sentAt ? request.sentAt.toISOString() : null,
      },
      serverTime: now.toISOString(),
    };
  }
}
