import { GUEST_TOKEN_REGEX, TABLE_TOKEN_REGEX, etagMatches, fingerprint, idempotencyUuid, newGuestToken, newTableToken, safeEqual, sha256Hex, stable, weakEtag } from './guestmenu.tokens';

describe('guest menu tokens', () => {
  it('table tokens carry 192 bits (32 base64url chars) and never repeat', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const t = newTableToken();
      expect(t).toMatch(TABLE_TOKEN_REGEX);
      seen.add(t);
    }
    expect(seen.size).toBe(500);
    expect(Buffer.from(newTableToken(), 'base64url')).toHaveLength(24);
  });

  it('guest tokens carry 256 bits (43 base64url chars)', () => {
    const t = newGuestToken();
    expect(t).toMatch(GUEST_TOKEN_REGEX);
    expect(Buffer.from(t, 'base64url')).toHaveLength(32);
    expect(t).not.toMatch(TABLE_TOKEN_REGEX);
  });

  it('sha256Hex is the stored form and safeEqual is a constant-time compare', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  it('idempotencyUuid is a stable v5-shaped UUID per (guest, key)', () => {
    const a = idempotencyUuid('guest-1', 'order-key-0001');
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(idempotencyUuid('guest-1', 'order-key-0001')).toBe(a);
    expect(idempotencyUuid('guest-2', 'order-key-0001')).not.toBe(a);
    expect(idempotencyUuid('guest-1', 'order-key-0002')).not.toBe(a);
  });

  it('stable/fingerprint ignore key order and detect any change', () => {
    expect(stable({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(stable({ a: [2, { c: 2, d: 1 }], b: 1 }));
    expect(fingerprint({ a: 1, b: 2 })).toBe(fingerprint({ b: 2, a: 1 }));
    expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }));
    expect(fingerprint({})).toHaveLength(16);
  });

  it('etagMatches follows If-None-Match semantics (weak compare, lists, star)', () => {
    const e = weakEtag('abcd1234abcd1234');
    expect(etagMatches(e, e)).toBe(true);
    expect(etagMatches('"abcd1234abcd1234"', e)).toBe(true);
    expect(etagMatches('W/"zzzz", ' + e, e)).toBe(true);
    expect(etagMatches('*', e)).toBe(true);
    expect(etagMatches('W/"other"', e)).toBe(false);
    expect(etagMatches(undefined, e)).toBe(false);
  });
});
