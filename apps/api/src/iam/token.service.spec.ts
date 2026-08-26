import { hashRefresh } from './token.service';

describe('hashRefresh', () => {
  it('is deterministic (same token → same hash)', () => {
    expect(hashRefresh('abc')).toBe(hashRefresh('abc'));
  });

  it('differs for different tokens and never returns the raw token', () => {
    const raw = 'super-secret-refresh-token';
    const hashed = hashRefresh(raw);
    expect(hashed).not.toBe(raw);
    expect(hashed).not.toBe(hashRefresh('other'));
    expect(hashed).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
  });
});
