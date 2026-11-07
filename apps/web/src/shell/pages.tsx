import { lazy, Suspense, type ComponentType } from 'react';
import { HomePage } from '../home/HomePage';
import { QrCode, ScanLine } from '../qr/icons';
import { GuestOrdersRoute, TableQrRoute } from '../qr/lazy';
import { Skeleton } from '../ui/states';
import * as Icons from '../ui/icons';
import type { Access } from './access';

/**
 * Every page except Home loads on demand, so the first screen after sign-in downloads only what it shows. A page is a
 * named export of its module; the wrapper adds the loading skeleton.
 */
function page(load: () => Promise<{ default: ComponentType }>): ComponentType {
  const Lazy = lazy(load);
  return function LazyPage() {
    return (
      <Suspense
        fallback={
          <div role="status" aria-busy="true" className="space-y-4">
            <Skeleton className="h-12 w-64" />
            <Skeleton className="h-64" />
          </div>
        }
      >
        <Lazy />
      </Suspense>
    );
  };
}
const ModuleCenter = page(() => import('../modules/ModuleCenter').then((m) => ({ default: m.ModuleCenter })));
const ConfigCenter = page(() => import('../config/ConfigCenter').then((m) => ({ default: m.ConfigCenter })));
const ReportsPage = page(() => import('../reports/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const ActivityPage = page(() => import('../activity/ActivityPage').then((m) => ({ default: m.ActivityPage })));
const CommercialPage = page(() => import('../commercial/CommercialPage').then((m) => ({ default: m.CommercialPage })));
const OnboardingPage = page(() => import('../onboarding/OnboardingPage').then((m) => ({ default: m.OnboardingPage })));
const RegistrationsPage = page(() => import('../registrations/RegistrationsPage').then((m) => ({ default: m.RegistrationsPage })));
const TablesPage = page(() => import('../restaurant/TablesPage').then((m) => ({ default: m.TablesPage })));
const KitchenPage = page(() => import('../restaurant/KitchenPage').then((m) => ({ default: m.KitchenPage })));
const CostsPage = page(() => import('../costs/CostsPage').then((m) => ({ default: m.CostsPage })));
const BillsPage = page(() => import('../bills/BillsPage').then((m) => ({ default: m.BillsPage })));
const PeoplePage = page(() => import('../people/PeoplePage').then((m) => ({ default: m.PeoplePage })));
const ProfilePage = page(() => import('../profile/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const FloorSetupPage = page(() => import('../setup/FloorSetupPage').then((m) => ({ default: m.FloorSetupPage })));
const MenuSetupPage = page(() => import('../setup/MenuSetupPage').then((m) => ({ default: m.MenuSetupPage })));

export type PageGroup = 'main' | 'restaurant' | 'operations' | 'platform';

/**
 * ONE definition per page: the sidebar, the router, the command palette and the
 * "g <key>" shortcuts are all derived from this list. Add a page here only.
 */
export interface PageDef {
  path: string;
  /** i18n key of the page name (shell.nav.*). */
  labelKey: string;
  /** i18n key of extra search words for the command palette (shell.keywords.*). */
  keywordsKey?: string;
  icon: ComponentType<{ className?: string }>;
  group: PageGroup;
  /** Whether the signed-in user may see this page. */
  can: (a: Access) => boolean;
  Component: ComponentType;
  /** Second key of the "g <key>" go-to shortcut. */
  goKey?: string;
}

export const PAGE_GROUPS: Array<{ id: PageGroup; headingKey: string | null }> = [
  { id: 'main', headingKey: null },
  { id: 'restaurant', headingKey: 'shell.nav.restaurant' },
  { id: 'operations', headingKey: 'shell.nav.operations' },
  { id: 'platform', headingKey: 'shell.nav.platform' },
];

export const PAGES: PageDef[] = [
  { path: '/', labelKey: 'shell.nav.home', keywordsKey: 'shell.keywords.home', icon: Icons.Home, group: 'main', can: () => true, Component: HomePage, goKey: 'h' },
  { path: '/modules', labelKey: 'shell.nav.modules', keywordsKey: 'shell.keywords.modules', icon: Icons.LayoutGrid, group: 'main', can: (a) => a.canSeeModules, Component: ModuleCenter },
  { path: '/config', labelKey: 'shell.nav.config', keywordsKey: 'shell.keywords.config', icon: Icons.Settings, group: 'main', can: (a) => a.isTenantAdmin, Component: ConfigCenter },
  { path: '/profile', labelKey: 'shell.nav.profile', keywordsKey: 'shell.keywords.profile', icon: Icons.Store, group: 'main', can: (a) => a.canManageProfile, Component: ProfilePage, goKey: 'p' },
  { path: '/reports', labelKey: 'shell.nav.reports', keywordsKey: 'shell.keywords.reports', icon: Icons.BarChart3, group: 'main', can: (a) => a.canSeeReports, Component: ReportsPage, goKey: 'r' },
  { path: '/team', labelKey: 'shell.nav.team', keywordsKey: 'shell.keywords.team', icon: Icons.Users, group: 'main', can: (a) => a.canSeeTeam, Component: PeoplePage },
  { path: '/activity', labelKey: 'shell.nav.activity', keywordsKey: 'shell.keywords.activity', icon: Icons.History, group: 'main', can: (a) => a.canSeeActivity, Component: ActivityPage },
  { path: '/tables', labelKey: 'shell.nav.tables', keywordsKey: 'shell.keywords.tables', icon: Icons.Armchair, group: 'restaurant', can: (a) => a.canSeeTables, Component: TablesPage, goKey: 't' },
  { path: '/guest-orders', labelKey: 'shell.nav.guestOrders', keywordsKey: 'shell.keywords.guestOrders', icon: QrCode, group: 'restaurant', can: (a) => a.canManageGuestOrders, Component: GuestOrdersRoute, goKey: 'o' },
  { path: '/kitchen', labelKey: 'shell.nav.kitchen', keywordsKey: 'shell.keywords.kitchen', icon: Icons.ChefHat, group: 'restaurant', can: (a) => a.canSeeKitchen, Component: KitchenPage, goKey: 'k' },
  { path: '/bills', labelKey: 'shell.nav.bills', keywordsKey: 'shell.keywords.bills', icon: Icons.Receipt, group: 'restaurant', can: (a) => a.canSeeBills, Component: BillsPage },
  { path: '/floor', labelKey: 'shell.nav.floor', keywordsKey: 'shell.keywords.floor', icon: Icons.LayoutPanelTop, group: 'restaurant', can: (a) => a.isTenantAdmin, Component: FloorSetupPage, goKey: 'f' },
  { path: '/menu', labelKey: 'shell.nav.menu', keywordsKey: 'shell.keywords.menu', icon: Icons.UtensilsCrossed, group: 'restaurant', can: (a) => a.isTenantAdmin, Component: MenuSetupPage, goKey: 'm' },
  { path: '/qr', labelKey: 'shell.nav.qr', keywordsKey: 'shell.keywords.qr', icon: ScanLine, group: 'restaurant', can: (a) => a.canManageQr, Component: TableQrRoute, goKey: 'q' },
  { path: '/costs', labelKey: 'shell.nav.costs', keywordsKey: 'shell.keywords.costs', icon: Icons.Wallet, group: 'operations', can: (a) => a.canSeeCosts, Component: CostsPage },
  { path: '/commercial', labelKey: 'shell.nav.commercial', keywordsKey: 'shell.keywords.commercial', icon: Icons.Receipt, group: 'platform', can: (a) => a.isPlatform, Component: CommercialPage },
  { path: '/registrations', labelKey: 'shell.nav.registrations', keywordsKey: 'shell.keywords.registrations', icon: Icons.Inbox, group: 'platform', can: (a) => a.isPlatform, Component: RegistrationsPage },
  { path: '/onboarding', labelKey: 'shell.nav.onboarding', keywordsKey: 'shell.keywords.onboarding', icon: Icons.Rocket, group: 'platform', can: (a) => a.isPlatform, Component: OnboardingPage },
];
