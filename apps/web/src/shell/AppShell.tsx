import { useEffect, useState, type ComponentType, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { brand } from '../lib/brand';
import { cn } from '../lib/cn';
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
import { HomePage } from '../home/HomePage';
import { BillsPage } from '../bills/BillsPage';
import { Button } from '../ui/Button';
import { PageHeader } from '../ui/PageHeader';
import { EmptyState } from '../ui/states';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import * as Icons from '../ui/icons';

// Role gating helpers (role keys from /auth/me). UI gating is convenience; the API is the boundary.
const FULL_ACCESS_ROLES = new Set(['owner', 'location-manager', 'platform-admin']);
const TABLE_ROLES = new Set(['owner', 'location-manager', 'checkout-associate', 'service-team', 'host']);
const BILLS_ROLES = new Set(['owner', 'location-manager', 'checkout-associate']);
const KITCHEN_ROLES = new Set(['owner', 'location-manager', 'kitchen-team', 'service-team']);

function hasAnyRole(userRoles: { key: string }[], allowed: Set<string>): boolean {
  return userRoles.some((r) => allowed.has(r.key));
}

type Group = 'main' | 'restaurant' | 'operations' | 'platform';

interface NavEntry {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  show: boolean;
  group: Group;
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-control bg-accent font-display text-lg font-semibold text-surface"
      >
        {brand.name.charAt(0)}
      </span>
      <span className="font-display text-lg font-semibold tracking-tight">{brand.name}</span>
    </div>
  );
}

