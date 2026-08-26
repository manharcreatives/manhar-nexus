import { Injectable } from '@nestjs/common';
import type { AlertNotification } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError, ForbiddenError } from '../../common/errors';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  /** List notifications for the current user, newest first. */
  async list(
    businessId: string,
    userId: string,
    opts: { unreadOnly?: boolean; skip?: number; take?: number },
  ): Promise<{ notifications: AlertNotification[]; totalUnread: number }> {
    const where = {
      businessId,
      userId,
      ...(opts.unreadOnly ? { isRead: false } : {}),
    };

    const [notifications, totalUnread] = await Promise.all([
      this.prisma.alertNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: opts.skip ?? 0,
        take: Math.min(opts.take ?? 50, 100),
      }),
      this.prisma.alertNotification.count({
        where: { businessId, userId, isRead: false },
      }),
    ]);

    return { notifications, totalUnread };
  }

  /** Mark a single notification as read. Only the owning user may do this. */
  async markRead(businessId: string, userId: string, id: string): Promise<AlertNotification> {
    const notif = await this.prisma.alertNotification.findFirst({
      where: { id, businessId },
    });
    if (!notif) throw new NotFoundError('Notification not found', { id });
    if (notif.userId !== userId) throw new ForbiddenError('Cannot mark another user\'s notification as read');

    if (notif.isRead) return notif;

    return this.prisma.alertNotification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /** Mark all of the current user's notifications as read. */
  async markAllRead(businessId: string, userId: string): Promise<{ markedCount: number }> {
    const result = await this.prisma.alertNotification.updateMany({
      where: { businessId, userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { markedCount: result.count };
  }
}
