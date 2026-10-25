import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALL_LOCATIONS, readStored, resolveLocationId, storageKey, writeStored } from './locationDefault';

const one = [{ id: 'a' }];
const many = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('resolveLocationId', () => {
  it('is null when there are no locations', () => {
    expect(resolveLocationId([], 'a')).toBeNull();
  });

  it('always picks the only location', () => {
    expect(resolveLocationId(one, null)).toBe('a');
    expect(resolveLocationId(one, ALL_LOCATIONS)).toBe('a');
    expect(resolveLocationId(one, 'gone')).toBe('a');
  });

  it('restores the last used location when it is still accessible', () => {
    expect(resolveLocationId(many, 'b')).toBe('b');
  });

  it('falls back to All locations otherwise', () => {
    expect(resolveLocationId(many, null)).toBeNull();
    expect(resolveLocationId(many, ALL_LOCATIONS)).toBeNull();
    expect(resolveLocationId(many, 'removed-id')).toBeNull();
  });
});

describe('persistence', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('stores per user', () => {
    writeStored('u1', 'b');
    writeStored('u2', null);
    expect(readStored('u1')).toBe('b');
    expect(readStored('u2')).toBe(ALL_LOCATIONS);
    expect(window.localStorage.getItem(storageKey('u1'))).toBe('b');
  });

  it('survives blocked storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    expect(readStored('u1')).toBeNull();
    expect(() => writeStored('u1', 'a')).not.toThrow();
  });
});
