import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listRegistrations } from './api';

/** How often to look again while the tab is open and visible. Modest on purpose: one tiny request a minute. */
export const NEW_REQUESTS_REFRESH_MS = 60_000;

/**
 * Count bubble on the "Registrations" sidebar entry: requests still marked NEW, so staff notice a fresh lead.
 * Uses the list endpoint with take=1 (the response carries the total), refreshes when the tab regains focus and
 * once a minute while visible, and renders nothing when there are none or when the call fails.
 */
export function NewRequestsNavBadge() {
  const { t } = useTranslation();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let live = true;
    const load = (): void => {
      if (document.visibilityState === 'hidden') return;
      listRegistrations({ status: 'NEW', take: 1 })
        .then((page) => {
          if (live) setCount(page.total);
        })
        .catch(() => undefined); // a failed refresh keeps the last count; it is only a hint
    };
    load();
    const timer = window.setInterval(load, NEW_REQUESTS_REFRESH_MS);
    window.addEventListener('focus', load);
    document.addEventListener('visibilitychange', load);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', load);
      document.removeEventListener('visibilitychange', load);
    };
  }, []);

  if (count <= 0) return null;
  return (
    <span
      aria-label={t('registrations.nav.badge', { count })}
      className="tabular ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-xs font-semibold text-on-accent shadow-[0_0_12px_rgb(var(--accent-rgb)/0.6)]"
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
