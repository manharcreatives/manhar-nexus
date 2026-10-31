import { BUILT_IN_MODULES } from '../../modules/module-manifest';
import { PermissionRegistry, WILDCARD, permissionKey } from '../../iam/permission.registry';
import { SYSTEM_ROLES } from '../../iam/system-roles.catalog';

const SHOW_BILL = 'restaurant.bill.show';
const SHOW_QR = 'checkout.paymentqr.show';
const perms = (key: string) => new Set(SYSTEM_ROLES.find((r) => r.key === key)?.permissions ?? []);

describe('waiter bill / payment QR permissions (Update Round 2, A7)', () => {
  it('are registered by their modules, not restricted, and register without duplicates', () => {
    const registry = new PermissionRegistry();
    for (const m of BUILT_IN_MODULES) registry.register(m.permissions);
    for (const key of [SHOW_BILL, SHOW_QR]) {
      expect(registry.has(key)).toBe(true);
      expect(registry.isRestricted(key)).toBe(false);
    }
    expect(BUILT_IN_MODULES.find((m) => m.key === 'restaurant')?.permissions.map(permissionKey)).toContain(SHOW_BILL);
    expect(BUILT_IN_MODULES.find((m) => m.key === 'checkout')?.permissions.map(permissionKey)).toContain(SHOW_QR);
  });

  it('waiter, cashier and manager can show both; owner via wildcard', () => {
    for (const role of ['service-team', 'checkout-associate', 'location-manager']) {
      expect({ role, bill: perms(role).has(SHOW_BILL), qr: perms(role).has(SHOW_QR) }).toEqual({ role, bill: true, qr: true });
    }
    expect(perms('owner').has(WILDCARD)).toBe(true);
  });

  it('kitchen, host, accountant and stock roles cannot', () => {
    for (const role of ['kitchen-team', 'host', 'accountant', 'stock-control-manager']) {
      expect({ role, bill: perms(role).has(SHOW_BILL), qr: perms(role).has(SHOW_QR) }).toEqual({ role, bill: false, qr: false });
    }
  });

  it('showing the bill never implies generating a bill or recording a payment', () => {
    const waiter = perms('service-team');
    for (const key of ['checkout.invoice.create', 'checkout.invoice.view', 'checkout.payment.process', 'checkout.payment.view']) {
      expect({ key, held: waiter.has(key) }).toEqual({ key, held: false });
    }
  });
});
