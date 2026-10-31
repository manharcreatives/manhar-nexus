import { describe, expect, it } from 'vitest';
import { PaymentKeyRing, classifyPayments, isConflict, isUnknownOutcome } from './paymentFlow';
import type { PaymentRecord } from './paymentApi';

const counter = () => {
  let n = 0;
  return () => `key-${++n}`;
};
const pay = (over: Partial<PaymentRecord> = {}): PaymentRecord => ({ id: 'p1', invoiceId: 'inv', method: 'UPI', status: 'PENDING', amountMinorUnits: 52500, ...over });

describe('PaymentKeyRing', () => {
  const base = { invoiceId: 'inv', method: 'CASH' as const, amountMinorUnits: 52500 };

  it('gives the same intent the same key, so a retry replays instead of paying twice', () => {
    const ring = new PaymentKeyRing(counter());
    const a = ring.keyFor({ ...base, cashReceivedMinorUnits: 60000 });
    expect(ring.keyFor({ ...base, cashReceivedMinorUnits: 60000 })).toBe(a);
    expect(ring.size()).toBe(1);
  });

  it('gives a changed intent a new key (a different cash amount must not replay the old one: the API answers 409)', () => {
    const ring = new PaymentKeyRing(counter());
    const a = ring.keyFor({ ...base, cashReceivedMinorUnits: 60000 });
    const b = ring.keyFor({ ...base, cashReceivedMinorUnits: 70000 });
    const c = ring.keyFor({ ...base, method: 'UPI' });
    expect(new Set([a, b, c]).size).toBe(3);
    expect(ring.keyFor({ ...base, cashReceivedMinorUnits: 60000 })).toBe(a); // going back reuses it
  });

  it('keeps invoices apart', () => {
    const ring = new PaymentKeyRing(counter());
    expect(ring.keyFor({ ...base, invoiceId: 'a' })).not.toBe(ring.keyFor({ ...base, invoiceId: 'b' }));
  });

  it('retiring a method forgets only that method: a cancelled UPI attempt must never replay its cancelled payment', () => {
    const ring = new PaymentKeyRing(counter());
    const upi1 = ring.keyFor({ ...base, method: 'UPI' });
    const cash = ring.keyFor({ ...base, cashReceivedMinorUnits: 52500 });
    ring.retireMethod('UPI');
    expect(ring.keyFor({ ...base, method: 'UPI' })).not.toBe(upi1);
    expect(ring.keyFor({ ...base, cashReceivedMinorUnits: 52500 })).toBe(cash);
  });
});

describe('classifyPayments', () => {
  it('ignores cancelled and failed attempts', () => {
    expect(classifyPayments([pay({ status: 'CANCELLED' }), pay({ id: 'p2', status: 'FAILED' })])).toEqual({ kind: 'none' });
    expect(classifyPayments([])).toEqual({ kind: 'none' });
    expect(classifyPayments(null)).toEqual({ kind: 'none' });
  });
  it('finds a pending payment', () => {
    expect(classifyPayments([pay({ status: 'CANCELLED', id: 'old' }), pay()])).toMatchObject({ kind: 'pending', payment: { id: 'p1' } });
  });
  it('lets a captured payment win over a pending one', () => {
    expect(classifyPayments([pay(), pay({ id: 'p3', method: 'CASH', status: 'CAPTURED' })])).toMatchObject({ kind: 'captured', payment: { id: 'p3' } });
  });
});

describe('error classification', () => {
  it('treats no answer and 5xx as unknown, 4xx as a definite answer', () => {
    expect(isUnknownOutcome(new TypeError('Failed to fetch'))).toBe(true);
    expect(isUnknownOutcome({ status: 503 })).toBe(true);
    expect(isUnknownOutcome({ status: 408 })).toBe(true);
    expect(isUnknownOutcome({ status: 400 })).toBe(false);
    expect(isUnknownOutcome({ status: 409 })).toBe(false);
  });
  it('recognises 409', () => {
    expect(isConflict({ status: 409 })).toBe(true);
    expect(isConflict({ status: 500 })).toBe(false);
    expect(isConflict(null)).toBe(false);
  });
});
