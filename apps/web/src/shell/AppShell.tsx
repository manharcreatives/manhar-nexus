import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_VERSION } from '@nexus/shared';
import { useAuth } from '../auth/AuthContext';
import { ModuleCenter } from '../modules/ModuleCenter';
import { ConfigCenter } from '../config/ConfigCenter';
import { ReportsPage } from '../reports/ReportsPage';
import { ActivityPage } from '../activity/ActivityPage';
import { NotificationsPanel } from '../notifications/NotificationsPanel';
import { CommercialPage } from '../commercial/CommercialPage';
import { OnboardingPage } from '../onboarding/OnboardingPage';
import { TablesPage } from '../restaurant/TablesPage';
import { KitchenPage } from '../restaurant/KitchenPage';
import { CostsPage } from '../costs/CostsPage';

type View = 'home' | 'modules' | 'config' | 'reports' | 'activity' | 'commercial' | 'onboarding' | 'tables' | 'kitchen' | 'costs';

function NavItem({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
        active
          ? 'bg-blue-50 font-medium text-blue-700'
          : 'text-slate-700 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}

export function AppShell() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const [view, setView] = useState<View>('home');

  return (
    <div className="flex h-screen w-full flex-col bg-slate-50 text-slate-900">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
        <div className="flex items-center gap-2">
          <span aria-hidden className="inline-block h-6 w-6 rounded-md bg-blue-700" />
          <span className="text-base font-semibold tracking-tight">{t('app.name')}</span>
        </div>
        <span className="hidden text-xs text-slate-500 sm:inline">{t('app.tagline')}</span>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            title={t('shell.comingSoon')}
            disabled
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-500"
          >
            {t('shell.businessSelector')}: {t('shell.businessSelectorEmpty')}
          </button>
          <button
            type="button"
            title={t('shell.comingSoon')}
            disabled
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-500"
          >
            {t('shell.locationSelector')}: {t('shell.locationSelectorEmpty')}
          </button>
          <NotificationsPanel />
          <div className="flex items-center gap-2 pl-1">
            <span className="text-sm text-slate-700" title={user?.email}>
              {user?.realm === 'PLATFORM' ? `${t('shell.platformRealm')} · ` : ''}
              {user?.displayName ?? user?.email}
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              {t('shell.signOut')}
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-60 shrink-0 border-r border-slate-200 bg-white p-4">
          <nav className="space-y-1">
            <NavItem label={t('shell.nav.home')} active={view === 'home'} onClick={() => setView('home')} />
            <NavItem label={t('shell.nav.modules')} active={view === 'modules'} onClick={() => setView('modules')} />
            <NavItem label={t('shell.nav.config')} active={view === 'config'} onClick={() => setView('config')} />
            <NavItem label={t('shell.nav.reports')} active={view === 'reports'} onClick={() => setView('reports')} />
            <NavItem label={t('shell.nav.activity')} active={view === 'activity'} onClick={() => setView('activity')} />
            <div className="pt-2 pb-1">
              <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {t('shell.nav.restaurant')}
              </p>
            </div>
            <NavItem label={t('shell.nav.tables')} active={view === 'tables'} onClick={() => setView('tables')} />
            <NavItem label={t('shell.nav.kitchen')} active={view === 'kitchen'} onClick={() => setView('kitchen')} />
            <div className="pt-2 pb-1">
              <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {t('shell.nav.operations')}
              </p>
            </div>
            <NavItem label={t('shell.nav.costs')} active={view === 'costs'} onClick={() => setView('costs')} />
            {user?.realm === 'PLATFORM' && (
              <>
                <div className="pt-2 pb-1">
                  <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {t('shell.nav.platform')}
                  </p>
                </div>
                <NavItem label={t('shell.nav.commercial')} active={view === 'commercial'} onClick={() => setView('commercial')} />
                <NavItem label={t('shell.nav.onboarding')} active={view === 'onboarding'} onClick={() => setView('onboarding')} />
              </>
            )}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 overflow-auto p-8">
          {view === 'home' && (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">{t('home.welcomeTitle')}</h1>
              <p className="mt-2 max-w-xl text-sm text-slate-600">{t('home.welcomeBody')}</p>
              <span className="mt-6 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                {t('home.phaseLabel')} · v{APP_VERSION}
              </span>
            </>
          )}
          {view === 'modules' && <ModuleCenter />}
          {view === 'config' && <ConfigCenter />}
          {view === 'reports' && <ReportsPage />}
          {view === 'activity' && <ActivityPage />}
          {view === 'commercial' && <CommercialPage />}
          {view === 'onboarding' && <OnboardingPage />}
          {view === 'tables' && <TablesPage />}
          {view === 'kitchen' && <KitchenPage />}
          {view === 'costs' && <CostsPage />}
        </main>
      </div>
    </div>
  );
}
