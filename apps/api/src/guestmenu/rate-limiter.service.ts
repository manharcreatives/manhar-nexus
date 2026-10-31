import { Injectable, OnModuleDestroy } from '@nestjs/common';
import type { Response } from 'express';
import { RateLimitedError } from './guestmenu.errors';

export interface RateRule {
  /** Namespaced key, e.g. `order:ip:1.2.3.4`. Never contains a raw secret token (callers pass a hash prefix). */
  key: string;
  limit: number;
  windowMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const MAX_KEYS = 200_000;

/**
 * Small in-memory fixed-window limiter for the PUBLIC guest endpoints (per IP, per table token, per guest token).
 * In-memory means per API instance, exactly like the registration throttle (ADR-033); Redis-backed limits are the
 * documented follow-up before scaling out. It also counts concurrent SSE streams.
 *
 * Why not @nestjs/throttler: the module is registered once with a single global rule; the guest endpoints need several
 * independent keys per request (IP AND table token AND guest token) with different limits, which this does in one call.
 */
@Injectable()
export class RateLimiter implements OnModuleDestroy {
  private readonly buckets = new Map<string, Bucket>();
  private readonly concurrent = new Map<string, number>();
  private readonly sweeper: NodeJS.Timeout;

  constructor() {
    this.sweeper = setInterval(() => this.sweep(), 60_000);
    this.sweeper.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.sweeper);
  }

  /** Counts one hit. Returns the seconds to wait when the limit is exceeded, else 0. */
  hit(rule: RateRule, now = Date.now()): number {
    let b = this.buckets.get(rule.key);
    if (!b || b.resetAt <= now) {
      if (this.buckets.size >= MAX_KEYS) this.sweep(now);
      if (this.buckets.size >= MAX_KEYS) this.buckets.clear(); // memory guard under a key-flooding attack
      b = { count: 0, resetAt: now + rule.windowMs };
      this.buckets.set(rule.key, b);
    }
    b.count += 1;
    return b.count > rule.limit ? Math.max(1, Math.ceil((b.resetAt - now) / 1000)) : 0;
  }

  /** Current count of a key without counting (diagnostics, failure penalties). */
  peek(key: string, now = Date.now()): number {
    const b = this.buckets.get(key);
    return b && b.resetAt > now ? b.count : 0;
  }

  /**
   * Applies every rule; the first exceeded one throws RateLimitedError (429) and sets Retry-After.
   * All rules are counted even when an earlier one blocks, so a blocked client stays blocked for the window.
   */
  enforce(res: Response | undefined, rules: RateRule[]): void {
    let wait = 0;
    for (const r of rules) wait = Math.max(wait, this.hit(r));
    if (wait > 0) {
      res?.setHeader('Retry-After', String(wait));
      throw new RateLimitedError('Too many requests. Please wait a moment and try again.', wait);
    }
  }

  /** Reserves a concurrent slot (e.g. an open SSE stream). Returns a release function, or null when `max` is reached. */
  acquire(key: string, max: number): (() => void) | null {
    const n = this.concurrent.get(key) ?? 0;
    if (n >= max) return null;
    this.concurrent.set(key, n + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const cur = this.concurrent.get(key) ?? 1;
      if (cur <= 1) this.concurrent.delete(key);
      else this.concurrent.set(key, cur - 1);
    };
  }

  concurrentCount(key: string): number {
    return this.concurrent.get(key) ?? 0;
  }

  private sweep(now = Date.now()): void {
    for (const [k, b] of this.buckets) if (b.resetAt <= now) this.buckets.delete(k);
  }
}

/** Client address for limiting. `req.ip` honours TRUST_PROXY (hop count) exactly like the rest of the API. */
export const clientIp = (req: { ip?: string }): string => (req.ip && req.ip.trim() ? req.ip.trim() : 'unknown');
