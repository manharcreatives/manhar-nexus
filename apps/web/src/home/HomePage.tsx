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

export function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canSeeSales = user?.realm !== 'PLATFORM' && (user?.roles ?? []).some((r) => REPORT_ROLES.has(r.key));
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
          {loading && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
      <Panel>
        <h2 className="text-lg font-semibold">{t('home.quickLinks')}</h2>
        <p className="mt-1 text-sm text-muted">{t('home.quickLinksBody')}</p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-medium">
          <Link className={linkClass} to="/tables">{t('shell.nav.tables')}</Link>
          <Link className={linkClass} to="/kitchen">{t('shell.nav.kitchen')}</Link>
          <Link className={linkClass} to="/reports">{t('shell.nav.reports')}</Link>
        </div>
      </Panel>
    </>
  );
}
