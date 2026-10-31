import { describe, expect, it } from 'vitest';
import { isContentPath, isHomePath, isPublicPath, normalizePath, POLICY_ROUTES } from './paths';

describe('isPublicPath', () => {
  it('treats the home page and every policy route as public', () => {
    expect(isPublicPath('/')).toBe(true);
    for (const r of POLICY_ROUTES) expect(isPublicPath(r.path)).toBe(true);
  });

  it('accepts article routes (and the /blog alias) but not their bare prefixes', () => {
    expect(isPublicPath('/insights/hidden-cost-of-order-mistakes')).toBe(true);
    expect(isPublicPath('/blog/kitchen-ticket-psychology')).toBe(true);
    expect(isPublicPath('/insights')).toBe(true); // alias, redirected to /#insights
  });

  it('accepts the legacy aliases from the copy docs', () => {
    expect(isPublicPath('/refund-cancellation')).toBe(true);
    expect(isPublicPath('/billing-payments')).toBe(true);
    expect(isPublicPath('/dpa')).toBe(true);
  });

  it('never treats /login or in-app paths as public', () => {
    for (const p of ['/login', '/bills', '/modules', '/kitchen', '/tables', '/commercial', '/terms/extra', '/termsx']) {
      expect(isPublicPath(p)).toBe(false);
    }
  });

  it('ignores trailing slashes, query strings and hashes', () => {
    expect(isPublicPath('/terms/')).toBe(true);
    expect(isPublicPath('/privacy?x=1')).toBe(true);
    expect(isPublicPath('/#pricing')).toBe(true);
    expect(normalizePath('/terms///')).toBe('/terms');
    expect(normalizePath('')).toBe('/');
  });
});

describe('path helpers', () => {
  it('isHomePath / isContentPath', () => {
    expect(isHomePath('/')).toBe(true);
    expect(isHomePath('/terms')).toBe(false);
    expect(isContentPath('/')).toBe(false);
    expect(isContentPath('/terms')).toBe(true);
    expect(isContentPath('/login')).toBe(false);
  });
});
