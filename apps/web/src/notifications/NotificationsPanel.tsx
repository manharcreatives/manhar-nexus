import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { notificationsApi, type AlertNotification } from './api';

export function NotificationsPanel() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = () => {
    setLoading(true);
    notificationsApi.list({ take: 20 })
      .then((r) => { setNotifications(r.notifications); setTotalUnread(r.totalUnread); })
      .catch(() => {})
      .finally(() => { setLoading(false); });
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => { document.removeEventListener('mousedown', handler); };
  }, []);

  const markRead = (id: string) => {
    notificationsApi.markRead(id)
      .then(() => {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
        );
        setTotalUnread((c) => Math.max(0, c - 1));
      })
      .catch(() => {});
  };

  const markAllRead = () => {
    notificationsApi.markAllRead()
      .then(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setTotalUnread(0);
      })
      .catch(() => {});
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); if (!open) load(); }}
        className="relative rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
      >
        {t('shell.alerts')}
        {totalUnread > 0 && (
          <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-slate-900">{t('notifications.title')}</span>
            {totalUnread > 0 && (
              <button type="button" onClick={markAllRead} className="text-xs text-blue-600 hover:underline">
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <p className="px-4 py-6 text-center text-sm text-slate-500">{t('notifications.loading')}</p>
            )}
            {!loading && notifications.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-slate-500">{t('notifications.empty')}</p>
            )}
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`border-b border-slate-50 px-4 py-3 ${n.isRead ? '' : 'bg-blue-50'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{n.title}</p>
                    <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">{n.body}</p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!n.isRead && (
                    <button
                      type="button"
                      onClick={() => markRead(n.id)}
                      className="shrink-0 h-2 w-2 rounded-full bg-blue-500 mt-1.5"
                      title="Mark as read"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
