import { describe, expect, it } from 'vitest';
import { formatRupees, isOpenLink, isPaid, paymentMessage, type PaymentLink } from './api';
import { parseRupees } from './PaymentLinkDialog';

const link = (over: Partial<PaymentLink> = {}): PaymentLink => ({
  id: 'p',
  registrationId: 'r',
  linkId: 'L',
  linkUrl: 'https://pay.test/l',
  amountPaise: 150_000,
  currency: 'INR',
  purpose: 'x',
  status: 'CREATED',
  paidAmountPaise: null,
  expiresAt: '2099-01-01T00:00:00.000Z',
  paidAt: null,
  createdAt: '2026-11-05T10:00:00.000Z',
  ...over,
});

describe('parseRupees', () => {
  it.each([
    ['1500', 1500],
    ['₹1,500', 1500],
    ['1 500', 1500],
    ['1499.5', 1499.5],
    ['1499.50', 1499.5],
    ['0.01', 0.01],
    ['1000000', 1_000_000],
  ])('reads %s as %d', (text, rupees) => {
    expect(parseRupees(text)).toBe(rupees);
  });

  it.each(['', ' ', '0', '0.00', '-5', 'abc', '10.001', '1.2.3', '1000001'])('rejects %j', (text) => {
    expect(parseRupees(text)).toBeNull();
  });
});

describe('formatRupees', () => {
  it('shows whole rupees without decimals and others with two, in Indian grouping', () => {
    expect(formatRupees(150_000)).toBe('1,500');
    expect(formatRupees(150_050)).toBe('1,500.50');
    expect(formatRupees(1999)).toBe('19.99');
    expect(formatRupees(10_000_000)).toBe('1,00,000');
  });
});

describe('isPaid / isOpenLink', () => {
  it('isPaid is true only with a PAID link', () => {
    expect(isPaid({ payments: [] })).toBe(false);
    expect(isPaid({ payments: [link(), link({ status: 'EXPIRED' })] })).toBe(false);
    expect(isPaid({ payments: [link({ status: 'AMOUNT_MISMATCH' })] })).toBe(false);
    expect(isPaid({ payments: [link(), link({ status: 'PAID' })] })).toBe(true);
  });

  it('a link is open while CREATED and not past its expiry', () => {
    const now = Date.parse('2026-11-10T00:00:00.000Z');
    expect(isOpenLink(link(), now)).toBe(true);
    expect(isOpenLink(link({ expiresAt: null }), now)).toBe(true);
    expect(isOpenLink(link({ expiresAt: '2026-11-09T00:00:00.000Z' }), now)).toBe(false);
    expect(isOpenLink(link({ status: 'PAID' }), now)).toBe(false);
  });
});

describe('paymentMessage', () => {
  it('names the owner, the restaurant, the amount and the link', () => {
    const text = paymentMessage({ contactName: 'Asha Patel', restaurantName: 'Ananda Cafe' }, link());
    expect(text).toContain('Asha Patel');
    expect(text).toContain('Ananda Cafe');
    expect(text).toContain('₹1,500');
    expect(text).toContain('https://pay.test/l');
  });
});
