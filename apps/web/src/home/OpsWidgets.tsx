import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { diningApi, kitchenApi } from '../restaurant/api';
import { costsApi } from '../costs/api';
import { notificationsApi } from '../notifications/api';
import { resolveDeepLink } from '../notifications/NotificationsPanel';
import { InlineBar } from '../charts/InlineBar';
import { Skeleton } from '../ui/states';
import { cn } from '../lib/cn';
import { formatElapsed } from '../restaurant/time';
import { KITCHEN_LATE_MINS, kitchenLoad, pendingApprovals, tableLoad } from './derive';
import { useWidget, type WidgetState } from './useWidget';
import { InlineError } from './InlineError';
import { SectionHeader } from '../ui/SectionHeader';
import { LedgerFigure } from '../ui/LedgerFigure';
import * as Icons from '../ui/icons';

/** One ledger row: label, a figure, a line of context, and an optional way in. */
function Row<T>({
  id,
  label,
  state,
  children,
  link,
}: {
  id: string;
  label: string;
  state: WidgetState<T>;
  children: (data: T) => ReactNode;
  link?: { to: string; label: string } | null;
}) {
  const { t } = useTranslation();
  if (state.hidden) return null;
  return (
    <li className="border-b border-line py-5 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={id} className="eyebrow">
          {label}
        </h3>
        {link && state.data !== null && (
          <Link to={link.to} className="group -my-2 inline-flex min-h-11 items-center gap-0.5 text-sm font-medium text-accent hover:text-accent-strong">
            {link.label}
            <Icons.ChevronRight aria-hidden className="size-4 transition-transform duration-(--duration-micro) group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
      {state.loading && state.data === null && (
        <div aria-hidden className="mt-2 space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      )}
      {state.error && state.data === null && <InlineError title={t('home.widgetError')} onRetry={state.reload} className="mt-2" />}
      {state.data !== null && <div className="mt-1">{children(state.data)}</div>}
      {state.loading && state.data === null && <span className="sr-only">{t('home.loading')}</span>}
    </li>
  );
}

const Figure = ({ children, tone }: { children: ReactNode; tone?: 'warn' | 'bad' }) => (
  <p className={cn('tabular font-display text-[2rem] leading-tight font-semibold tracking-[-0.02em]', tone === 'warn' && 'text-warn', tone === 'bad' && 'text-bad')}>
    {children}
  </p>
);
const Context = ({ children }: { children: ReactNode }) => <p className="mt-0.5 text-sm text-muted">{children}</p>;

/** Re-renders every 30s so "oldest wait" ages between refreshes. */
function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export interface OpsAccess {
  tables: boolean;
  kitchen: boolean;
  expenses: boolean;
  alerts: boolean;
  /** Page-level nav gating, so a row never links to a page the shell hides. */
  links: { tables: boolean; kitchen: boolean; costs: boolean };
}

export function OpsWidgets({ access, locationId, className }: { access: OpsAccess; locationId: string | null; className?: string }) {
  const { t } = useTranslation();
  const now = useNow();

  // The tables endpoint has no location filter; narrow client-side to the chosen location.
  const tablesFn = useCallback(
    () => diningApi.listTables().then((rows) => (locationId ? rows.filter((r) => r.locationId === locationId) : rows)),
    [locationId],
  );
  const kitchenFn = useCallback(() => kitchenApi.queue(locationId ?? undefined), [locationId]);
  const expensesFn = useCallback(
    () => costsApi.listExpenses({ status: 'PENDING_APPROVAL', ...(locationId ? { locationId } : {}) }),
    [locationId],
  );
  const alertsFn = useCallback(() => notificationsApi.list({ unreadOnly: true, take: 3 }), []);

  const tables = useWidget(access.tables ? tablesFn : null, 60_000);
  const kitchen = useWidget(access.kitchen ? kitchenFn : null, 30_000);
  const expenses = useWidget(access.expenses ? expensesFn : null, 5 * 60_000);
  const alerts = useWidget(access.alerts ? alertsFn : null, 60_000);

  const anyVisible = [tables, kitchen, expenses, alerts].some((w) => !w.hidden);
  if (!anyVisible) return null;

  return (
    <section aria-labelledby="ops-h" className={className}>
      <SectionHeader
        id="ops-h"
        title={t('home.rightNow')}
        eyebrow={
          <>
            <span aria-hidden className="nx-live-dot size-1.5 rounded-full bg-accent" />
            {t('home.live')}
          </>
        }
      />
      <ul className="mt-1">
        <Row
          id="ops-tables"
          label={t('home.tables')}
          state={tables}
          link={access.links.tables ? { to: '/tables', label: t('home.openFloor') } : null}
        >
          {(rows) => {
            const l = tableLoad(rows);
            if (l.total === 0) return <Context>{t('home.noTables')}</Context>;
            return (
              <>
                <Figure>
                  {l.occupied}
                  <span className="text-xl text-muted"> / {l.total}</span>
                </Figure>
                <InlineBar value={l.occupied} max={l.total} highlight className="mt-2 max-w-56" />
                <Context>
                  {t('home.tablesOccupied', { count: l.occupied })}
                  {l.cleaning > 0 && ` · ${t('home.tablesCleaning', { count: l.cleaning })}`}
                </Context>
              </>
            );
          }}
        </Row>
        <Row
          id="ops-kitchen"
          label={t('home.kitchen')}
          state={kitchen}
          link={access.links.kitchen ? { to: '/kitchen', label: t('home.openKitchen') } : null}
        >
          {(queue) => {
            const k = kitchenLoad(queue, now);
            const late = k.oldestMins !== null && k.oldestMins >= KITCHEN_LATE_MINS;
            return (
              <>
                <Figure tone={late ? 'warn' : undefined}>{k.waiting}</Figure>
                <Context>
                  {k.waiting === 0
                    ? t('home.kitchenClear')
                    : t('home.kitchenWaiting', { count: k.waiting, time: formatElapsed(k.oldestMins ?? 0, t) })}
                  {k.ready > 0 && ` · ${t('home.kitchenReady', { count: k.ready })}`}
                </Context>
                {late && <p className="mt-1 text-sm font-medium text-warn">{t('home.kitchenLate', { mins: KITCHEN_LATE_MINS })}</p>}
              </>
            );
          }}
        </Row>
        <Row
          id="ops-approvals"
          label={t('home.approvals')}
          state={expenses}
          link={access.links.costs ? { to: '/costs', label: t('home.review') } : null}
        >
          {(rows) => {
            const p = pendingApprovals(rows);
            return p.count === 0 ? (
              <>
                <Figure>0</Figure>
                <Context>{t('home.approvalsNone')}</Context>
              </>
            ) : (
              <>
                <Figure>
                  <LedgerFigure minor={p.totalMinor} />
                </Figure>
                <Context>{t('home.approvalsPending', { count: p.count })}</Context>
              </>
            );
          }}
        </Row>
        <Row id="ops-alerts" label={t('home.alerts')} state={alerts}>
          {(res) => (
            <>
              <Figure tone={res.totalUnread > 0 ? 'bad' : undefined}>{res.totalUnread}</Figure>
              <Context>{res.totalUnread === 0 ? t('home.alertsNone') : t('home.alertsUnread', { count: res.totalUnread })}</Context>
              {res.notifications.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {res.notifications.map((n) => {
                    const to = resolveDeepLink(n.resourceUrl);
                    return (
                      <li key={n.id} className="truncate">
                        {to ? (
                          <Link to={to} className="hover:text-accent">
                            {n.title}
                          </Link>
                        ) : (
                          n.title
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </Row>
      </ul>
    </section>
  );
}
