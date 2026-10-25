import { describe, expect, it } from 'vitest';
import { bandLayout, barPath, labelStride, linearScale, niceStep, niceTicks, sharePercents, sparklinePoints } from './scale';

describe('linearScale', () => {
  it('maps domain onto range, including inverted ranges', () => {
    const s = linearScale([0, 100], [200, 0]);
    expect(s(0)).toBe(200);
    expect(s(50)).toBe(100);
    expect(s(100)).toBe(0);
  });
  it('maps a zero-width domain to the range start', () => {
    expect(linearScale([5, 5], [10, 20])(5)).toBe(10);
  });
});

describe('niceStep / niceTicks', () => {
  it('picks 1-2-2.5-5 steps', () => {
    expect(niceStep(100, 4)).toBe(25);
    expect(niceStep(1000, 5)).toBe(200);
    expect(niceStep(7, 4)).toBe(2);
    expect(niceStep(0, 4)).toBe(1);
  });
  it('starts at zero and covers the max with a nice ceiling', () => {
    expect(niceTicks(9_340_00, 4)).toEqual({ ticks: [0, 250000, 500000, 750000, 1000000], top: 1000000 });
    expect(niceTicks(100, 4)).toEqual({ ticks: [0, 25, 50, 75, 100], top: 100 });
  });
  it('still draws an axis for an all-zero or invalid series', () => {
    expect(niceTicks(0)).toEqual({ ticks: [0, 1], top: 1 });
    expect(niceTicks(Number.NaN).ticks[0]).toBe(0);
  });
  it('produces float-clean ticks', () => {
    const { ticks } = niceTicks(0.3, 3);
    for (const t of ticks) expect(String(t).length).toBeLessThan(6);
  });
});

describe('bandLayout', () => {
  it('spaces n bands evenly with a centered gap', () => {
    const { x, band } = bandLayout(4, 400, 0.5);
    expect(band).toBe(50);
    expect(x(0)).toBe(25);
    expect(x(3)).toBe(325);
  });
  it('handles empty input', () => {
    expect(bandLayout(0, 400).band).toBe(0);
  });
});

describe('sharePercents', () => {
  it('always sums to 100 using largest remainder', () => {
    const p = sharePercents([1, 1, 1]);
    expect(p.reduce((s, v) => s + v, 0)).toBe(100);
    expect(p).toEqual([34, 33, 33]);
  });
  it('ignores negatives and returns zeros for an empty total', () => {
    expect(sharePercents([0, 0])).toEqual([0, 0]);
    expect(sharePercents([-5, 5])).toEqual([0, 100]);
  });
});

describe('labelStride', () => {
  it('thins labels to fit', () => {
    expect(labelStride(7, 7)).toBe(1);
    expect(labelStride(31, 8)).toBe(4);
    expect(labelStride(0, 8)).toBe(1);
  });
});

describe('barPath', () => {
  it('rounds only the top corners and anchors to the baseline', () => {
    expect(barPath(0, 10, 20, 50, 4)).toBe('M0,60 V14 Q0,10 4,10 H16 Q20,10 20,14 V60 Z');
  });
  it('clamps the radius for short bars and draws nothing at zero', () => {
    expect(barPath(0, 10, 20, 2, 4)).toContain('V12');
    expect(barPath(0, 10, 20, 0)).toBe('');
  });
});

describe('sparklinePoints', () => {
  it('spans the box and flips y so larger is higher', () => {
    const pts = sparklinePoints([0, 10], 100, 20, 0);
    expect(pts).toEqual([
      [0, 20],
      [100, 0],
    ]);
  });
  it('centers a single point', () => {
    expect(sparklinePoints([3], 100, 20)[0][0]).toBe(50);
  });
});
