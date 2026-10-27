import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeBus } from '../../realtime/realtime.bus';
import { AlertRuleService } from './alert-rule.service';

/** Payload for a dispatched event notification. */
export interface DispatchPayload {
  title: string;
  body: string;
  /** Optional deep-link shown in the notifications panel. */
  resourceUrl?: string;
}

/**
 * Best-effort in-app notification dispatcher (Phase 11).
 *
 * Called by services after a domain event occurs. Looks up enabled alert
 * rules for the (businessId, eventKey) pair, resolves the target users by
 * role, and writes AlertNotification rows for each recipient.
 *
 * IMPORTANT: dispatch() NEVER throws. A delivery failure must not propagate
 * to the caller's transaction or HTTP response. Errors are logged only.
 */
@Injectable()
export class AlertDispatcher {
  private readonly logger = new Logger(AlertDispatcher.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertRules: AlertRuleService,
    private readonly realtime: RealtimeBus,
  ) {}

  async dispatch(businessId: string, eventKey: string, payload: DispatchPayload): Promise<void> {
    try {
      const rules = await this.alertRules.getRulesForEvent(businessId, eventKey);
      if (rules.length === 0) return;

      for (const rule of rules) {
        const users = await this.findUsersWithRole(businessId, rule.targetRoleKey);
        if (users.length === 0) continue;

        await this.prisma.alertNotification.createMany({
          data: users.map((u) => ({
            businessId,
            userId: u.id,
            alertRuleId: rule.id,
            eventKey,
            title: payload.title,
            body: payload.body,
            resourceUrl: payload.resourceUrl ?? null,
          })),
          skipDuplicates: true,
        });
        this.realtime.emit(businessId, 'notifications');
      }
    } catch (err) {
      this.logger.error(
        { businessId, eventKey, err },
        'AlertDispatcher: failed to dispatch notifications',
      );
    }
  }

  private async findUsersWithRole(businessId: string, roleKey: string): Promise<{ id: string }[]> {
    return this.prisma.user.findMany({
      where: {
        businessId,
        status: 'ACTIVE',
        userRoles: {
          some: {
            role: {
              key: roleKey,
              OR: [{ businessId }, { businessId: null }],
            },
          },
        },
      },
      select: { id: true },
    });
  }
}
