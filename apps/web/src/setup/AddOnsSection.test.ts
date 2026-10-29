import { describe, expect, it } from 'vitest';
import { deltaLabel, limitsFor } from './AddOnsSection';

describe('add-on limits', () => {
  it('pick one is exactly one when required, at most one otherwise', () => {
    expect(limitsFor('SINGLE', true, '')).toEqual({ min: 1, max: 1 });
    expect(limitsFor('SINGLE', false, '9')).toEqual({ min: 0, max: 1 });
  });
  it('pick several: required means at least one; empty max means no limit', () => {
    expect(limitsFor('MULTIPLE', true, '')).toEqual({ min: 1, max: null });
    expect(limitsFor('MULTIPLE', false, '3')).toEqual({ min: 0, max: 3 });
  });
  it('rejects a max that is not a whole number of 1 or more', () => {
    expect(limitsFor('MULTIPLE', false, '0')).toBeNull();
    expect(limitsFor('MULTIPLE', false, '1.5')).toBeNull();
    expect(limitsFor('MULTIPLE', false, 'abc')).toBeNull();
  });
});

describe('deltaLabel', () => {
  it('shows free, plus and minus amounts', () => {
    expect(deltaLabel(0, 'free')).toBe('free');
    expect(deltaLabel(2000, 'free')).toContain('+');
    expect(deltaLabel(-1000, 'free')).toContain('−');
  });
});
