import { useCallback, useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/states';
import { notificationsApi, type AlertNotification } from './api';
import { useLiveRefresh } from '../realtime/RealtimeProvider';

const ROUTES = ['tables', 'kitchen', 'reports', 'activity', 'costs', 'config', 'modules'];

/** Returns an in-app path for a notification's resourceUrl, or null if it is not a known page. */
export function resolveDeepLink(resourceUrl: string | null): string | null {
  if (!resourceUrl) return null;
  let path = resourceUrl;
  if (/^[a-z][a-z0-9+.-]*:/i.test(resourceUrl)) {
    try {
      const u = new URL(resourceUrl);
      if (u.origin !== window.location.origin) return null;
      path = u.pathname + u.search;
    } catch {
      return null;
    }
  }
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  const first = path.split(/[/?#]/)[1];
  return ROUTES.includes(first) ? path : null;
}

function NotificationItem({
  n,
  onOpen,
  onMarkRead,
}: {
  n: AlertNotification;
  onOpen: (n: AlertNotification, link: string) => void;
  onMarkRead: (n: AlertNotification) => void;
}) {
  const { t, i18n } = useTranslation();
  const link = resolveDeepLink(n.resourceUrl);
  const content = (
    <>
      <span className="block text-sm font-medium break-words">{n.title}</span>
      <span className="mt-0.5 block text-sm text-muted break-words">{n.body}</span>
      <span className="tabular mt-1 block text-xs text-muted">
        {new Date(n.createdAt).toLocaleString(i18n.language)}
      </span>
    </>
  );
  return (
    <li className={`flex items-start gap-1 border-b border-line/60 last:border-b-0 ${n.isRead ? '' : 'bg-accent-soft/40'}`}>
      {link ? (
        <button
          type="button"
          aria-label={t('notifications.openItem', { title: n.title })}
          title={t('notifications.linkHint')}
          onClick={() => onOpen(n, link)}
          className="min-h-11 min-w-0 flex-1 px-4 py-3 text-left hover:bg-sunken"
        >
          {content}
        </button>
      ) : (
        <div className="min-h-11 min-w-0 flex-1 px-4 py-3">{content}</div>
      )}
      {!n.isRead && (
        <button
          type="button"
          aria-label={t('notifications.markReadLabel', { title: n.title })}
          title={t('notifications.markRead')}
          onClick={() => onMarkRead(n)}
          className="flex size-11 shrink-0 items-center justify-center rounded-control hover:bg-sunken"
        >
          <span aria-hidden className="size-2.5 rounded-full bg-accent" />
        </button>
      )}
    </li>
  );
}

export function NotificationsPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadSeq = useRef(0);
  const hasData = useRef(false);
  const load = useCallback((background = false) => {
    const id = ++loadSeq.current;
    if (!background) {
      setLoading(true);
      setLoadFailed(false);
    }
    notificationsApi
      .list({ take: 20 })
      .then((r) => {
        if (id !== loadSeq.current) return;
        hasData.current = true;
        setNotifications(r.notifications);
        setTotalUnread(r.totalUnread);
        setLoadFailed(false);
      })
      // A failed live refresh keeps the last good list instead of showing an error.
      .catch(() => {
        if (id === loadSeq.current && (!background || !hasData.current)) setLoadFailed(true);
      })
      .finally(() => {
        if (id === loadSeq.current) setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Live: a new notification updates the bell without a refresh (plus a slow safety-net poll).
  useLiveRefresh(['notifications'], () => load(true));

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      close(true);
    }
  }

  function onBlur(e: FocusEvent) {
    if (open && e.relatedTarget && !wrapRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
  }

  function toggle() {
    if (!open) {
      setActionError(false);
      load();
    }
    setOpen((o) => !o);
  }

  const markRead = (n: AlertNotification) => {
    setActionError(false);
    notificationsApi
      .markRead(n.id)
      .then(() => {
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
        setTotalUnread((c) => Math.max(0, c - 1));
      })
      .catch(() => setActionError(true));
  };

  const markAllRead = () => {
    if (markingAll) return;
    setMarkingAll(true);
    setActionError(false);
    notificationsApi
      .markAllRead()
      .then(() => {
        setNotifications((prev) => prev.map((x) => ({ ...x, isRead: true })));
        setTotalUnread(0);
      })
      .catch(() => setActionError(true))
      .finally(() => setMarkingAll(false));
  };

  const openItem = (n: AlertNotification, link: string) => {
    if (!n.isRead) markRead(n);
    close(false);
    navigate(link);
  };

  const unread = notifications.filter((n) => !n.isRead);
  const earlier = notifications.filter((n) => n.isRead);
  const panelId = 'notifications-panel';

  return (
    <div className="relative" ref={wrapRef} onKeyDown={onKeyDown} onBlur={onBlur}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={totalUnread > 0 ? t('notifications.ariaLabel', { count: totalUnread }) : t('notifications.ariaLabelNone')}
        onClick={toggle}
        className="inline-flex min-h-11 items-center gap-2 rounded-control border border-white/10 bg-white/[0.04] px-3 text-sm text-ink hover:border-accent/40 hover:bg-white/[0.07]"
      >
        <span aria-hidden>{t('shell.alerts')}</span>
        {totalUnread > 0 && (
          <span
            aria-hidden
            className="tabular inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-medium text-surface"
          >
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          ref={panelRef}
          role="dialog"
          aria-label={t('notifications.panelLabel')}
          tabIndex={-1}
          className="fixed inset-x-4 top-16 z-50 nx-pop rounded-panel sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
            <h2 className="text-base font-semibold">
              {t('notifications.title')}
              {totalUnread > 0 && (
                <span className="ml-2 text-sm font-normal text-muted">{t('notifications.unreadCount', { count: totalUnread })}</span>
              )}
            </h2>
            {totalUnread > 0 && (
              <Button variant="ghost" loading={markingAll} onClick={markAllRead} className="text-accent-strong">
                {t('notifications.markAllRead')}
              </Button>
            )}
          </div>

          <div aria-live="polite" className="max-h-[70vh] overflow-y-auto sm:max-h-96">
            {actionError && (
              <p role="alert" className="border-b border-line bg-bad-soft px-4 py-2 text-sm text-bad">
                {t('notifications.markFailed')}
              </p>
            )}
            {loading && notifications.length === 0 && (
              <div role="status" aria-label={t('notifications.loading')} className="space-y-2 p-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            )}
            {loadFailed && !loading && (
              <div role="alert" className="px-4 py-6 text-center">
                <p className="text-sm text-bad">{t('notifications.loadError')}</p>
                <Button variant="secondary" className="mt-3" onClick={() => load()}>
                  {t('notifications.retry')}
                </Button>
              </div>
            )}
            {!loading && !loadFailed && notifications.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-medium">{t('notifications.empty')}</p>
                <p className="mt-1 text-sm text-muted">{t('notifications.emptyBody')}</p>
              </div>
            )}
            {unread.length > 0 && (
              <section aria-labelledby="notif-unread">
                <h3 id="notif-unread" className="bg-sunken/60 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-muted">
                  {t('notifications.sectionUnread')}
                </h3>
                <ul>
                  {unread.map((n) => (
                    <NotificationItem key={n.id} n={n} onOpen={openItem} onMarkRead={markRead} />
                  ))}
                </ul>
              </section>
            )}
            {earlier.length > 0 && (
              <section aria-labelledby="notif-earlier">
                <h3 id="notif-earlier" className="bg-sunken/60 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-muted">
                  {t('notifications.sectionEarlier')}
                </h3>
                <ul>
                  {earlier.map((n) => (
                    <NotificationItem key={n.id} n={n} onOpen={openItem} onMarkRead={markRead} />
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
