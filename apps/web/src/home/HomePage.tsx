import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { computeAccess } from '../shell/access';
import { PageHeader } from '../ui/PageHeader';
import { cn } from '../lib/cn';
import { useWorkLocation } from '../context/LocationContext';
import { Skeleton } from '../ui/states';
import { homeAccess } from './access';
import { RevenueHero } from './RevenueHero';
import { OpsWidgets } from './OpsWidgets';
import { PlatformHome } from './PlatformHome';
import { SetupChecklist } from './SetupChecklist';

function todayHeading(): string {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

/**
 * Owner dashboard. Editorial composition: one dominant figure (today's net
 * revenue) with its comparison and 7-day strip, and a ledger column of live
 * operations. Every block loads on its own and only for roles whose API
 * permissions allow it; a failure stays inside that block.
 */
export function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const nav = computeAccess(user);
  const home = homeAccess(user);
  const { locationId, location, status: locStatus } = useWorkLocation();
  const name = user?.displayName ?? user?.email ?? '';

  const actions = [
    { to: '/tables', label: t('home.action.tables'), show: nav.canSeeTables, primary: true },
    { to: '/bills', label: t('home.action.bills'), show: nav.canSeeBills },
    { to: '/kitchen', label: t('home.action.kitchen'), show: nav.canSeeKitchen },
    { to: '/costs', label: t('home.action.costs'), show: nav.canSeeCosts },
    { to: '/reports', label: t('home.action.reports'), show: nav.canSeeReports },
  ].filter((a) => a.show);

  const opsAccess = {
    tables: home.tables,
    kitchen: home.kitchen,
    expenses: home.expenses,
    alerts: home.alerts,
    links: { tables: nav.canSeeTables, kitchen: nav.canSeeKitchen, costs: nav.canSeeCosts },
  };
  const hasOps = home.tables || home.kitchen || home.expenses || home.alerts;

  return (
    <>
      <PageHeader
        eyebrow={location ? t('home.subtitleAt', { date: todayHeading(), location: location.name }) : todayHeading()}
        title={t('home.greeting', { name })}
        actions={
          actions.length > 0 ? (
            <nav aria-label={t('home.quickActions')} className="flex flex-wrap gap-2 text-sm font-medium">
              {actions.map((a) => (
                <Link
                  key={a.to}
                  to={a.to}
                  className={cn(
                    'nx-press inline-flex min-h-11 items-center gap-1.5 rounded-control px-4',
                    a.primary
                      ? 'nx-primary font-semibold text-[#04120a]'
                      : 'border border-white/10 bg-white/[0.04] hover:border-accent/40 hover:bg-white/[0.07]',
                  )}
                >
                  {a.label}
                </Link>
              ))}
            </nav>
          ) : undefined
        }
      />

      {nav.isTenantAdmin && <SetupChecklist />}

      {nav.isPlatform ? (
        <PlatformHome />
      ) : locStatus === 'loading' ? (
        <div aria-hidden className="space-y-4">
          <Skeleton className="h-16 w-3/4 max-w-sm" />
          <Skeleton className="h-40" />
        </div>
      ) : home.revenue ? (
        <div className="grid grid-cols-1 gap-x-14 gap-y-12 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-8">
            <RevenueHero withSeries={home.series} locationId={locationId} />
          </div>
          {hasOps && <OpsWidgets access={opsAccess} locationId={locationId} className="min-w-0 lg:col-span-4 lg:border-l lg:border-line lg:pl-10" />}
        </div>
      ) : hasOps ? (
        <OpsWidgets access={opsAccess} locationId={locationId} className="max-w-xl" />
      ) : (
        <p className="max-w-prose text-sm text-muted">{t('home.nothingYet')}</p>
      )}
    </>
  );
}
