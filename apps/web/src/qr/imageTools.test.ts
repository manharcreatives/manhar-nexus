import { describe, expect, it } from 'vitest';
import {
  ASPECT,
  MAX_INPUT_BYTES,
  cropRect,
  isTooSmall,
  outputSize,
  panCenter,
  validateImageFile,
} from './imageTools';

describe('validateImageFile', () => {
  it('accepts jpeg, png and webp', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) expect(validateImageFile({ type, size: 1000 })).toBeNull();
  });
  it('rejects other types, empty files and oversized files', () => {
    expect(validateImageFile({ type: 'image/gif', size: 1000 })).toBe('type');
    expect(validateImageFile({ type: 'application/pdf', size: 1000 })).toBe('type');
    expect(validateImageFile({ type: 'image/svg+xml', size: 1000 })).toBe('type');
    expect(validateImageFile({ type: 'image/png', size: 0 })).toBe('empty');
    expect(validateImageFile({ type: 'image/png', size: MAX_INPUT_BYTES + 1 })).toBe('size');
  });
});

describe('cropRect (4:5 dish photos)', () => {
  const dish = ASPECT.dish;
  it('fits the largest 4:5 window in a landscape photo, centred', () => {
    const r = cropRect({ w: 4000, h: 3000 }, dish, 1);
    expect(r.sh).toBe(3000);
    expect(r.sw).toBeCloseTo(2400, 6);
    expect(r.sw / r.sh).toBeCloseTo(0.8, 6);
    expect(r.sx).toBeCloseTo(800, 6);
    expect(r.sy).toBe(0);
  });
  it('fits a portrait photo by width', () => {
    const r = cropRect({ w: 1000, h: 2000 }, dish, 1);
    expect(r.sw).toBe(1000);
    expect(r.sh).toBeCloseTo(1250, 6);
    expect(r.sy).toBeCloseTo(375, 6);
  });
  it('zoom shrinks the window and keeps the aspect', () => {
    const r = cropRect({ w: 4000, h: 3000 }, dish, 2);
    expect(r.sw / r.sh).toBeCloseTo(0.8, 6);
    expect(r.sh).toBeCloseTo(1500, 6);
  });
  it('never leaves the image, whatever the centre', () => {
    const img = { w: 4000, h: 3000 };
    for (const center of [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: -3, y: 9 }]) {
      const r = cropRect(img, dish, 1.5, center);
      expect(r.sx).toBeGreaterThanOrEqual(0);
      expect(r.sy).toBeGreaterThanOrEqual(0);
      expect(r.sx + r.sw).toBeLessThanOrEqual(img.w + 1e-9);
      expect(r.sy + r.sh).toBeLessThanOrEqual(img.h + 1e-9);
    }
  });
  it('clamps absurd zoom values', () => {
    const a = cropRect({ w: 4000, h: 3000 }, dish, 100);
    const b = cropRect({ w: 4000, h: 3000 }, dish, 4);
    expect(a.sw).toBeCloseTo(b.sw, 6);
  });
});

describe('panCenter', () => {
  const img = { w: 4000, h: 3000 };
  it('dragging the picture right moves the window left', () => {
    const rect = cropRect(img, ASPECT.dish, 1);
    const next = panCenter({ x: 0.5, y: 0.5 }, { x: 50, y: 0 }, 300, rect, img);
    expect(next.x).toBeLessThan(0.5);
    expect(next.y).toBe(0.5);
  });
  it('ignores a zero-width frame and stays inside 0..1', () => {
    const rect = cropRect(img, ASPECT.dish, 1);
    expect(panCenter({ x: 0.5, y: 0.5 }, { x: 10, y: 10 }, 0, rect, img)).toEqual({ x: 0.5, y: 0.5 });
    const far = panCenter({ x: 0.5, y: 0.5 }, { x: -1e9, y: 1e9 }, 300, rect, img);
    expect(far.x).toBe(1);
    expect(far.y).toBe(0);
  });
});

describe('outputSize', () => {
  it('uses the preset for big sources and never upscales small ones', () => {
    expect(outputSize('dish', { sx: 0, sy: 0, sw: 3000, sh: 3750 })).toEqual({ w: 1200, h: 1500 });
    const small = outputSize('dish', { sx: 0, sy: 0, sw: 600, sh: 750 });
    expect(small.w).toBe(600);
    expect(small.w / small.h).toBeCloseTo(0.8, 2);
  });
  it('flags tiny sources', () => {
    expect(isTooSmall({ w: 200, h: 4000 })).toBe(true);
    expect(isTooSmall({ w: 800, h: 600 })).toBe(false);
  });
});
