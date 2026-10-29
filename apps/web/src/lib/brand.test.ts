import { describe, expect, it } from 'vitest';
import { hexToRgb, luminance } from './brand';

describe('brand colour helpers', () => {
  it('parses six-digit hex and rejects anything else', () => {
    expect(hexToRgb('#22c55e')).toEqual([34, 197, 94]);
    expect(hexToRgb('#FFF')).toBeNull();
    expect(hexToRgb('red')).toBeNull();
  });
  it('tells light colours from dark ones', () => {
    expect(luminance([255, 255, 255])).toBeCloseTo(1, 2);
    expect(luminance([0, 0, 0])).toBe(0);
    expect(luminance([34, 197, 94])).toBeGreaterThan(0.4);
    expect(luminance([30, 41, 120])).toBeLessThan(0.4);
  });
});
