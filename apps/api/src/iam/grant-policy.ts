import { ForbiddenError, ValidationError } from '../common/errors';
import { PermissionRegistry, WILDCARD } from './permission.registry';
import type { Principal } from './principal';

/**
 * Privilege-escalation firewall shared by role creation/update AND role
 * assignment (T4). A principal may only confer permissions that (a) exist,
 * (b) are not platform-namespaced (business roles never hold platform perms),
 * and (c) the principal already holds (wildcard counts). This makes it
 * impossible to mint OR assign a role more powerful than yourself — closing the
 * "assign the pre-existing owner wildcard role" takeover path.
 */
export function assertCanGrantPermissions(
  principal: Principal,
  registry: PermissionRegistry,
  permissionKeys: readonly string[],
): void {
  const held = principal.permissions;
  const hasWildcard = held.has(WILDCARD);
  for (const key of permissionKeys) {
    if (key === WILDCARD) {
      if (!hasWildcard) throw new ForbiddenError('Cannot grant wildcard permission');
      continue;
    }
    if (!registry.has(key)) {
      throw new ValidationError('Unknown permission', { permission: key });
    }
    if (key.startsWith('platform.')) {
      throw new ForbiddenError('Platform permissions cannot be granted to a business role', {
        permission: key,
      });
    }
    if (!hasWildcard && !held.has(key)) {
      throw new ForbiddenError('Cannot grant a permission you do not hold', { permission: key });
    }
  }
}

/**
 * Location-scope firewall: a principal restricted to specific locations may not
 * grant broader location access than it holds (all-locations or out-of-scope
 * locations). Wildcard/all-locations principals may grant anything in-business.
 */
export function assertCanGrantLocations(
  principal: Principal,
  allLocations: boolean,
  locationIds: readonly string[],
): void {
  if (principal.allLocations) return;
  if (allLocations) {
    throw new ForbiddenError('Cannot grant all-locations access beyond your own scope');
  }
  for (const id of locationIds) {
    if (!principal.locationIds.has(id)) {
      throw new ForbiddenError('Cannot grant access to a location outside your scope', {
        locationId: id,
      });
    }
  }
}
