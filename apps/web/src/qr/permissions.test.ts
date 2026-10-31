import { describe, expect, it } from 'vitest';
import { qrCaps } from './permissions';

const as = (key: string, realm: 'BUSINESS' | 'PLATFORM' = 'BUSINESS') => qrCaps({ realm, roles: [{ key }] });

describe('qr permissions', () => {
  it('owner and location manager manage everything', () => {
    for (const role of ['owner', 'location-manager']) {
      expect(as(role)).toEqual({ canManageQr: true, canManageGuestOrders: true });
    }
  });
  it('waiters handle guest orders but cannot manage QR codes or settings', () => {
    expect(as('service-team')).toEqual({ canManageQr: false, canManageGuestOrders: true });
  });
  it('cashier, kitchen, host and accountant get neither', () => {
    for (const role of ['checkout-associate', 'kitchen-team', 'host', 'accountant']) {
      expect(as(role)).toEqual({ canManageQr: false, canManageGuestOrders: false });
    }
  });
  it('the platform realm never gets tenant controls', () => {
    expect(as('owner', 'PLATFORM')).toEqual({ canManageQr: false, canManageGuestOrders: false });
    expect(qrCaps(null)).toEqual({ canManageQr: false, canManageGuestOrders: false });
  });
});
