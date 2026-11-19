import { describe, expect, it } from 'vitest';
import { daysUntil, matchesQuery, relativeAge, renewalState } from './helpers';

const NOW = Date.parse('2026-11-16T10:00:00.000Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const ahead = (days: number) => new Date(NOW + days * 86_400_000).toISOString();

describe('relativeAge', () => {
  it('says how long ago in the unit an operator scans', () => {
    expect(relativeAge(ago(10_000), NOW)).toEqual({ key: 'now', count: 0 });
    expect(relativeAge(ago(5 * 60_000), NOW)).toEqual({ key: 'minutes', count: 5 });
    expect(relativeAge(ago(3 * 3_600_000), NOW)).toEqual({ key: 'hours', count: 3 });
    expect(relativeAge(ago(2 * 86_400_000 + 3_600_000), NOW)).toEqual({ key: 'days', count: 2 });
  });

  it('never goes negative for a clock that is slightly ahead', () => {
    expect(relativeAge(new Date(NOW + 60_000).toISOString(), NOW)).toEqual({ key: 'now', count: 0 });
  });
});

describe('renewalState', () => {
  it('flags clients that are past their paid-until date or due within 14 days', () => {
    expect(renewalState(ahead(-1), NOW)).toBe('overdue');
    expect(renewalState(ahead(0), NOW)).toBe('soon');
    expect(renewalState(ahead(14), NOW)).toBe('soon');
    expect(renewalState(ahead(15), NOW)).toBe('ok');
  });

  it('has no opinion when there is no date', () => {
    expect(renewalState(null, NOW)).toBe('unknown');
    expect(renewalState(undefined, NOW)).toBe('unknown');
    expect(daysUntil('not a date', NOW)).toBeNull();
  });
});

describe('matchesQuery', () => {
  const parts = ['Ananda Cafe', 'Asha Patel', 'asha@example.com', '+919714571522', 'NX-7K2Q9M', 'Visnagar'];

  it('matches every word typed, in any field, ignoring case', () => {
    expect(matchesQuery('ananda visnagar', parts)).toBe(true);
    expect(matchesQuery('ASHA@', parts)).toBe(true);
    expect(matchesQuery('nx-7k2', parts)).toBe(true);
    expect(matchesQuery('ananda surat', parts)).toBe(false);
  });

  it('finds a phone number typed with spaces or dashes', () => {
    expect(matchesQuery('97145 71522', parts)).toBe(true);
    expect(matchesQuery('9714-571522', parts)).toBe(true);
    expect(matchesQuery('+91 97145', parts)).toBe(true);
    expect(matchesQuery('9714571522', parts)).toBe(true);
    expect(matchesQuery('9999999999', parts)).toBe(false);
  });

  it('an empty search matches everything', () => {
    expect(matchesQuery('   ', parts)).toBe(true);
  });
});
