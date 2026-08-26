import { api } from '../auth/api';

export interface AlertNotification {
  id: string;
  businessId: string;
  userId: string;
  alertRuleId: string | null;
  eventKey: string;
  title: string;
  body: string;
  resourceUrl: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: AlertNotification[];
  totalUnread: number;
}

export const notificationsApi = {
  list: (opts: { unreadOnly?: boolean; skip?: number; take?: number } = {}) => {
    const qs = new URLSearchParams();
    if (opts.unreadOnly) qs.set('unreadOnly', 'true');
    if (opts.skip) qs.set('skip', String(opts.skip));
    if (opts.take) qs.set('take', String(opts.take));
    const query = qs.toString();
    return api<NotificationsResponse>(`/admin/notifications${query ? `?${query}` : ''}`);
  },
  markRead: (id: string) =>
    api<AlertNotification>(`/admin/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () =>
    api<{ markedCount: number }>('/admin/notifications/read-all', { method: 'POST' }),
};
