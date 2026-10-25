import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { reportsApi, formatMinorUnits, type DailyClosingReport } from '../reports/api';
import { PageHeader } from '../ui/PageHeader';
import { StatCard } from '../ui/StatCard';
import { Panel } from '../ui/Panel';
import { ErrorState, Skeleton } from '../ui/states';

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const REPORT_ROLES = new Set(['owner', 'location-manager']);
// Mirror the AppShell nav gating so a role never sees a link it cannot open.
const FULL_ACCESS_ROLES = new Set(['owner', 'location-manager', 'platform-admin']);
const TABLE_ROLES = new Set(['owner', 'location-manager', 'checkout-associate', 'service-team', 'host']);
const KITCHEN_ROLES = new Set(['owner', 'location-manager', 'kitchen-team', 'service-team']);

export function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canSeeSales = user?.realm !== 'PLATFORM' && (user?.roles ?? []).some((r) => REPORT_ROLES.has(r.key));
  const roles = user?.roles ?? [];
  const isPlatform = user?.realm === 'PLATFORM';
  const has = (allowed: Set<string>) => roles.some((r) => allowed.has(r.key));
  const isFullAccess = has(FULL_ACCESS_ROLES);
  const links = [
    { to: '/tables', label: t('shell.nav.tables'), show: isPlatform || has(TABLE_ROLES) },
    { to: '/kitchen', label: t('shell.nav.kitchen'), show: isPlatform || has(KITCHEN_ROLES) },
    { to: '/reports', label: t('shell.nav.reports'), show: isFullAccess },
    { to: '/costs', label: t('shell.nav.costs'), show: isPlatform || isFullAccess },
    { to: '/activity', label: t('shell.nav.activity'), show: isFullAccess },
  ].filter((l) => l.show);
  const [report, setReport] = useState<DailyClosingReport | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(canSeeSales);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    reportsApi
      .daily(todayIso())
      .then(setReport)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (canSeeSales) load();
  }, [canSeeSales, load]);

  const name = user?.displayName ?? user?.email ?? '';
  const linkClass = 'inline-flex min-h-11 items-center rounded-control bg-sunken px-4 hover:bg-line';

  return (
    <>
      <PageHeader title={t('home.greeting', { name })} description={t('home.subtitle')} />
      {canSeeSales && (
        <section aria-labelledby="today-h" className="mb-8">
          <h2 id="today-h" className="mb-3 text-lg font-semibold">
            {t('home.today')}
          </h2>
          <div role="status" aria-live="polite" className="sr-only">
            {loading ? t('home.loading') : ''}
          </div>
          {loading && (
            <div aria-hidden className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          )}
          {failed && <ErrorState title={t('home.loadError')} onRetry={load} retryLabel={t('modules.retry')} />}
          {report && !loading && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label={t('home.netRevenue')} value={formatMinorUnits(report.netRevenueMinorUnits)} />
              <StatCard label={t('home.paidInvoices')} value={report.paidInvoiceCount} />
              <StatCard label={t('home.served')} value={report.servedOrderCount} />
              <StatCard
                label={t('home.refunds')}
                value={formatMinorUnits(report.totalRefundedMinorUnits)}
                note={t('home.refundCount', { count: report.refundCount })}
              />
            </div>
          )}
        </section>
      )}
      {links.length > 0 && (
        <Panel>
          <h2 className="text-lg font-semibold">{t('home.quickLinks')}</h2>
          <p className="mt-1 text-sm text-muted">{t('home.quickLinksBody')}</p>
          <nav aria-label={t('home.quickLinks')} className="mt-4 flex flex-wrap gap-3 text-sm font-medium">
            {links.map((l) => (
              <Link key={l.to} className={linkClass} to={l.to}>
                {l.label}
              </Link>
            ))}
          </nav>
        </Panel>
      )}
    </>
  );
}
