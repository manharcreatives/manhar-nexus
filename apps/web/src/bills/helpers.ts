import { parseMoney } from '../lib/money';

export interface RefundLike {
  amountMinorUnits: number;
  status: string;
}

export interface PaymentLike {
  status: string;
  amountMinorUnits: number;
  refunds?: RefundLike[];
}

/** Sum of refunds that count against the payment (FAILED refunds do not - same rule as the API). */
export function refundedTotal(refunds: RefundLike[] | undefined): number {
  return (refunds ?? []).filter((r) => r.status !== 'FAILED').reduce((s, r) => s + r.amountMinorUnits, 0);
}

/** Minor units still refundable on a payment; 0 unless it is CAPTURED. Never negative. */
export function refundableMinor(p: PaymentLike): number {
  if (p.status !== 'CAPTURED') return 0;
  return Math.max(0, p.amountMinorUnits - refundedTotal(p.refunds));
}

export type RefundAmountResult =
  | { ok: true; minor: number }
  | { ok: false; reason: 'empty' | 'invalid' | 'zero' | 'exceeds' };

/** Validates typed major-unit text against what is still refundable. */
export function validateRefundAmount(text: string, remainingMinor: number): RefundAmountResult {
  if (text.trim() === '') return { ok: false, reason: 'empty' };
  const minor = parseMoney(text);
  if (minor === null) return { ok: false, reason: 'invalid' };
  if (minor <= 0) return { ok: false, reason: 'zero' };
  if (minor > remainingMinor) return { ok: false, reason: 'exceeds' };
  return { ok: true, minor };
}

/** Whole-number minor units to plain major-unit text ("12.50"), for prefilling inputs. */
export function minorToInput(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** The idempotency key of one refund attempt: a specific amount on a specific payment. */
export interface RefundAttempt {
  key: string;
  paymentId: string;
  amountMinor: number;
}

/**
 * Key for the next refund submission. A retry of the same payment + amount
 * keeps the previous key (so an unknown outcome, e.g. a dropped connection,
 * replays the original refund instead of refunding twice); any change of
 * payment or amount starts a fresh attempt. Callers clear it after success.
 */
export function nextRefundAttempt(
  prev: RefundAttempt | null,
  paymentId: string,
  amountMinor: number,
  newKey: () => string,
): RefundAttempt {
  if (prev && prev.paymentId === paymentId && prev.amountMinor === amountMinor) return prev;
  return { key: newKey(), paymentId, amountMinor };
}

/** An invoice can be voided only before it is paid (the API rejects PAID and VOIDED). */
export function canVoid(status: string): boolean {
  return status === 'DRAFT' || status === 'FINALISED';
}

/**
 * Local calendar day (YYYY-MM-DD) to full ISO instants, so the filter follows the
 * viewer's day rather than UTC. Returns undefined for empty/invalid input.
 */
export function dayStartIso(day: string): string | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0).toISOString();
}
export function dayEndIso(day: string): string | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999).toISOString();
}

export type BillErrorKey =
  | 'network'
  | 'noAccess'
  | 'notFound'
  | 'exceeds'
  | 'notCaptured'
  | 'alreadyVoided'
  | 'paidCannotVoid'
  | 'versionConflict'
  | 'generic';

/** Classifies an API failure into a stable key the UI turns into a human sentence. */
export function classifyBillError(err: unknown): BillErrorKey {
  const e = err as { status?: number; code?: string; message?: string } | null;
  const status = e?.status;
  if (status === undefined) return 'network';
  const msg = (e?.message ?? '').toLowerCase();
  if (status === 401 || status === 403) return 'noAccess';
  if (status === 404) return 'notFound';
  if (e?.code === 'VERSION_CONFLICT') return 'versionConflict';
  if (msg.includes('exceeds remaining')) return 'exceeds';
  if (msg.includes('only captured')) return 'notCaptured';
  if (msg.includes('already voided')) return 'alreadyVoided';
  if (msg.includes('cannot void a paid')) return 'paidCannotVoid';
  if (status === 409) return 'versionConflict';
  return 'generic';
}