export function AppShell() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setNavOpen(false), [location.pathname]);

  const roles = user?.roles ?? [];
  const isPlatform = user?.realm === 'PLATFORM';
  const isFullAccess = hasAnyRole(roles, FULL_ACCESS_ROLES);
  // The platform realm has no tenant context, so tenant pages would only 403 for it.
  const canSeeTables = !isPlatform && hasAnyRole(roles, TABLE_ROLES);
  const canSeeKitchen = !isPlatform && hasAnyRole(roles, KITCHEN_ROLES);
  const canSeeBills = !isPlatform && hasAnyRole(roles, BILLS_ROLES);
  const canSeeCosts = !isPlatform && isFullAccess;

  const entries: NavEntry[] = [
    { to: '/', label: t('shell.nav.home'), icon: Icons.Home, show: true, group: 'main' },
    { to: '/modules', label: t('shell.nav.modules'), icon: Icons.LayoutGrid, show: isFullAccess && !isPlatform, group: 'main' },
    { to: '/config', label: t('shell.nav.config'), icon: Icons.Settings, show: isFullAccess && !isPlatform, group: 'main' },
    { to: '/reports', label: t('shell.nav.reports'), icon: Icons.BarChart3, show: isFullAccess && !isPlatform, group: 'main' },
    { to: '/activity', label: t('shell.nav.activity'), icon: Icons.History, show: isFullAccess && !isPlatform, group: 'main' },
    { to: '/tables', label: t('shell.nav.tables'), icon: Icons.Armchair, show: canSeeTables, group: 'restaurant' },
    { to: '/kitchen', label: t('shell.nav.kitchen'), icon: Icons.ChefHat, show: canSeeKitchen, group: 'restaurant' },
    { to: '/bills', label: t('shell.nav.bills'), icon: Icons.Receipt, show: canSeeBills, group: 'restaurant' },
    { to: '/costs', label: t('shell.nav.costs'), icon: Icons.Wallet, show: canSeeCosts, group: 'operations' },
    { to: '/commercial', label: t('shell.nav.commercial'), icon: Icons.Receipt, show: isPlatform, group: 'platform' },
    { to: '/onboarding', label: t('shell.nav.onboarding'), icon: Icons.Rocket, show: isPlatform, group: 'platform' },
  ];
  const groups: Array<[Group, string | null]> = [
    ['main', null],
    ['restaurant', t('shell.nav.restaurant')],
    ['operations', t('shell.nav.operations')],
    ['platform', t('shell.nav.platform')],
  ];

  // UI gating is a convenience (the API is the real boundary); this explains a denied deep link.
  const guarded = (path: string, allowed: boolean, page: ReactElement) => (
    <Route
      path={path}
      element={allowed ? page : <EmptyState title={t('shell.noAccessTitle')} body={t('shell.noAccessBody')} />}
    />
  );

  const nav = (
    <nav aria-label={t('shell.primaryNav')} className="space-y-5">
      {groups.map(([group, heading]) => {
        const items = entries.filter((e) => e.group === group && e.show);
        if (items.length === 0) return null;
        return (
          <div key={group}>
            {heading && (
              <p className="mb-1.5 px-3 text-xs font-medium uppercase tracking-wider text-muted">{heading}</p>
            )}
            <ul className="space-y-0.5">
              {items.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors duration-(--duration-micro)',
                        isActive ? 'bg-accent-soft text-accent-strong' : 'text-ink hover:bg-sunken',
                      )
                    }
                  >
                    <Icon className="size-[1.125rem]" />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex h-screen w-full flex-col bg-paper">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2"
      >
        {t('shell.skipToContent')}
      </a>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
        <button
          type="button"
          className="grid size-11 place-items-center rounded-control hover:bg-sunken lg:hidden"
          aria-label={t('shell.openNav')}
          aria-expanded={navOpen}
          onClick={() => setNavOpen((o) => !o)}
        >
          {navOpen ? <Icons.X className="size-5" /> : <Icons.Menu className="size-5" />}
        </button>
        <BrandMark />
        <div className="ml-auto flex items-center gap-2">
          {!isPlatform && <NotificationsPanel />}
          <span className="hidden text-sm text-muted sm:inline" title={user?.email}>
            {isPlatform ? `${t('shell.platformRealm')} · ` : ''}
            {user?.displayName ?? user?.email}
          </span>
          <Button variant="secondary" onClick={() => void signOut()} aria-label={t('shell.signOut')}>
            <Icons.LogOut className="size-4" />
            <span className="hidden sm:inline">{t('shell.signOut')}</span>
          </Button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <aside
          className={cn(
            'z-30 w-64 shrink-0 overflow-y-auto border-r border-line bg-surface p-4',
            'max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:transition-transform max-lg:duration-(--duration-surface)',
            navOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full',
          )}
        >
          {nav}
        </aside>
        {navOpen && (
          <button
            type="button"
            aria-label={t('shell.closeNav')}
            className="absolute inset-0 z-20 bg-ink/30 lg:hidden"
            onClick={() => setNavOpen(false)}
          />
        )}

        <main id="main" tabIndex={-1} className="min-w-0 flex-1 overflow-auto p-4 sm:p-8">
          <ErrorBoundary key={location.pathname} title={t('shell.crashTitle')} body={t('shell.crashBody')} retry={t('modules.retry')}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            {guarded('/modules', isFullAccess && !isPlatform, <ModuleCenter />)}
            {guarded('/config', isFullAccess && !isPlatform, <ConfigCenter />)}
            {guarded('/reports', isFullAccess && !isPlatform, <ReportsPage />)}
            {guarded('/activity', isFullAccess && !isPlatform, <ActivityPage />)}
            {guarded('/commercial', isPlatform, <CommercialPage />)}
            {guarded('/onboarding', isPlatform, <OnboardingPage />)}
            {guarded('/tables', canSeeTables, <TablesPage />)}
            {guarded('/kitchen', canSeeKitchen, <KitchenPage />)}
            {guarded('/bills', canSeeBills, <BillsPage />)}
            {guarded('/costs', canSeeCosts, <CostsPage />)}
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="*" element={<PageHeader title={t('shell.notFoundTitle')} description={t('shell.notFoundBody')} />} />
          </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
