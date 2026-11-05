import { describe, expect, it } from 'vitest';
import { BOT, placeTourBot } from './placement';

const VW = 1536;
const VH = 730;
const item = { left: 16, top: 200, width: 224, height: 44 };

describe('placeTourBot', () => {
  it('lands the bot just right of the menu item, centred on it, with the bubble further right', () => {
    const p = placeTourBot({ item, bubbleH: 120, vw: VW, vh: VH, desktop: true });
    expect(p.pos).toBe('out-right');
    expect(p.x).toBe(item.left + item.width + 16);
    expect(p.y).toBe(item.top + item.height / 2 - BOT / 2);
    expect(p.bubble.left).toBe(BOT + 6);
  });

  it('keeps a tall bubble on screen for an item at the very top, and points its circles back at the bot', () => {
    const top = placeTourBot({ item: { ...item, top: 10 }, bubbleH: 260, vw: VW, vh: VH, desktop: true });
    expect(top.y + top.bubble.top).toBeGreaterThanOrEqual(8);
    expect(top.tailY).not.toBeNull();
    const bottom = placeTourBot({ item: { ...item, top: 700 }, bubbleH: 260, vw: VW, vh: VH, desktop: true });
    expect(bottom.y + bottom.bubble.top + 260).toBeLessThanOrEqual(VH - 8);
  });

  it('sits bottom-right with the bubble to its left when there is nothing to point at', () => {
    const p = placeTourBot({ item: null, bubbleH: 150, vw: VW, vh: VH, desktop: true });
    expect(p.pos).toBe('out-left');
    expect(p.x).toBe(VW - BOT - 28);
    expect(p.y).toBe(VH - BOT - 28);
    expect(p.bubble.right).toBe(BOT + 6);
  });

  it('on a phone with nothing to point at, sits bottom-left with the bubble above it, inside the screen', () => {
    const p = placeTourBot({ item: null, bubbleH: 140, vw: 375, vh: 700, desktop: false });
    expect(p.pos).toBe('above');
    expect(p.x).toBe(10);
    expect(p.bubble.width).toBeLessThanOrEqual(375 - 16);
    expect(p.x + (p.bubble.left ?? 0)).toBeGreaterThanOrEqual(8);
    expect(p.x + (p.bubble.left ?? 0) + p.bubble.width).toBeLessThanOrEqual(375 - 8);
  });

  it('puts the bubble above (or below, near the top) the bot when it does not fit beside it', () => {
    const narrow = placeTourBot({ item: { left: 16, top: 400, width: 224, height: 44 }, bubbleH: 100, vw: 420, vh: 800, desktop: false });
    expect(narrow.pos).toBe('above');
    const nearTop = placeTourBot({ item: { left: 16, top: 10, width: 224, height: 44 }, bubbleH: 100, vw: 420, vh: 800, desktop: false });
    expect(nearTop.pos).toBe('below');
  });

  it('never leaves the viewport', () => {
    const p = placeTourBot({ item: { ...item, top: 5000 }, bubbleH: 100, vw: VW, vh: VH, desktop: true });
    expect(p.y).toBe(VH - BOT - 8);
  });
});
