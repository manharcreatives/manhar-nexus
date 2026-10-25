import { describe, expect, it } from 'vitest';
import { filterItems, normalize, scoreItem } from './paletteFilter';

const items = [
  { id: 'home', label: 'Home', keywords: 'dashboard today' },
  { id: 'reports', label: 'Reports', keywords: 'sales revenue' },
  { id: 'tables', label: 'Tables & Sessions', keywords: 'floor orders' },
  { id: 'kitchen', label: 'Kitchen Display', keywords: 'kds tickets orders' },
  { id: 'bills', label: 'Bills', keywords: 'invoices refund' },
  { id: 'cafe', label: 'Switch to Café Central' },
  { id: 'signout', label: 'Sign out', keywords: 'log out logout' },
];
const ids = (q: string) => filterItems(items, q).map((i) => i.id);

describe('palette filter', () => {
  it('returns everything in original order for an empty query', () => {
    expect(ids('')).toEqual(items.map((i) => i.id));
    expect(ids('   ')).toEqual(items.map((i) => i.id));
  });

  it('ranks label prefixes above keyword and substring matches', () => {
    expect(ids('k')[0]).toBe('kitchen');
    expect(ids('re')[0]).toBe('reports');
    expect(ids('re')).toContain('bills'); // "refund" keyword
  });

  it('matches word starts inside a label', () => {
    expect(ids('sess')).toEqual(['tables']);
    expect(ids('display')).toEqual(['kitchen']);
  });

  it('matches keywords', () => {
    expect(ids('kds')).toEqual(['kitchen']);
    expect(ids('invoice')).toEqual(['bills']);
    expect(ids('logout')).toEqual(['signout']);
  });

  it('requires every term to match', () => {
    expect(ids('orders kitchen')).toEqual(['kitchen']);
    expect(ids('orders zzz')).toEqual([]);
  });

  it('ignores case and accents', () => {
    expect(normalize('Café')).toBe('cafe');
    expect(ids('CAFE')).toEqual(['cafe']);
  });

  it('allows loose subsequence matches as a last resort', () => {
    expect(scoreItem({ id: 'x', label: 'Reports' }, 'rpts')).toBeGreaterThan(0);
    expect(scoreItem({ id: 'x', label: 'Reports' }, 'xyz')).toBe(0);
  });

  it('returns nothing when nothing matches', () => {
    expect(ids('qqqq')).toEqual([]);
  });
});
