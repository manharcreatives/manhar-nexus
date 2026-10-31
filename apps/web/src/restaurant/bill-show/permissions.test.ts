import { describe, expect, it } from 'vitest';
import { billShowCaps } from './permissions';

const as = (...keys: string[]) => billShowCaps({ realm: 'BUSINESS', roles: keys.map((key) => ({ key })) });

describe('billShowCaps (mirrors system-roles.catalog)', () => {
  it('waiters can show the bill and the QR but cannot record payments or edit settings', () => {
    expect(as('service-team')).toEqual({ canShowBill: true, canShowPaymentQr: true, canRecordPayment: false, canConfigureUpi: false });
  });
  it('cashiers can show both and record the payment', () => {
    expect(as('checkout-associate')).toMatchObject({ canShowBill: true, canShowPaymentQr: true, canRecordPayment: true, canConfigureUpi: false });
  });
  it('owners and managers can do everything, including setting the UPI ID', () => {
    for (const r of ['owner', 'location-manager']) expect(Object.values(as(r)).every(Boolean)).toBe(true);
  });
  it('kitchen, host, accountant and signed-out users get nothing', () => {
    for (const r of ['kitchen-team', 'host', 'accountant', 'stock-control-manager']) expect(Object.values(as(r)).some(Boolean)).toBe(false);
    expect(Object.values(billShowCaps(null)).some(Boolean)).toBe(false);
  });
  it('platform admins have no tenant context', () => {
    expect(Object.values(billShowCaps({ realm: 'PLATFORM', roles: [{ key: 'owner' }] })).some(Boolean)).toBe(false);
  });
});
