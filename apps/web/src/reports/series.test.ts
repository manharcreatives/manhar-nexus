import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { compare, seriesToBars } from './series';
import { addDaysIso, daysBetweenInclusive } from './dates';

const t = ((key: string, o?: { count?: number }) => `${key}:${o?.count ?? ''}`) as unknown as TFunction;

const day = (date: string, net: number, count = 1) => ({
  date,
  paidInvoiceCount: count,
  grossSalesMinorUnits: net,
  totalRevenueMinorUnits: net,
  totalRefundedMinorUnits: 0,
  netRevenueMinorUnits: net,
});

describe('compare', () => {
  it('reports signed delta and one-decimal percent', () => {
    expect(compare(1500, 1000)).toEqual({ delta: 500, pct: 50, direction: 'up' });
    expect(compare(900, 1200)).toEqual({ delta: -300, pct: -25, direction: 'down' });
    expect(compare(1000, 1000)).toEqual({ delta: 0, pct: 0, direction: 'flat' });
  });
  it('never invents a percent from a zero base', () => {
    expect(compare(500, 0)).toEqual({ delta: 500, pct: null, direction: 'up' });
  });
});

describe('seriesToBars', () => {
  it('maps net revenue and bill counts, keyed by date', () => {
    const bars = seriesToBars([day('2026-10-19', 100, 2), day('2026-10-20', 0, 0)], t);
    expect(bars.map((b) => [b.key, b.value, b.detail])).toEqual([
      ['2026-10-19', 100, 'reports.billsCount:2'],
      ['2026-10-20', 0, 'reports.billsCount:0'],
    ]);
  });
  it('uses day-of-month labels for ranges longer than a week', () => {
    const days = Array.from({ length: 10 }, (_, i) => day(addDaysIso('2026-10-01', i), i));
    expect(seriesToBars(days, t)[9].label).toBe('10');
  });
});

describe('date helpers', () => {
  it('shifts and counts calendar days across month ends', () => {
    expect(addDaysIso('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDaysIso('2026-03-01', -7)).toBe('2026-02-22');
    expect(daysBetweenInclusive('2026-10-01', '2026-10-31')).toBe(31);
    expect(daysBetweenInclusive('2026-10-25', '2026-10-25')).toBe(1);
  });
});
