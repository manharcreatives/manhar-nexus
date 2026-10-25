/**
 * Deterministic helpers for the demo seed.
 *
 * Every demo-history row gets an id derived from a stable key (sha256 → UUID),
 * so re-running the seed recomputes the same ids and simply skips rows that
 * already exist. Randomness is a seeded PRNG keyed by the same strings, so the
 * generated history is identical on every run (and on every machine).
 */
import { createHash } from 'node:crypto';

/** Stable UUID (RFC-4122 layout, version nibble 5) from an arbitrary key. */
export function uuidFrom(key: string): string {
  const h = createHash('sha256').update(`nexus-demo:${key}`).digest('hex');
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Seeded PRNG (mulberry32) with small convenience helpers. */
export class Rng {
  private state: number;

  constructor(seedKey: string) {
    this.state = createHash('sha256').update(seedKey).digest().readUInt32LE(0);
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Weighted pick from [value, weight] pairs. */
  weighted<T>(pairs: readonly (readonly [T, number])[]): T {
    const total = pairs.reduce((s, [, w]) => s + w, 0);
    let r = this.next() * total;
    for (const [v, w] of pairs) {
      r -= w;
      if (r < 0) return v;
    }
    return pairs[pairs.length - 1][0];
  }
}

// ── Asia/Kolkata calendar helpers (IST is a fixed UTC+05:30, no DST) ──────────

const IST_OFFSET_MS = 330 * 60_000;

/** IST calendar date (YYYY-MM-DD) of `now` shifted by `dayOffset` days. */
export function istDate(now: Date, dayOffset = 0): string {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS + dayOffset * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

/** The instant for `minutes` after IST midnight of the given IST date. */
export function istInstant(date: string, minutes: number): Date {
  const midnightUtc = Date.parse(`${date}T00:00:00.000Z`);
  return new Date(Math.round(midnightUtc - IST_OFFSET_MS + minutes * 60_000));
}

/** Day of week (0=Sunday) of an IST calendar date. */
export function istDayOfWeek(date: string): number {
  return new Date(`${date}T12:00:00.000Z`).getUTCDay();
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(Math.round(d.getTime() + minutes * 60_000));
}

/** Same formatting NumberingService applies: `${prefix}${zero-padded value}`. */
export function formatNumber(prefix: string | null, padding: number, value: bigint): string {
  return `${prefix ?? ''}${value.toString().padStart(padding, '0')}`;
}
