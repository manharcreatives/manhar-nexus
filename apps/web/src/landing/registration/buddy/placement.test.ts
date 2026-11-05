import { describe, expect, it } from 'vitest';
import { BOT, BUBBLE_W, placeBuddy } from './placement';

// A 1536 x 730 screen: the form card spans x 718..1362; left-column fields start at 760, right-column ones at 1050.
const card = { left: 718, top: 100, width: 644, height: 900 };
const leftField = { left: 760, top: 300, width: 270, height: 44 };
const rightField = { left: 1050, top: 300, width: 270, height: 44 };
const wideField = { left: 760, top: 600, width: 560, height: 120 };
const VW = 1536;
const VH = 730;

describe('placeBuddy', () => {
  it('puts the bot to the left of a left-column field, vertically centred on it', () => {
    const p = placeBuddy(leftField, card, VW, VH);
    expect(p.side).toBe('left');
    expect(p.x).toBe(leftField.left - BOT - 6);
    expect(p.y).toBe(leftField.top + leftField.height / 2 - BOT / 2);
  });

  it('puts the bot to the right of a right-column field', () => {
    const p = placeBuddy(rightField, card, VW, VH);
    expect(p.side).toBe('right');
    expect(p.x).toBe(rightField.left + rightField.width + 6);
  });

  it('puts full-width fields (message, consent) on the left', () => {
    expect(placeBuddy(wideField, card, VW, VH).side).toBe('left');
  });

  it('opens the bubble outward when there is room beyond the bot', () => {
    const left = placeBuddy(leftField, card, VW, VH);
    expect(left.bubble.mode).toBe('out');
    expect(left.bubble.style.right).toBe(BOT + 4);
    // On the right there is only 1536 - 1326 - 104 = ~106px, which is not enough for the bubble.
    expect(placeBuddy(rightField, card, VW, VH).bubble.mode).toBe('above');
  });

  it('opens the bubble outward on the right too when the screen is wide enough', () => {
    const p = placeBuddy(rightField, { ...card, left: 400 }, 1920, VH);
    expect(p.bubble.mode).toBe('out');
    expect(p.bubble.style.left).toBe(BOT + 4);
  });

  it('keeps an above-bubble inside the viewport', () => {
    const p = placeBuddy(rightField, card, VW, VH);
    const left = p.bubble.style.left ?? 0;
    expect(p.x + left).toBeGreaterThanOrEqual(8);
    expect(p.x + left + BUBBLE_W).toBeLessThanOrEqual(VW - 8);
  });

  it('drops the bubble below the bot near the top of the screen', () => {
    const top = { ...rightField, top: 20 };
    expect(placeBuddy(top, card, VW, VH).bubble.mode).toBe('below');
  });

  it('never leaves the viewport, even for a field scrolled out of view', () => {
    const below = placeBuddy({ ...leftField, top: 2000 }, card, VW, VH);
    expect(below.y).toBe(VH - BOT - 8);
    const above = placeBuddy({ ...leftField, top: -500 }, card, VW, VH);
    expect(above.y).toBe(8);
    const edge = placeBuddy({ ...leftField, left: 20 }, card, VW, VH);
    expect(edge.x).toBe(8);
  });
});
