import { useAuth } from '../auth/AuthContext';
import { computeAccess } from '../shell/access';

/**
 * What the signed-in role may do on the restaurant pages, mirroring the system
 * role catalog (apps/api/src/iam/system-roles.catalog.ts) so no button is
 * offered that the API would answer with 403. The API stays the boundary.
 */
const ORDER_MANAGE = new Set(['owner', 'location-manager', 'service-team']); // restaurant.order.manage
const SESSION_MANAGE = new Set(['owner', 'location-manager', 'service-team', 'host']); // restaurant.session.manage
const DINING_MANAGE = new Set(['owner', 'location-manager', 'host']); // restaurant.dining.manage (reset table)
const CHECKOUT = new Set(['owner', 'location-manager', 'checkout-associate']); // checkout.invoice.create / payment.process

export interface RestaurantCaps {
  canManageKitchen: boolean;
  canManageOrders: boolean;
  canManageSessions: boolean;
  canResetTable: boolean;
  canCheckout: boolean;
}

export function restaurantCaps(user: { realm: 'PLATFORM' | 'BUSINESS'; roles: { key: string }[] } | null): RestaurantCaps {
  const keys = (user?.roles ?? []).map((r) => r.key);
  const any = (set: Set<string>) => keys.some((k) => set.has(k));
  return {
    canManageKitchen: computeAccess(user).canManageKitchen,
    canManageOrders: any(ORDER_MANAGE),
    canManageSessions: any(SESSION_MANAGE),
    canResetTable: any(DINING_MANAGE),
    canCheckout: any(CHECKOUT),
  };
}

export function useRestaurantCaps(): RestaurantCaps {
  const { user } = useAuth();
  return restaurantCaps(user);
}
