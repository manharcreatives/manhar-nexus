import { useAuth } from '../auth/AuthContext';

/**
 * What the signed-in role may do in the QR menu area, mirroring the system role
 * catalog (apps/api/src/iam/system-roles.catalog.ts) so no control is offered that the
 * API would answer with 403. The API stays the authorization boundary.
 *
 *  - restaurant.qr.manage         owner, location-manager  (tokens, settings, menu photos)
 *  - restaurant.guestorder.manage owner, location-manager, service-team  (confirm / reject / edit)
 */
export const QR_MANAGE_ROLES: ReadonlySet<string> = new Set(['owner', 'location-manager']);
export const GUEST_ORDER_ROLES: ReadonlySet<string> = new Set(['owner', 'location-manager', 'service-team']);

export interface QrCaps {
  /** restaurant.qr.manage */
  canManageQr: boolean;
  /** restaurant.guestorder.manage */
  canManageGuestOrders: boolean;
}

interface CapsUser {
  realm: 'PLATFORM' | 'BUSINESS';
  roles: { key: string }[];
}

export function qrCaps(user: CapsUser | null): QrCaps {
  const keys = (user?.roles ?? []).map((r) => r.key);
  const business = user?.realm === 'BUSINESS';
  return {
    canManageQr: business && keys.some((k) => QR_MANAGE_ROLES.has(k)),
    canManageGuestOrders: business && keys.some((k) => GUEST_ORDER_ROLES.has(k)),
  };
}

export function useQrCaps(): QrCaps {
  const { user } = useAuth();
  return qrCaps(user);
}
