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
