/**
 * Which Home widgets a user can load, mirroring the API permission each read
 * endpoint requires (apps/api/src/iam/system-roles.catalog.ts). Owner holds the
 * wildcard. UI gating only avoids pointless 403s; a widget that still gets a
 * 403 (custom role, module switched off) hides itself.
 */
const ROLE_PERMS: Record<string, readonly string[]> = {
  'location-manager': ['reports.daily', 'reports.sales', 'tables', 'kitchen', 'expenses', 'alerts'],
  'checkout-associate': ['reports.daily', 'alerts'],
  'service-team': ['tables', 'alerts'],
  host: ['tables', 'alerts'],
  'kitchen-team': ['kitchen', 'alerts'],
  'stock-control-manager': ['alerts'],
  accountant: ['reports.daily', 'reports.sales', 'expenses', 'alerts'],
};

export type HomeWidget = 'reports.daily' | 'reports.sales' | 'tables' | 'kitchen' | 'expenses' | 'alerts';

export interface HomeAccess {
  /** Today's revenue figures (daily report endpoint). */
  revenue: boolean;
  /** Per-day series: 7-day strip and comparison in one request. */
  series: boolean;
  tables: boolean;
  kitchen: boolean;
  expenses: boolean;
  alerts: boolean;
}

export function homeAccess(user: { realm: 'PLATFORM' | 'BUSINESS'; roles: { key: string }[] } | null): HomeAccess {
  const none: HomeAccess = { revenue: false, series: false, tables: false, kitchen: false, expenses: false, alerts: false };
  if (!user || user.realm === 'PLATFORM') return none;
  const keys = user.roles.map((r) => r.key);
  const has = (w: HomeWidget) => keys.some((k) => k === 'owner' || (ROLE_PERMS[k]?.includes(w) ?? false));
  return {
    revenue: has('reports.daily') || has('reports.sales'),
    series: has('reports.sales'),
    tables: has('tables'),
    kitchen: has('kitchen'),
    expenses: has('expenses'),
    alerts: has('alerts'),
  };
}
