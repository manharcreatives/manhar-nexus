/** Pixel box in viewport coordinates. */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const BOT = 96;
const GAP = 8;
/** Space between the highlighted menu item and the bot. */
const NEAR = 16;
const MAX_BUBBLE_W = 288;

export type BubblePos = 'out-right' | 'out-left' | 'above' | 'below';

export interface TourPlacement {
  /** The bot's top-left corner, viewport coordinates. */
  x: number;
  y: number;
  pos: BubblePos;
  /** The bubble's width and its offsets (px) from the bot's box. */
  bubble: { width: number; left?: number; right?: number; top: number };
  /** Where the thought-bubble circles attach, measured down from the bubble's top edge; null for above/below. */
  tailY: number | null;
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(Math.max(n, lo), Math.max(lo, hi));

/**
 * Where Manhar Bot and its thought bubble go for a tour step.
 *
 * With a menu item to point at, the bot lands just to the right of it and the bubble opens further right, centred on
 * the bot but kept inside the screen however tall the text is. With no item (the questions, the welcome, the goodbye) the
 * bot sits in the bottom-right corner with the bubble to its left; on a phone it sits bottom-left. When a bubble does
 * not fit beside the bot it goes above it (or below, near the top of the screen).
 */
export function placeTourBot(input: { item: Box | null; bubbleH: number; vw: number; vh: number; desktop: boolean }): TourPlacement {
  const { item, bubbleH: h, vw, vh, desktop } = input;
  const width = Math.min(MAX_BUBBLE_W, vw - 2 * GAP);

  let x: number;
  let y: number;
  if (item) {
    x = clamp(item.left + item.width + NEAR, GAP, vw - BOT - GAP);
    y = clamp(item.top + item.height / 2 - BOT / 2, GAP, vh - BOT - GAP);
  } else if (desktop) {
    x = vw - BOT - 28;
    y = vh - BOT - 28;
  } else {
    x = 10;
    y = vh - BOT - 10;
  }

  const outTop = (): number => clamp(BOT / 2 - h / 2, GAP - y, vh - GAP - y - h);
  const tail = (top: number): number => clamp(BOT / 2 - top, 20, Math.max(20, h - 20));

  if (item || desktop) {
    const roomRight = vw - (x + BOT) - GAP;
    const roomLeft = x - GAP;
    if (item && roomRight >= width + 6) {
      const top = outTop();
      return { x, y, pos: 'out-right', bubble: { width, left: BOT + 6, top }, tailY: tail(top) };
    }
    if (!item && roomLeft >= width + 6) {
      const top = outTop();
      return { x, y, pos: 'out-left', bubble: { width, right: BOT + 6, top }, tailY: tail(top) };
    }
  }

  const left = clamp((BOT - width) / 2, GAP - x, vw - GAP - width - x);
  return y - h - 12 >= GAP
    ? { x, y, pos: 'above', bubble: { width, left, top: -(h + 12) }, tailY: null }
    : { x, y, pos: 'below', bubble: { width, left, top: BOT + 12 }, tailY: null };
}
