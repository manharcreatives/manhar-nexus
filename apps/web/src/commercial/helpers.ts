import type { ActivationStatus, CommercialStatus } from './api';

export type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';

export const COMMERCIAL_STATUSES: CommercialStatus[] = ['PROSPECT', 'TRIAL', 'ACTIVE', 'SUSPENDED', 'CHURNED'];

export const COMMERCIAL_TONE: Record<CommercialStatus, Tone> = {
  PROSPECT: 'neutral',
  TRIAL: 'info',
  ACTIVE: 'ok',
  SUSPENDED: 'warn',
  CHURNED: 'bad',
};

export const ACTIVATION_TONE: Record<ActivationStatus, Tone> = {
  REQUESTED: 'info',
  QUOTED: 'info',
  APPROVED: 'accent',
  PENDING_SETUP: 'warn',
  ACTIVE: 'ok',
  SUSPENDED: 'warn',
  REMOVED: 'neutral',
};

/** Allowed next states (mirrors the API state machine; the API remains the authority). */
export const ACTIVATION_NEXT: Record<ActivationStatus, ActivationStatus[]> = {
  REQUESTED: ['QUOTED', 'REMOVED'],
  QUOTED: ['APPROVED', 'REMOVED'],
  APPROVED: ['PENDING_SETUP', 'QUOTED', 'REMOVED'],
  PENDING_SETUP: ['ACTIVE', 'REMOVED'],
  ACTIVE: ['SUSPENDED', 'REMOVED'],
  SUSPENDED: ['ACTIVE', 'REMOVED'],
  REMOVED: [],
};

/**
 * Validation-style failures (400/409/422) carry a message written for people;
 * anything else (network, 5xx, auth) gets the caller's friendly fallback.
 */
export function errorMessage(e: unknown, fallback: string): string {
  const err = e as { status?: number; message?: string } | null;
  if (err && (err.status === 400 || err.status === 409 || err.status === 422) && err.message) {
    return err.message;
  }
  return fallback;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "7 Nov 2026, 3:23 pm" (Indian date order, never the US month/day/year form). */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How long ago, in words an operator scans quickly: "just now", "5 min ago", "3 h ago", "2 days ago". */
export function relativeAge(iso: string, now: number = Date.now()): { key: 'now' | 'minutes' | 'hours' | 'days'; count: number } {
  const ms = Math.max(0, now - Date.parse(iso));
  if (ms < MINUTE) return { key: 'now', count: 0 };
  if (ms < HOUR) return { key: 'minutes', count: Math.floor(ms / MINUTE) };
  if (ms < DAY) return { key: 'hours', count: Math.floor(ms / HOUR) };
  return { key: 'days', count: Math.floor(ms / DAY) };
}

/** Days until the client's paid-until date: negative when it has passed, null when no date is known. */
export function daysUntil(iso: string | null | undefined, now: number = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - now) / DAY);
}

/** A paid-until date within this many days (or already past) puts the client on the renewals list. */
export const RENEWAL_WINDOW_DAYS = 14;

export type RenewalState = 'overdue' | 'soon' | 'ok' | 'unknown';

export function renewalState(paidUntil: string | null | undefined, now: number = Date.now()): RenewalState {
  const d = daysUntil(paidUntil, now);
  if (d === null) return 'unknown';
  if (d < 0) return 'overdue';
  return d <= RENEWAL_WINDOW_DAYS ? 'soon' : 'ok';
}

/** True when every word typed appears somewhere in the haystack parts (case-insensitive, digits-only phone match too). */
export function matchesQuery(query: string, parts: ReadonlyArray<string | null | undefined>): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = parts.filter((p): p is string => !!p).join(' ').toLowerCase();
  const digits = hay.replace(/\D/g, '');
  return words.every((w) => {
    if (hay.includes(w)) return true;
    // A phone typed with dashes, brackets or a +: compare digits only.
    const typedDigits = w.replace(/\D/g, '');
    return /^[\d+\-().]+$/.test(w) && typedDigits.length >= 3 && digits.includes(typedDigits);
  });
}

export const KEY_PATTERN = /^[a-z0-9-]+$/;

/**
 * Parses a user-typed major-unit amount ("1499" or "1499.50") into integer minor
 * units. Returns null when the text is not a valid non-negative amount.
 * Assumes a 2-decimal currency, the same assumption formatMoney makes.
 */
export function toMinorUnits(text: string): number | null {
  const s = text.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}
