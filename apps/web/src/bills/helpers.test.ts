import { describe, expect, it } from 'vitest';
import {
  canVoid,
  classifyBillError,
  dayEndIso,
  dayStartIso,
  minorToInput,
  refundableMinor,
  refundedTotal,
  validateRefundAmount,
} from './helpers';

describe('refund math', () => {
  it('ignores FAILED refunds when totalling', () => {
    expect(
      refundedTotal([
        { amountMinorUnits: 500, status: 'PROCESSED' },
        { amountMinorUnits: 300, status: 'PENDING' },
        { amountMinorUnits: 900, status: 'FAILED' },
      ]),
    ).toBe(800);
    expect(refundedTotal(undefined)).toBe(0);
  });

  it('computes the refundable remainder, only for CAPTURED payments', () => {
    const base = { amountMinorUnits: 2100, refunds: [{ amountMinorUnits: 500, status: 'PROCESSED' }] };
    expect(refundableMinor({ ...base, status: 'CAPTURED' })).toBe(1600);
    expect(refundableMinor({ ...base, status: 'PENDING' })).toBe(0);
    expect(refundableMinor({ status: 'CAPTURED', amountMinorUnits: 100, refunds: [{ amountMinorUnits: 150, status: 'PROCESSED' }] })).toBe(0);
  });

  it('validates typed amounts against the remainder', () => {
    expect(validateRefundAmount('', 1000)).toEqual({ ok: false, reason: 'empty' });
    expect(validateRefundAmount('abc', 1000)).toEqual({ ok: false, reason: 'invalid' });
    expect(validateRefundAmount('1.234', 1000)).toEqual({ ok: false, reason: 'invalid' });
    expect(validateRefundAmount('0', 1000)).toEqual({ ok: false, reason: 'zero' });
    expect(validateRefundAmount('10.01', 1000)).toEqual({ ok: false, reason: 'exceeds' });
    expect(validateRefundAmount('10', 1000)).toEqual({ ok: true, minor: 1000 });
    expect(validateRefundAmount('1,000.50', 200000)).toEqual({ ok: true, minor: 100050 });
  });

  it('formats minor units for an input', () => {
    expect(minorToInput(1050)).toBe('10.50');
    expect(minorToInput(5)).toBe('0.05');
  });
});

describe('bill helpers', () => {
  it('allows void only before payment', () => {
    expect(canVoid('FINALISED')).toBe(true);
    expect(canVoid('DRAFT')).toBe(true);
    expect(canVoid('PAID')).toBe(false);
    expect(canVoid('VOIDED')).toBe(false);
  });

  it('turns a local day into inclusive instants', () => {
    const s = new Date(dayStartIso('2026-03-05')!);
    const e = new Date(dayEndIso('2026-03-05')!);
    expect([s.getFullYear(), s.getMonth(), s.getDate(), s.getHours()]).toEqual([2026, 2, 5, 0]);
    expect([e.getDate(), e.getHours(), e.getMinutes(), e.getMilliseconds()]).toEqual([5, 23, 59, 999]);
    expect(dayStartIso('')).toBeUndefined();
  });

  it('classifies API errors', () => {
    expect(classifyBillError(new Error('x'))).toBe('network');
    expect(classifyBillError({ status: 403 })).toBe('noAccess');
    expect(classifyBillError({ status: 400, message: 'Refund amount exceeds remaining refundable balance' })).toBe('exceeds');
    expect(classifyBillError({ status: 400, message: 'Only CAPTURED payments can be refunded' })).toBe('notCaptured');
    expect(classifyBillError({ status: 409, message: 'Cannot void a PAID invoice - use a refund instead' })).toBe('paidCannotVoid');
    expect(classifyBillError({ status: 409, code: 'VERSION_CONFLICT' })).toBe('versionConflict');
    expect(classifyBillError({ status: 500 })).toBe('generic');
  });
});
