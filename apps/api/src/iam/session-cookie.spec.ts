import {
  DEVICE_REFRESH_COOKIE,
  MAX_SLOT_COOKIES,
  isValidSlot,
  selectSlotCookiesToDrop,
  slotCookieName,
  slotFromCookieName,
} from './session-cookie';

describe('session cookie naming (ADR-034)', () => {
  it('accepts 16-64 alphanumerics only', () => {
    expect(isValidSlot('a'.repeat(15))).toBe(false);
    expect(isValidSlot('a'.repeat(16))).toBe(true);
    expect(isValidSlot('A1'.repeat(32))).toBe(true);
    expect(isValidSlot('a'.repeat(65))).toBe(false);
    for (const bad of ['', 'abc def abc def abc', 'abc;def' + 'a'.repeat(10), 'a=b' + 'a'.repeat(14), 'a\r\nb' + 'a'.repeat(14), '../'.repeat(8)]) {
      expect(isValidSlot(bad)).toBe(false);
    }
  });

  it('round-trips a slot through its cookie name and never collides with the device cookie', () => {
    const slot = 'f0e1d2c3b4a5968778695a4b3c2d1e0f';
    expect(slotCookieName(slot)).toBe('nexus_rt_f0e1d2c3b4a5968778695a4b3c2d1e0f');
    expect(slotFromCookieName(slotCookieName(slot))).toBe(slot);
    expect(slotFromCookieName(DEVICE_REFRESH_COOKIE)).toBeNull();
    expect(slotFromCookieName('nexus_rt_short')).toBeNull();
    expect(slotFromCookieName('other_cookie')).toBeNull();
  });
});

describe('selectSlotCookiesToDrop', () => {
  const live = (name: string, lastSeenMs: number) => ({ name, alive: true, lastSeenMs });

  it('drops every dead cookie and keeps live ones', () => {
    const drop = selectSlotCookiesToDrop([live('a', 1), { name: 'b', alive: false, lastSeenMs: 0 }, live('c', 2)]);
    expect(drop).toEqual(['b']);
  });

  it('evicts the least recently used live cookies above the cap', () => {
    const states = Array.from({ length: MAX_SLOT_COOKIES + 3 }, (_, i) => live(`c${i}`, 1000 + i));
    const drop = selectSlotCookiesToDrop(states);
    expect(drop).toEqual(['c0', 'c1', 'c2']);
  });

  it('honours a custom cap and combines dead + excess', () => {
    const drop = selectSlotCookiesToDrop([live('old', 1), live('mid', 2), live('new', 3), { name: 'dead', alive: false, lastSeenMs: 9 }], 2);
    expect(drop.sort()).toEqual(['dead', 'old']);
  });

  it('does nothing for an empty or small set', () => {
    expect(selectSlotCookiesToDrop([])).toEqual([]);
    expect(selectSlotCookiesToDrop([live('a', 1)])).toEqual([]);
  });
});
