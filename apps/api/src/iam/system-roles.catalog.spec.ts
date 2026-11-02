import { BUILT_IN_MODULES } from '../modules/module-manifest';
import { CORE_PERMISSIONS, WILDCARD, permissionKey } from './permission.registry';
import { SYSTEM_ROLES } from './system-roles.catalog';

const known = new Set([...CORE_PERMISSIONS, ...BUILT_IN_MODULES.flatMap((m) => m.permissions)].map(permissionKey));
const perms = (key: string) => new Set(SYSTEM_ROLES.find((r) => r.key === key)?.permissions ?? []);

describe('system role catalog', () => {
  it('only grants permissions that exist in the registry (a typo would silently grant nothing)', () => {
    for (const role of SYSTEM_ROLES) {
      for (const p of role.permissions) {
        if (p === WILDCARD) continue;
        expect({ role: role.key, p, known: known.has(p) }).toEqual({ role: role.key, p, known: true });
      }
    }
  });

  // Every API call a role's pages make on load must be allowed, or the user sees
  // "Your role does not allow this action" (found by scripts/qa/role-sweep.mjs).
  const pageCalls: Record<string, string[]> = {
    // Tables page: floor (dining), sessions, orders, menu for the order panel.
    'service-team': ['restaurant.dining.view', 'restaurant.session.view', 'restaurant.order.view', 'catalog.item.view', 'catalog.category.view', 'catalog.modifier.view', 'restaurant.kitchen.view'],
    'checkout-associate': ['restaurant.dining.view', 'restaurant.session.view', 'restaurant.order.view', 'checkout.invoice.view', 'checkout.payment.view'],
    // Kitchen page also reads the floor so tickets can show table names.
    'kitchen-team': ['restaurant.dining.view', 'restaurant.session.view', 'restaurant.order.view', 'restaurant.kitchen.view'],
    host: ['restaurant.dining.view', 'restaurant.session.view', 'restaurant.order.view', 'catalog.item.view', 'catalog.category.view', 'catalog.modifier.view'],
    // Settings > Alerts tab, Costs location filter.
    'location-manager': ['core.alert.view', 'core.alert.edit', 'core.setting.view', 'core.audit.view', 'reports.sales.view', 'costs.expense.view'],
    accountant: ['core.location.view', 'costs.expense.view', 'costs.category.view', 'reports.sales.view', 'core.audit.view', 'checkout.invoice.view', 'checkout.payment.view'],
  };
  for (const [role, needed] of Object.entries(pageCalls)) {
    it(`${role} holds what its pages load`, () => {
      const have = perms(role);
      expect(needed.filter((p) => !have.has(p))).toEqual([]);
    });
  }

  it('waiters and managers may edit a sent order; the kitchen, hosts and cashiers may not', () => {
    expect(perms('service-team').has('restaurant.order.edit')).toBe(true);
    expect(perms('location-manager').has('restaurant.order.edit')).toBe(true);
    for (const r of ['kitchen-team', 'host', 'checkout-associate', 'accountant']) expect(perms(r).has('restaurant.order.edit')).toBe(false);
  });

  it('QR digital menu: managers run it, waiters answer guest orders, nobody else', () => {
    expect(perms('location-manager').has('restaurant.qr.manage')).toBe(true);
    expect(perms('location-manager').has('restaurant.guestorder.manage')).toBe(true);
    expect(perms('service-team').has('restaurant.guestorder.manage')).toBe(true);
    expect(perms('service-team').has('restaurant.qr.manage')).toBe(false);
    for (const r of ['kitchen-team', 'host', 'checkout-associate', 'accountant']) {
      expect(perms(r).has('restaurant.qr.manage')).toBe(false);
      expect(perms(r).has('restaurant.guestorder.manage')).toBe(false);
    }
  });

  it('waiters can read but never advance the kitchen queue', () => {
    expect(perms('service-team').has('restaurant.kitchen.manage')).toBe(false);
  });
  it('only the owner holds the Module Center', () => {
    const holders = SYSTEM_ROLES.filter((r) => r.realm === 'BUSINESS' && (r.permissions.includes(WILDCARD) || r.permissions.includes('core.modules.view'))).map((r) => r.key);
    expect(holders).toEqual(['owner']);
  });
});
