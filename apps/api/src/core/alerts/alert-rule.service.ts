import { Injectable } from '@nestjs/common';
import { Prisma, type AlertRule } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConflictError, NotFoundError, VersionConflictError } from '../../common/errors';
import { TenantScopedRepository } from '../../common/tenant-scoped.repository';
import type { TenantScope } from '../../common/tenant-scope';
import type { CreateAlertRuleDto, UpdateAlertRuleDto } from './alert-rule.dto';

/**
 * Alert-rule registry — Phase 6.
 * Stores per-business "if event X fires, notify role Y via channel Z" rules.
 * Actual delivery (in-app notification dispatch) is Phase 11 scope.
 */
@Injectable()
export class AlertRuleService extends TenantScopedRepository {
  constructor(
    prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    super(prisma);
  }

  async list(scope: TenantScope): Promise<AlertRule[]> {
    return this.prisma.alertRule.findMany({
      where: { businessId: scope.businessId },
      orderBy: [{ eventKey: 'asc' }, { targetRoleKey: 'asc' }],
    });
  }

  async findByIdOrThrow(scope: TenantScope, id: string): Promise<AlertRule> {
    const rule = await this.prisma.alertRule.findFirst({
      where: { id, businessId: scope.businessId },
    });
    if (!rule) throw new NotFoundError('Alert rule not found', { id });
    return rule;
  }

  async create(scope: TenantScope, dto: CreateAlertRuleDto): Promise<AlertRule> {
    const existing = await this.prisma.alertRule.findFirst({
      where: {
        businessId: scope.businessId,
        eventKey: dto.eventKey,
        targetRoleKey: dto.targetRoleKey,
        channel: dto.channel,
      },
    });
    if (existing) {
      throw new ConflictError('Alert rule already exists for this event/role/channel combination', {
        eventKey: dto.eventKey,
        targetRoleKey: dto.targetRoleKey,
        channel: dto.channel,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      let rule: Awaited<ReturnType<typeof tx.alertRule.create>>;
      try {
        rule = await tx.alertRule.create({
          data: {
            businessId: scope.businessId,
            eventKey: dto.eventKey,
            targetRoleKey: dto.targetRoleKey,
            channel: dto.channel,
            enabled: dto.enabled,
          },
        });
      } catch (e) {
        // Concurrent create race: the findFirst check above is outside the
        // transaction, so two identical requests can both pass it and race
        // to insert the same (businessId, eventKey, targetRoleKey, channel) row.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new ConflictError('Alert rule already exists for this event/role/channel combination', {
            eventKey: dto.eventKey,
            targetRoleKey: dto.targetRoleKey,
            channel: dto.channel,
          });
        }
        throw e;
      }
      await this.audit.append(tx, scope, {
        action: 'alert_rule.created',
        resourceType: 'alert_rule',
        resourceId: rule.id,
        metadata: { eventKey: dto.eventKey, targetRoleKey: dto.targetRoleKey, channel: dto.channel },
      });
      return rule;
    });
  }

  async update(scope: TenantScope, id: string, dto: UpdateAlertRuleDto): Promise<AlertRule> {
    const rule = await this.findByIdOrThrow(scope, id);

    if (dto.expectedVersion !== undefined && dto.expectedVersion !== rule.version) {
      throw new VersionConflictError('Alert rule was modified concurrently', {
        expectedVersion: dto.expectedVersion,
        actualVersion: rule.version,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.alertRule.update({
        where: { id: rule.id },
        data: { enabled: dto.enabled, version: rule.version + 1 },
      });
      await this.audit.append(tx, scope, {
        action: 'alert_rule.updated',
        resourceType: 'alert_rule',
        resourceId: updated.id,
        metadata: { enabled: dto.enabled, from: rule.enabled, to: dto.enabled },
      });
      return updated;
    });
  }

  async remove(scope: TenantScope, id: string): Promise<void> {
    const rule = await this.findByIdOrThrow(scope, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.alertRule.delete({ where: { id: rule.id } });
      await this.audit.append(tx, scope, {
        action: 'alert_rule.deleted',
        resourceType: 'alert_rule',
        resourceId: rule.id,
        metadata: { eventKey: rule.eventKey, targetRoleKey: rule.targetRoleKey },
      });
    });
  }

  /** Called by the event bus (Phase 11): get enabled rules for an event. */
  async getRulesForEvent(businessId: string, eventKey: string): Promise<AlertRule[]> {
    return this.prisma.alertRule.findMany({
      where: { businessId, eventKey, enabled: true },
    });
  }
}
