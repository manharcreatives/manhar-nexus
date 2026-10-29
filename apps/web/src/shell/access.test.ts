import { describe, expect, it } from 'vitest';
import { computeAccess } from './access';
import { PAGES } from './pages';

const as = (key: string, realm: 'BUSINESS' | 'PLATFORM' = 'BUSINESS') => computeAccess({ realm, roles: [{ key }] });
const visible = (key: string, realm: 'BUSINESS' | 'PLATFORM' = 'BUSINESS') =>
  PAGES.filter((p) => p.can(as(key, realm))).map((p) => p.path);

/**
 * Mirrors apps/api/src/iam/system-roles.catalog.ts: a page appears only when the role
 * holds the permission its first API call needs (otherwise the user would see a 403).
 */
describe('role -> visible pages', () => {
  it('owner sees every tenant page, never the platform pages', () => {
    expect(visible('owner')).toEqual(['/', '/modules', '/config', '/profile', '/reports', '/team', '/activity', '/tables', '/kitchen', '/bills', '/floor', '/menu', '/costs']);
  });
  it('location manager has no Module Center (no core.modules.view) but everything else', () => {
    expect(visible('location-manager')).toEqual(['/', '/config', '/reports', '/team', '/activity', '/tables', '/kitchen', '/bills', '/floor', '/menu', '/costs']);
  });
  it('accountant sees Reports, Activity and Costs only', () => {
    expect(visible('accountant')).toEqual(['/', '/reports', '/activity', '/costs']);
    expect(as('accountant').canManageCosts).toBe(false);
    expect(as('location-manager').canManageCosts).toBe(true);
  });
  it('cashier: Tables and Bills', () => expect(visible('checkout-associate')).toEqual(['/', '/tables', '/bills']));
  it('waiter: Tables and a read-only Kitchen', () => {
    expect(visible('service-team')).toEqual(['/', '/tables', '/kitchen']);
    expect(as('service-team').canManageKitchen).toBe(false);
  });
  it('kitchen: Kitchen only', () => expect(visible('kitchen-team')).toEqual(['/', '/kitchen']));
  it('host: Tables only', () => expect(visible('host')).toEqual(['/', '/tables']));
  it('platform admin: platform pages only', () => expect(visible('platform-admin', 'PLATFORM')).toEqual(['/', '/commercial', '/onboarding']));
});
