/**
 * Pure geometry helpers for the hand-built SVG charts. No DOM, no React —
 * everything here is unit tested in scale.test.ts.
 */

/** Maps a value in [d0, d1] onto [r0, r1]. A zero-width domain maps to r0. */
export function linearScale(domain: [number, number], range: [number, number]): (v: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  return (v: number) => (span === 0 ? r0 : r0 + ((v - d0) / span) * (r1 - r0));
}

/** The "nice" step (1, 2, 2.5 or 5 x 10^n) that splits `span` into about `count` intervals. */
export function niceStep(span: number, count: number): number {
  if (!(span > 0) || !(count > 0)) return 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

/**
 * Ticks from 0 up to a nice ceiling covering `max` (bars always start at zero).
 * Returns at least [0, step] so an all-zero series still draws an axis.
 */
export function niceTicks(max: number, count = 4): { ticks: number[]; top: number } {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 0;
  if (safeMax === 0) return { ticks: [0, 1], top: 1 };
  const step = niceStep(safeMax, count);
  const top = Math.max(step, Math.ceil(safeMax / step - 1e-9) * step);
  const ticks: number[] = [];
  // Integer stepping avoids float drift (0.1 + 0.2 style) in tick values.
  const n = Math.round(top / step);
  for (let i = 0; i <= n; i++) ticks.push(Number((i * step).toPrecision(12)));
  return { ticks, top };
}

/** Evenly spaced bands for `n` bars across `width`, with a gap ratio between them. */
export function bandLayout(n: number, width: number, gapRatio = 0.3): { x: (i: number) => number; band: number } {
  if (n <= 0) return { x: () => 0, band: 0 };
  const slot = width / n;
  const band = slot * (1 - gapRatio);
  return { x: (i: number) => i * slot + (slot - band) / 2, band };
}

/**
 * Whole-number percentages that always sum to 100 (largest remainder), so a
 * share legend never reads 99% or 101%. All-zero input yields all zeros.
 */
export function sharePercents(values: number[]): number[] {
  const clean = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const total = clean.reduce((s, v) => s + v, 0);
  if (total === 0) return clean.map(() => 0);
  const exact = clean.map((v) => (v / total) * 100);
  const floors = exact.map(Math.floor);
  let left = 100 - floors.reduce((s, v) => s + v, 0);
  const order = exact.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return floors;
}

/** Which tick labels to show so they never crowd: every k-th label, always the last. */
export function labelStride(n: number, maxLabels: number): number {
  if (n <= 0 || maxLabels <= 0) return 1;
  return Math.max(1, Math.ceil(n / maxLabels));
}

/**
 * SVG path for a bar anchored to the baseline with only its data-end (top)
 * rounded. Radius shrinks for short or narrow bars; zero height draws nothing.
 */
export function barPath(x: number, y: number, w: number, h: number, r = 4): string {
  if (h <= 0 || w <= 0) return '';
  const rr = Math.max(0, Math.min(r, w / 2, h));
  const f = (n: number) => Number(n.toFixed(2));
  return [
    `M${f(x)},${f(y + h)}`,
    `V${f(y + rr)}`,
    `Q${f(x)},${f(y)} ${f(x + rr)},${f(y)}`,
    `H${f(x + w - rr)}`,
    `Q${f(x + w)},${f(y)} ${f(x + w)},${f(y + rr)}`,
    `V${f(y + h)}`,
    'Z',
  ].join(' ');
}

/** Points for a sparkline polyline inside a w x h box with `pad` inset. */
export function sparklinePoints(values: number[], w: number, h: number, pad = 2): [number, number][] {
  if (values.length === 0) return [];
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const x = linearScale([0, Math.max(1, values.length - 1)], [pad, w - pad]);
  const y = linearScale([min, max === min ? min + 1 : max], [h - pad, pad]);
  return values.map((v, i) => [values.length === 1 ? w / 2 : x(i), y(v)]);
}
