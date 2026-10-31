import { RateLimitedError } from './guestmenu.errors';
import { RateLimiter, clientIp } from './rate-limiter.service';

describe('RateLimiter', () => {
  let rl: RateLimiter;
  beforeEach(() => {
    rl = new RateLimiter();
  });
  afterEach(() => rl.onModuleDestroy());

  it('allows up to the limit inside a window, then returns the wait in seconds', () => {
    const rule = { key: 'k', limit: 3, windowMs: 10_000 };
    const t = 1_000_000;
    expect(rl.hit(rule, t)).toBe(0);
    expect(rl.hit(rule, t + 1)).toBe(0);
    expect(rl.hit(rule, t + 2)).toBe(0);
    expect(rl.hit(rule, t + 3)).toBeGreaterThanOrEqual(9);
    expect(rl.peek('k', t + 3)).toBe(4);
  });

  it('starts a fresh window after it elapses and keeps keys independent', () => {
    const rule = { key: 'a', limit: 1, windowMs: 1000 };
    expect(rl.hit(rule, 0)).toBe(0);
    expect(rl.hit(rule, 10)).toBeGreaterThan(0);
    expect(rl.hit(rule, 1500)).toBe(0);
    expect(rl.hit({ ...rule, key: 'b' }, 10)).toBe(0);
    expect(rl.peek('a', 5000)).toBe(0);
  });

  it('enforce throws RateLimitedError with Retry-After and counts every rule', () => {
    const headers: Record<string, string> = {};
    const res = { setHeader: (k: string, v: string) => (headers[k] = v) } as never;
    const rules = [
      { key: 'ip', limit: 1, windowMs: 60_000 },
      { key: 'tok', limit: 100, windowMs: 60_000 },
    ];
    rl.enforce(res, rules);
    let err: unknown;
    try {
      rl.enforce(res, rules);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(RateLimitedError);
    expect(Number(headers['Retry-After'])).toBeGreaterThan(0);
    expect(rl.peek('tok')).toBe(2);
  });

  it('acquire caps concurrent slots and release is idempotent', () => {
    const a = rl.acquire('s', 2);
    const b = rl.acquire('s', 2);
    expect(a && b).toBeTruthy();
    expect(rl.acquire('s', 2)).toBeNull();
    a?.();
    a?.();
    expect(rl.concurrentCount('s')).toBe(1);
    expect(rl.acquire('s', 2)).not.toBeNull();
  });

  it('clientIp falls back safely', () => {
    expect(clientIp({ ip: ' 10.0.0.1 ' })).toBe('10.0.0.1');
    expect(clientIp({})).toBe('unknown');
  });
});
