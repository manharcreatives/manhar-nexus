import type { PaymentRecord } from './paymentApi';

/**
 * Pure rules behind the checkout dialog's "change payment method" safety. No React, no network, so every
 * double-payment guard is unit-testable.
 *
 * The server is the real guard (idempotency key + one active payment per invoice under a tenant lock); this
 * file makes the client cooperate with it: one key per payment INTENT, reuse after a lost response,
 * a fresh key only when the intent really changed or the previous attempt was cancelled.
 */
export type CheckoutMethod = 'CASH' | 'UPI';

export interface PaymentIntent {
  invoiceId: string;
  method: CheckoutMethod;
  amountMinorUnits: number;
  /** Cash tendered (CASH only). The API refuses a replay whose tendered amount differs, so it is part of the intent. */
  cashReceivedMinorUnits?: number;
}

const fingerprint = (i: PaymentIntent) => `${i.invoiceId}|${i.method}|${i.amountMinorUnits}|${i.cashReceivedMinorUnits ?? ''}`;

export class PaymentKeyRing {
  private readonly keys = new Map<string, { method: CheckoutMethod; key: string }>();
  constructor(private readonly generate: () => string = () => crypto.randomUUID()) {}

  /** The same intent always gets the same key until it is retired, so a retry replays instead of paying twice. */
  keyFor(intent: PaymentIntent): string {
    const fp = fingerprint(intent);
    let entry = this.keys.get(fp);
    if (!entry) {
      entry = { method: intent.method, key: this.generate() };
      this.keys.set(fp, entry);
    }
    return entry.key;
  }

  /** Forget every key of a method (its attempt was cancelled): the server would otherwise replay the cancelled payment. */
  retireMethod(method: CheckoutMethod): void {
    for (const [fp, e] of this.keys) if (e.method === method) this.keys.delete(fp);
  }

  size(): number {
    return this.keys.size;
  }
}

export type RecordedState =
  | { kind: 'none' }
  | { kind: 'captured'; payment: PaymentRecord }
  | { kind: 'pending'; payment: PaymentRecord };

/** What the server already holds for this bill. Captured wins over pending; cancelled/failed attempts are history. */
export function classifyPayments(payments: readonly PaymentRecord[] | null | undefined): RecordedState {
  const list = payments ?? [];
  const captured = list.find((p) => p.status === 'CAPTURED');
  if (captured) return { kind: 'captured', payment: captured };
  const pending = list.find((p) => p.status === 'PENDING');
  if (pending) return { kind: 'pending', payment: pending };
  return { kind: 'none' };
}

export function errorStatus(err: unknown): number | undefined {
  const s = (err as { status?: unknown } | null)?.status;
  return typeof s === 'number' ? s : undefined;
}

/**
 * True when we cannot tell whether the server recorded the request: no HTTP answer at all (dropped connection,
 * timeout) or a 5xx. A 4xx is a definite "no", and 409 means "something is already recorded".
 */
export function isUnknownOutcome(err: unknown): boolean {
  const s = errorStatus(err);
  return s === undefined || s >= 500 || s === 408;
}

export const isConflict = (err: unknown): boolean => errorStatus(err) === 409;
