import { parseLinkEvent, webhookEventType } from './cashfree.events';

const JSON_TYPE = 'application/json';
const FORM_TYPE = 'application/x-www-form-urlencoded';

const paid = {
  type: 'PAYMENT_LINK_EVENT',
  version: 1,
  event_time: '2026-11-05T10:00:00+05:30',
  data: {
    cf_link_id: 123456,
    link_id: 'NX-ABC123-ab12cd34',
    link_status: 'PAID',
    link_amount: 1500,
    link_amount_paid: 1500,
    order: { order_id: 'CFPay_abc_xyz', order_amount: 1500, transaction_status: 'SUCCESS' },
  },
};

describe('parseLinkEvent: JSON body (as in the docs)', () => {
  it('reads a paid link: id, status, amount and order id', () => {
    expect(parseLinkEvent(JSON.stringify(paid), JSON_TYPE)).toEqual({
      linkId: 'NX-ABC123-ab12cd34',
      linkStatus: 'PAID',
      amountPaidRupees: 1500,
      orderId: 'CFPay_abc_xyz',
    });
  });

  it('copes with order = null (cancelled and expired links) and a missing amount', () => {
    const body = { type: 'PAYMENT_LINK_EVENT', data: { link_id: 'L1', link_status: 'expired', order: null } };
    expect(parseLinkEvent(JSON.stringify(body), JSON_TYPE)).toEqual({
      linkId: 'L1',
      linkStatus: 'EXPIRED',
      amountPaidRupees: null,
      orderId: null,
    });
  });

  it('reads an amount sent as a string', () => {
    const body = { type: 'PAYMENT_LINK_EVENT', data: { link_id: 'L1', link_status: 'PAID', link_amount_paid: '1500.00' } };
    expect(parseLinkEvent(JSON.stringify(body), JSON_TYPE)?.amountPaidRupees).toBe(1500);
  });

  it('ignores other event types (a payment webhook is not a link event)', () => {
    expect(parseLinkEvent(JSON.stringify({ type: 'PAYMENT_SUCCESS_WEBHOOK', data: { payment: { cf_payment_id: 1 } } }), JSON_TYPE)).toBeNull();
  });

  it('returns null for anything that is not a usable link event', () => {
    expect(parseLinkEvent('not json', JSON_TYPE)).toBeNull();
    expect(parseLinkEvent('[]', JSON_TYPE)).toBeNull();
    expect(parseLinkEvent('{}', JSON_TYPE)).toBeNull();
    expect(parseLinkEvent(JSON.stringify({ type: 'PAYMENT_LINK_EVENT', data: { link_id: 'L1' } }), JSON_TYPE)).toBeNull();
    expect(parseLinkEvent(JSON.stringify({ type: 'PAYMENT_LINK_EVENT', data: { link_status: 'PAID' } }), JSON_TYPE)).toBeNull();
  });
});

describe('webhookEventType', () => {
  it('reads the top-level type from JSON and from a form body, and never throws', () => {
    expect(webhookEventType(JSON.stringify(paid), JSON_TYPE)).toBe('PAYMENT_LINK_EVENT');
    expect(webhookEventType(JSON.stringify({ type: 'PAYMENT_SUCCESS_WEBHOOK', data: {} }), JSON_TYPE)).toBe('PAYMENT_SUCCESS_WEBHOOK');
    expect(webhookEventType(new URLSearchParams({ type: 'X_EVENT' }).toString(), FORM_TYPE)).toBe('X_EVENT');
    expect(webhookEventType('not json', JSON_TYPE)).toBeNull();
    expect(webhookEventType('{}', JSON_TYPE)).toBeNull();
    expect(webhookEventType(JSON.stringify({ type: 'A'.repeat(500) }), JSON_TYPE)?.length).toBe(64);
  });
});

describe('parseLinkEvent: form-encoded body (the docs also say "form data")', () => {
  it('reads flat fields', () => {
    const body = new URLSearchParams({ link_id: 'L2', link_status: 'PAID', link_amount_paid: '99.50', order_id: 'CFPay_1' }).toString();
    expect(parseLinkEvent(body, FORM_TYPE)).toEqual({ linkId: 'L2', linkStatus: 'PAID', amountPaidRupees: 99.5, orderId: 'CFPay_1' });
  });

  it('reads a nested object sent as a JSON string inside a field', () => {
    const body = new URLSearchParams({ type: 'PAYMENT_LINK_EVENT', data: JSON.stringify(paid.data) }).toString();
    expect(parseLinkEvent(body, FORM_TYPE)).toMatchObject({ linkId: 'NX-ABC123-ab12cd34', linkStatus: 'PAID', orderId: 'CFPay_abc_xyz' });
  });

  it('is chosen by the content type, case-insensitively', () => {
    const body = new URLSearchParams({ link_id: 'L3', link_status: 'CANCELLED' }).toString();
    expect(parseLinkEvent(body, 'Application/X-WWW-Form-Urlencoded; charset=utf-8')?.linkStatus).toBe('CANCELLED');
  });
});
