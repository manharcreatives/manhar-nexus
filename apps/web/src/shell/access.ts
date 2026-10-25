/**
 * Role gating (role keys from /auth/me). UI gating is a convenience; the API is
 * the authorization boundary. The platform realm has no tenant context, so
 * tenant pages would only 403 for it.
 */

const FULL_ACCESS_ROLES = new Set(['owner', 'location-manager', 'platform-admin']);
const TABLE_ROLES = new Set(['owner', 'location-manager', 'checkout-associate', 'service-team', 'host']);
const BILLS_ROLES = new Set(['owner', 'location-manager', 'checkout-associate']);
// Roles holding core.user.view (owner via wildcard).
const TEAM_ROLES = new Set(['owner', 'location-manager']);
const KITCHEN_ROLES = new Set(['owner', 'location-manager', 'kitchen-team', 'service-team']);

export interface Access {
  isPlatform: boolean;
  isFullAccess: boolean;
  /** Full-access tenant user (Module Center, Configuration, Reports, Activity). */
  isTenantAdmin: boolean;
  canSeeTables: boolean;
  canSeeKitchen: boolean;
  canSeeBills: boolean;
  canSeeCosts: boolean;
  canSeeTeam: boolean;
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
    canSeeBills: !isPlatform && hasAnyRole(roles, BILLS_ROLES),
    canSeeCosts: !isPlatform && isFullAccess,
    canSeeTeam: !isPlatform && hasAnyRole(roles, TEAM_ROLES),
  };
}
