import { describe, expect, it, vi } from 'vitest';
import { backoffDelay } from './backoff';
import { createCoalescer } from './coalesce';

describe('backoffDelay', () => {
  it('doubles from 0.5 s to a 15 s ceiling (no jitter at random=1)', () => {
    const seq = [0, 1, 2, 3, 4, 5, 6, 20].map((n) => backoffDelay(n, () => 1));
    expect(seq).toEqual([500, 1000, 2000, 4000, 8000, 15000, 15000, 15000]);
  });

  it('jitters between half and all of the ceiling', () => {
    expect(backoffDelay(3, () => 0)).toBe(2000);
    expect(backoffDelay(3, () => 0.5)).toBe(3000);
    for (let i = 0; i < 50; i++) {
      const d = backoffDelay(10);
      expect(d).toBeGreaterThanOrEqual(7500);
      expect(d).toBeLessThanOrEqual(15000);
    }
  });
});

describe('createCoalescer', () => {
  it('turns a burst into one call at the end of the window and can run again afterwards', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const c = createCoalescer(fn, 150);
    c.trigger();
    vi.advanceTimersByTime(100);
    c.trigger();
    c.trigger();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
    c.trigger();
    vi.advanceTimersByTime(150);
    expect(fn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('cancel drops a pending call', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const c = createCoalescer(fn, 150);
    c.trigger();
    c.cancel();
    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
