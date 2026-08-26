import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentPrincipal, RequirePermission } from '../../iam/principal';
import type { Principal } from '../../iam/principal';
import { zodBody } from '../../common/zod-validation.pipe';
import { NotificationService } from './notification.service';
import { listNotificationsSchema, type ListNotificationsQuery } from './notification.dto';

/**
 * Phase 11 — In-app notifications (business realm, current user only).
 * Users can only view and mark their own notifications — authorization is
 * identity-based (userId from JWT) rather than RBAC-based, though the
 * core.notification.view permission must still be present.
 */
@Controller('admin/notifications')
@RequirePermission('core.notification.view')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  /** List the current user's notifications, newest first. */
  @Get()
  list(
    @CurrentPrincipal() principal: Principal,
    @Query(zodBody(listNotificationsSchema)) q: ListNotificationsQuery,
  ) {
    if (!principal.businessId) throw new Error('Business context required');
    return this.notifications.list(principal.businessId, principal.userId, q);
  }

  /** Mark a single notification as read. */
  @Patch(':id/read')
  markRead(
    @CurrentPrincipal() principal: Principal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    if (!principal.businessId) throw new Error('Business context required');
    return this.notifications.markRead(principal.businessId, principal.userId, id);
  }

  /** Mark all current user's notifications as read. */
  @Post('read-all')
  @HttpCode(200)
  markAllRead(@CurrentPrincipal() principal: Principal) {
    if (!principal.businessId) throw new Error('Business context required');
    return this.notifications.markAllRead(principal.businessId, principal.userId);
  }
}
