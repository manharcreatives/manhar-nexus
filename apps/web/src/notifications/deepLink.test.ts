import { describe, expect, it } from 'vitest';
import { resolveDeepLink } from './NotificationsPanel';

describe('resolveDeepLink', () => {
  it('accepts known in-app routes', () => {
    expect(resolveDeepLink('/kitchen')).toBe('/kitchen');
    expect(resolveDeepLink('/tables/abc?x=1')).toBe('/tables/abc?x=1');
  });
  it('rejects unknown, external and empty links', () => {
    expect(resolveDeepLink(null)).toBeNull();
    expect(resolveDeepLink('/nope')).toBeNull();
    expect(resolveDeepLink('//evil.com/reports')).toBeNull();
    expect(resolveDeepLink('https://evil.com/reports')).toBeNull();
    expect(resolveDeepLink('javascript:alert(1)')).toBeNull();
  });
});
