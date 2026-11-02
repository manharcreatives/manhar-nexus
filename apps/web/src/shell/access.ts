/**
 * Role gating (role keys from /auth/me). UI gating is a convenience; the API is
 * the authorization boundary. The platform realm has no tenant context, so
 * tenant pages would only 403 for it.
 */

const FULL_ACCESS_ROLES = new Set(['owner', 'location-manager', 'platform-admin']);
const TABLE_ROLES = new Set(['owner', 'location-manager', 'checkout-associate', 'service-team', 'host']);
const BILLS_ROLES = new Set(['owner', 'location-manager', 'checkout-associate', 'accountant']);
// Roles holding core.user.view (owner via wildcard).
const TEAM_ROLES = new Set(['owner', 'location-manager']);
// restaurant.kitchen.view: waiters get a read-only queue; only these roles hold .manage and may advance tickets.
const KITCHEN_ROLES = new Set(['owner', 'location-manager', 'kitchen-team', 'service-team']);
const KITCHEN_MANAGE_ROLES = new Set(['owner', 'location-manager', 'kitchen-team']);
// restaurant.qr.manage (table QR codes, menu appearance, dish photos) and restaurant.guestorder.manage (guest-order inbox:
// waiters hold it too). Mirrors apps/api/src/iam/system-roles.catalog.ts.
const QR_MANAGE_ROLES = new Set(['owner', 'location-manager']);
const GUEST_ORDER_ROLES = new Set(['owner', 'location-manager', 'service-team']);
// core.modules.view / .manage: only the owner (wildcard); the manager's template does not include them.
const MODULE_ROLES = new Set(['owner']);
// reports.sales.view, core.audit.view and costs.*.view are held by these (accountant: costs + reports, no create).
const FINANCE_VIEW_ROLES = new Set(['owner', 'location-manager', 'accountant']);
// costs.expense.create / costs.category.manage.
const COSTS_MANAGE_ROLES = new Set(['owner', 'location-manager']);

export interface Access {
  isPlatform: boolean;
  isFullAccess: boolean;
  /** Full-access tenant user (Module Center, Configuration, Reports, Activity). */
  isTenantAdmin: boolean;
  canSeeTables: boolean;
  canSeeKitchen: boolean;
  /** Can advance kitchen tickets (Accept / Start preparing / Mark ready). View-only roles see the queue without buttons. */
  canManageKitchen: boolean;
  canSeeBills: boolean;
  canSeeCosts: boolean;
  /** Can record expenses and manage categories (accountants only view and approve). */
  canManageCosts: boolean;
  canSeeModules: boolean;
  canSeeReports: boolean;
  canSeeActivity: boolean;
  canSeeTeam: boolean;
  /** restaurant.qr.manage: Table QR codes page, dish photos, dietary marks. */
  canManageQr: boolean;
  /** restaurant.guestorder.manage: guest-order inbox and waiter requests. */
  canManageGuestOrders: boolean;
  /** Owner only (core.business.configure): restaurant profile, brand colour, invoice identity. */
  canManageProfile: boolean;
}

export interface AccessUser {
  realm: 'PLATFORM' | 'BUSINESS';
  roles: { key: string }[];
}

function hasAnyRole(userRoles: { key: string }[], allowed: Set<string>): boolean {
  return userRoles.some((r) => allowed.has(r.key));
}

export function computeAccess(user: AccessUser | null): Access {
  const roles = user?.roles ?? [];
  const isPlatform = user?.realm === 'PLATFORM';
  const isFullAccess = hasAnyRole(roles, FULL_ACCESS_ROLES);
  return {
    isPlatform,
    isFullAccess,
    isTenantAdmin: isFullAccess && !isPlatform,
    canSeeTables: !isPlatform && hasAnyRole(roles, TABLE_ROLES),
    canSeeKitchen: !isPlatform && hasAnyRole(roles, KITCHEN_ROLES),
    canManageKitchen: !isPlatform && hasAnyRole(roles, KITCHEN_MANAGE_ROLES),
    canSeeBills: !isPlatform && hasAnyRole(roles, BILLS_ROLES),
    canSeeCosts: !isPlatform && hasAnyRole(roles, FINANCE_VIEW_ROLES),
    canManageCosts: !isPlatform && hasAnyRole(roles, COSTS_MANAGE_ROLES),
    canSeeModules: !isPlatform && hasAnyRole(roles, MODULE_ROLES),
    canSeeReports: !isPlatform && hasAnyRole(roles, FINANCE_VIEW_ROLES),
    canSeeActivity: !isPlatform && hasAnyRole(roles, FINANCE_VIEW_ROLES),
    canSeeTeam: !isPlatform && hasAnyRole(roles, TEAM_ROLES),
    canManageQr: !isPlatform && hasAnyRole(roles, QR_MANAGE_ROLES),
    canManageGuestOrders: !isPlatform && hasAnyRole(roles, GUEST_ORDER_ROLES),
    canManageProfile: !isPlatform && hasAnyRole(roles, MODULE_ROLES),
  };
}
