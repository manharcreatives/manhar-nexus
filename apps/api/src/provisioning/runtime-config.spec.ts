import { isAutoEligiblePayment } from './auto-provision.service';
import { modulesForPlan } from './provisioning.dto';
import { MIN_CRON_SECRET_LENGTH, cronSecret, publicBaseUrl } from './runtime-config';

describe('publicBaseUrl', () => {
  it('trims and drops trailing slashes', () => {
    expect(publicBaseUrl({ QR_PUBLIC_BASE_URL: ' https://app.example.com/// ' } as NodeJS.ProcessEnv)).toBe('https://app.example.com');
  });
  it('is null when unset or blank', () => {
    expect(publicBaseUrl({} as NodeJS.ProcessEnv)).toBeNull();
    expect(publicBaseUrl({ QR_PUBLIC_BASE_URL: '  /  ' } as NodeJS.ProcessEnv)).toBeNull();
  });
});

describe('cronSecret', () => {
  it('reports unset, too short and fine', () => {
    expect(cronSecret({} as NodeJS.ProcessEnv)).toEqual({ ok: false, reason: 'unset' });
    expect(cronSecret({ CRON_SECRET: 'x'.repeat(MIN_CRON_SECRET_LENGTH - 1) } as NodeJS.ProcessEnv)).toEqual({ ok: false, reason: 'too-short' });
    const good = 'x'.repeat(MIN_CRON_SECRET_LENGTH);
    expect(cronSecret({ CRON_SECRET: good } as NodeJS.ProcessEnv)).toEqual({ ok: true, secret: good });
  });
});

describe('modulesForPlan', () => {
  it('Counter has reports; Floor and Pass add Operating Costs; anything else falls back to the Counter set', () => {
    expect(modulesForPlan('counter')).toEqual(['reports']);
    expect(modulesForPlan('floor')).toEqual(['reports', 'costs']);
    expect(modulesForPlan('pass')).toEqual(['reports', 'costs']);
    expect(modulesForPlan(null)).toEqual(['reports']);
  });
});

describe('isAutoEligiblePayment', () => {
  const paid = { status: 'PAID', amountPaise: 1000, paidAmountPaise: 1000, planKey: 'floor' };
  it('needs the full quoted amount for a priced plan', () => {
    expect(isAutoEligiblePayment(paid)).toBe(true);
    expect(isAutoEligiblePayment({ ...paid, paidAmountPaise: 900 })).toBe(false);
    expect(isAutoEligiblePayment({ ...paid, planKey: null })).toBe(false);
    expect(isAutoEligiblePayment({ ...paid, planKey: 'many-doors' })).toBe(false);
    expect(isAutoEligiblePayment({ ...paid, status: 'AMOUNT_MISMATCH' })).toBe(false);
  });
  it('a mismatch that staff accepted counts, but only once the paid amount is known', () => {
    const accepted = { accepted: { reason: 'Checked in Cashfree' } };
    expect(isAutoEligiblePayment({ ...paid, paidAmountPaise: 900, quote: accepted })).toBe(true);
    expect(isAutoEligiblePayment({ ...paid, paidAmountPaise: null, quote: accepted })).toBe(false);
    expect(isAutoEligiblePayment({ ...paid, paidAmountPaise: 900, quote: { accepted: { reason: '' } } })).toBe(false);
  });
});
