import { describe, expect, it } from 'vitest';
import { computeAccess } from './access';
import { initialsOf, isProductionEnv } from './identity';
import { PAGES } from './pages';

describe('initialsOf', () => {
  it('uses first and last word', () => {
    expect(initialsOf('Asha Mehta Rao', 'a@x.in')).toBe('AR');
  });
  it('uses two letters of a single name', () => {
    expect(initialsOf('owner', 'a@x.in')).toBe('OW');
  });
  it('falls back to the email', () => {
    expect(initialsOf('', 'zoe@x.in')).toBe('Z');
    expect(initialsOf(null, null)).toBe('?');
  });
});

describe('isProductionEnv', () => {
  it('recognises production names only', () => {
    expect(isProductionEnv('production')).toBe(true);
    expect(isProductionEnv('prod')).toBe(true);
    expect(isProductionEnv('staging')).toBe(false);
    expect(isProductionEnv('development')).toBe(false);
  });
});

describe('page access (single definition)', () => {
  const visible = (realm: 'PLATFORM' | 'BUSINESS', ...keys: string[]) =>
    PAGES.filter((p) => p.can(computeAccess({ realm, roles: keys.map((key) => ({ key })) }))).map((p) => p.path);

  it('gives owners every tenant page and no platform page', () => {
    expect(visible('BUSINESS', 'owner')).toEqual([
      '/', '/modules', '/config', '/profile', '/reports', '/team', '/activity', '/tables', '/guest-orders', '/kitchen', '/bills', '/floor', '/menu', '/qr', '/costs',
    ]);
  });
  it('keeps the platform realm out of tenant pages', () => {
    expect(visible('PLATFORM', 'platform-admin')).toEqual(['/', '/commercial', '/onboarding']);
  });
  it('gives waiters a read-only kitchen queue', () => {
    expect(visible('BUSINESS', 'service-team')).toEqual(['/', '/tables', '/guest-orders', '/kitchen']);
  });
  it('limits kitchen staff to Home and Kitchen', () => {
    expect(visible('BUSINESS', 'kitchen-team')).toEqual(['/', '/kitchen']);
  });
  it('gives checkout associates tables and bills', () => {
    expect(visible('BUSINESS', 'checkout-associate')).toEqual(['/', '/tables', '/bills']);
  });
  it('has unique paths and go-keys', () => {
    const paths = PAGES.map((p) => p.path);
    const keys = PAGES.flatMap((p) => (p.goKey ? [p.goKey] : []));
    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
