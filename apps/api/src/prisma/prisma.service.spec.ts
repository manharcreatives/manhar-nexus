import { withServerlessPoolLimit } from './prisma.service';

const POOLED = 'postgresql://u:p@ep-x-pooler.ap.aws.neon.tech/neondb?sslmode=require&pgbouncer=true';

describe('withServerlessPoolLimit', () => {
  it('adds connection_limit=1 to a pooled URL on Vercel', () => {
    expect(withServerlessPoolLimit(POOLED, { VERCEL: '1' })).toBe(`${POOLED}&connection_limit=1`);
  });
  it('keeps an operator-set limit', () => {
    const url = `${POOLED}&connection_limit=5`;
    expect(withServerlessPoolLimit(url, { VERCEL: '1' })).toBe(url);
  });
  it('leaves direct URLs and non-Vercel environments alone', () => {
    const direct = 'postgresql://u:p@ep-x.ap.aws.neon.tech/neondb?sslmode=require';
    expect(withServerlessPoolLimit(direct, { VERCEL: '1' })).toBe(direct);
    expect(withServerlessPoolLimit(POOLED, {})).toBe(POOLED);
    expect(withServerlessPoolLimit(undefined, { VERCEL: '1' })).toBeUndefined();
  });
  it('starts a query string when there is none', () => {
    expect(withServerlessPoolLimit('postgresql://u:p@ep-x-pooler.h/db', { VERCEL: '1' })).toBe('postgresql://u:p@ep-x-pooler.h/db?connection_limit=1');
  });
});
