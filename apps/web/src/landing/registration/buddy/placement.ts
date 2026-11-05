/** Pixel box in viewport coordinates (what getBoundingClientRect returns, minus the extras). */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const BOT = 104;
export const BUBBLE_W = 240;
const GAP = 8;
/** How far the bot sits from the field it is watching. */
const NEAR = 6;

export interface Placement {
  /** The bot's top-left corner, viewport coordinates. */
  x: number;
  y: number;
  /** Which side of the field the bot sits on. */
  side: 'left' | 'right';
  /** Where the thought bubble goes relative to the bot, and its offsets (px) from the bot's box. */
  bubble: {
    mode: 'out' | 'above' | 'below';
    style: { left?: number; right?: number; top?: number; bottom?: number };
  };
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(Math.max(n, lo), Math.max(lo, hi));

/**
 * Where Manhar Bot sits so it is right beside the field being typed in.
 *
 * Fields in the left column (and full-width ones) get the bot on their left; fields in the right column get it on
 * their right. The bubble opens outward, away from the form, when the viewport has room for it; otherwise it sits
 * above the bot (or below, near the top of the screen) and is kept inside the viewport.
 */
export function placeBuddy(field: Box, card: Box, vw: number, vh: number): Placement {
  const fieldMid = field.left + field.width / 2;
  const cardMid = card.left + card.width / 2;
  const fullWidth = field.width > card.width * 0.7;
  const side: 'left' | 'right' = !fullWidth && fieldMid > cardMid ? 'right' : 'left';

  const y = clamp(field.top + field.height / 2 - BOT / 2, GAP, vh - BOT - GAP);
  const x = clamp(
    side === 'left' ? field.left - BOT - NEAR : field.left + field.width + NEAR,
    GAP,
    vw - BOT - GAP,
  );

  const room = side === 'left' ? x - GAP : vw - (x + BOT) - GAP;
  if (room >= BUBBLE_W) {
    const bottom = Math.round(BOT * 0.4);
    return {
      x,
      y,
      side,
      bubble: { mode: 'out', style: side === 'left' ? { right: BOT + 4, bottom } : { left: BOT + 4, bottom } },
    };
  }

  const left = clamp((BOT - BUBBLE_W) / 2, GAP - x, vw - GAP - BUBBLE_W - x);
  return y < 150
    ? { x, y, side, bubble: { mode: 'below', style: { left, top: BOT - 6 } } }
    : { x, y, side, bubble: { mode: 'above', style: { left, bottom: BOT - 6 } } };
}
