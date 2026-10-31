import { describe, expect, it } from 'vitest';
import { restaurantCaps } from './permissions';

const as = (...keys: string[]) => restaurantCaps({ realm: 'BUSINESS', roles: keys.map((key) => ({ key })) });

describe('restaurantCaps (mirrors system-roles.catalog)', () => {
  it('waiters take orders and seat guests but cannot move kitchen tickets, check out or reset tables', () => {
    expect(as('service-team')).toEqual({ canManageKitchen: false, canManageOrders: true, canEditOrders: true, canManageSessions: true, canResetTable: false, canCheckout: false });
  });
  it('kitchen staff only move tickets', () => {
    expect(as('kitchen-team')).toEqual({ canManageKitchen: true, canManageOrders: false, canEditOrders: false, canManageSessions: false, canResetTable: false, canCheckout: false });
  });
  it('hosts seat guests and reset tables, but do not send orders', () => {
    expect(as('host')).toMatchObject({ canManageSessions: true, canResetTable: true, canManageOrders: false, canCheckout: false });
  });
  it('checkout associates only check out', () => {
    expect(as('checkout-associate')).toMatchObject({ canCheckout: true, canManageSessions: false, canManageOrders: false });
  });
  it('owners and location managers can do everything', () => {
    for (const r of ['owner', 'location-manager']) {
      expect(Object.values(as(r)).every(Boolean)).toBe(true);
    }
  });
  it('only waiters and managers may edit an order before the kitchen starts it (restaurant.order.edit)', () => {
    for (const r of ['kitchen-team', 'host', 'checkout-associate', 'accountant']) expect(as(r).canEditOrders).toBe(false);
    for (const r of ['service-team', 'location-manager', 'owner']) expect(as(r).canEditOrders).toBe(true);
  });
  it('signed out grants nothing', () => {
    expect(Object.values(restaurantCaps(null)).some(Boolean)).toBe(false);
  });
});
