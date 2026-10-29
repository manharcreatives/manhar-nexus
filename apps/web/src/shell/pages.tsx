import type { ComponentType } from 'react';
import { ModuleCenter } from '../modules/ModuleCenter';
import { ConfigCenter } from '../config/ConfigCenter';
import { ReportsPage } from '../reports/ReportsPage';
import { ActivityPage } from '../activity/ActivityPage';
import { CommercialPage } from '../commercial/CommercialPage';
import { OnboardingPage } from '../onboarding/OnboardingPage';
import { TablesPage } from '../restaurant/TablesPage';
import { KitchenPage } from '../restaurant/KitchenPage';
import { CostsPage } from '../costs/CostsPage';
import { HomePage } from '../home/HomePage';
import { BillsPage } from '../bills/BillsPage';
import { PeoplePage } from '../people/PeoplePage';
import { FloorSetupPage } from '../setup/FloorSetupPage';
import { MenuSetupPage } from '../setup/MenuSetupPage';
import * as Icons from '../ui/icons';
import type { Access } from './access';

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
  { path: '/reports', labelKey: 'shell.nav.reports', keywordsKey: 'shell.keywords.reports', icon: Icons.BarChart3, group: 'main', can: (a) => a.canSeeReports, Component: ReportsPage, goKey: 'r' },
  { path: '/team', labelKey: 'shell.nav.team', keywordsKey: 'shell.keywords.team', icon: Icons.Users, group: 'main', can: (a) => a.canSeeTeam, Component: PeoplePage },
  { path: '/activity', labelKey: 'shell.nav.activity', keywordsKey: 'shell.keywords.activity', icon: Icons.History, group: 'main', can: (a) => a.canSeeActivity, Component: ActivityPage },
  { path: '/tables', labelKey: 'shell.nav.tables', keywordsKey: 'shell.keywords.tables', icon: Icons.Armchair, group: 'restaurant', can: (a) => a.canSeeTables, Component: TablesPage, goKey: 't' },
  { path: '/kitchen', labelKey: 'shell.nav.kitchen', keywordsKey: 'shell.keywords.kitchen', icon: Icons.ChefHat, group: 'restaurant', can: (a) => a.canSeeKitchen, Component: KitchenPage, goKey: 'k' },
  { path: '/bills', labelKey: 'shell.nav.bills', keywordsKey: 'shell.keywords.bills', icon: Icons.Receipt, group: 'restaurant', can: (a) => a.canSeeBills, Component: BillsPage },
  { path: '/floor', labelKey: 'shell.nav.floor', keywordsKey: 'shell.keywords.floor', icon: Icons.LayoutPanelTop, group: 'restaurant', can: (a) => a.isTenantAdmin, Component: FloorSetupPage, goKey: 'f' },
  { path: '/menu', labelKey: 'shell.nav.menu', keywordsKey: 'shell.keywords.menu', icon: Icons.UtensilsCrossed, group: 'restaurant', can: (a) => a.isTenantAdmin, Component: MenuSetupPage, goKey: 'm' },
  { path: '/costs', labelKey: 'shell.nav.costs', keywordsKey: 'shell.keywords.costs', icon: Icons.Wallet, group: 'operations', can: (a) => a.canSeeCosts, Component: CostsPage },
  { path: '/commercial', labelKey: 'shell.nav.commercial', keywordsKey: 'shell.keywords.commercial', icon: Icons.Receipt, group: 'platform', can: (a) => a.isPlatform, Component: CommercialPage },
  { path: '/onboarding', labelKey: 'shell.nav.onboarding', keywordsKey: 'shell.keywords.onboarding', icon: Icons.Rocket, group: 'platform', can: (a) => a.isPlatform, Component: OnboardingPage },
];
