import { redactUrl } from './redact-url';

describe('redactUrl', () => {
  const token = 'Zk3-aB9_QwErTyUiOpAsDfGhJkLzXcVb';
  it('hides the table token in public menu URLs (path and sub-paths, query kept)', () => {
    expect(redactUrl(`/public/menu/${token}`)).toBe('/public/menu/Zk3-…');
    expect(redactUrl(`/public/menu/${token}/stream?x=1`)).toBe('/public/menu/Zk3-…/stream?x=1');
    expect(redactUrl(`/api/public/menu/${token}/orders`)).not.toContain(token);
  });
  it('leaves other URLs and empty values alone', () => {
    expect(redactUrl('/admin/orders/123')).toBe('/admin/orders/123');
    expect(redactUrl(undefined)).toBeUndefined();
  });
});
