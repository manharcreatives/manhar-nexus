import { describe, expect, it } from 'vitest';
import { averageBill, kitchenLoad, pendingApprovals, tableLoad } from './derive';
import { homeAccess } from './access';

describe('kitchenLoad', () => {
  const now = Date.parse('2026-10-25T12:30:00Z');
  it('counts waiting vs ready and finds the oldest waiting ticket', () => {
    const load = kitchenLoad(
      [
        { status: 'SENT', sentAt: '2026-10-25T12:20:00Z' },
        { status: 'PREPARING', sentAt: '2026-10-25T12:05:30Z' },
        { status: 'READY', sentAt: '2026-10-25T11:00:00Z' },
        { status: 'ACCEPTED', sentAt: null },
      ],
      now,
    );
    expect(load).toEqual({ waiting: 3, ready: 1, oldestMins: 24 });
  });
  it('reports no wait for an empty queue', () => {
    expect(kitchenLoad([], now)).toEqual({ waiting: 0, ready: 0, oldestMins: null });
  });
});

describe('tableLoad', () => {
  it('ignores inactive tables', () => {
    expect(
      tableLoad([
        { status: 'OCCUPIED', isActive: true },
        { status: 'AVAILABLE', isActive: true },
        { status: 'CLEANING', isActive: true },
        { status: 'OCCUPIED', isActive: false },
      ]),
    ).toEqual({ occupied: 1, cleaning: 1, total: 3 });
  });
});

describe('pendingApprovals / averageBill', () => {
  it('sums only pending expenses', () => {
    expect(
      pendingApprovals([
        { status: 'PENDING_APPROVAL', amountMinorUnits: 1500 },
        { status: 'APPROVED', amountMinorUnits: 9999 },
        { status: 'PENDING_APPROVAL', amountMinorUnits: 500 },
      ]),
    ).toEqual({ count: 2, totalMinor: 2000 });
  });
  it('has no average without bills', () => {
    expect(averageBill({ date: 'x', netMinor: 0, revenueMinor: 0, paidCount: 0 })).toBeNull();
    expect(averageBill({ date: 'x', netMinor: 0, revenueMinor: 1000, paidCount: 3 })).toBe(333);
  });
});

describe('homeAccess', () => {
  const user = (...keys: string[]) => ({ realm: 'BUSINESS' as const, roles: keys.map((key) => ({ key })) });
  it('gives the owner everything', () => {
    expect(Object.values(homeAccess(user('owner'))).every(Boolean)).toBe(true);
  });
  it('mirrors API permissions per role', () => {
    expect(homeAccess(user('kitchen-team'))).toMatchObject({ revenue: false, kitchen: true, tables: false, alerts: true });
    expect(homeAccess(user('checkout-associate'))).toMatchObject({ revenue: true, series: false, expenses: false });
    expect(homeAccess(user('accountant'))).toMatchObject({ revenue: true, series: true, expenses: true, tables: false });
  });
  it('shows nothing tenant-scoped to the platform realm', () => {
    expect(Object.values(homeAccess({ realm: 'PLATFORM', roles: [{ key: 'platform-admin' }] })).some(Boolean)).toBe(false);
  });
});
