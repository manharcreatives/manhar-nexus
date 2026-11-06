import { CashfreeClient } from './cashfree.client';
import type { CashfreeConfig } from './cashfree.config';
import { PaymentProviderError } from './cashfree.errors';
import { subscriptionsAvailable, subscriptionsFlag } from './subscription.config';
import { parseSubscriptionEvent, subscriptionEventType } from './subscription.events';

const SANDBOX: CashfreeConfig = {
  clientId: 'app-id-123',
  clientSecret: 'secret-key-456',
  environment: 'sandbox',
  baseUrl: 'https://sandbox.cashfree.com/pg',
  apiVersion: '2025-01-01',
  webhookUrl: undefined,
};

function respond(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) } as unknown as Response;
}

describe('subscriptionsFlag', () => {
  it('is off unless exactly "true" or "1"', () => {
    expect(subscriptionsFlag({})).toBe(false);
    expect(subscriptionsFlag({ SUBSCRIPTIONS_ENABLED: 'yes' })).toBe(false);
    expect(subscriptionsFlag({ SUBSCRIPTIONS_ENABLED: 'TRUE' })).toBe(true);
    expect(subscriptionsFlag({ SUBSCRIPTIONS_ENABLED: '1' })).toBe(true);
  });
  it('is available only with the keys too', () => {
    expect(subscriptionsAvailable({ SUBSCRIPTIONS_ENABLED: 'true' })).toBe(false);
    expect(subscriptionsAvailable({ SUBSCRIPTIONS_ENABLED: 'true', CASHFREE_CLIENT_ID: 'a', CASHFREE_CLIENT_SECRET: 'b' })).toBe(true);
  });
});

describe('CashfreeClient subscriptions (request shapes verified on the sandbox)', () => {
  const create = {
    subscriptionId: 'NX-ABC123-ap-1234abcd',
    planName: 'Nexus Counter monthly',
    amountPaise: 70_682,
    customer: { name: 'Asha Patel', email: 'asha@example.com', phone: '9714571522' },
    firstChargeAt: new Date('2026-11-08T00:00:00.000Z'),
    expiresAt: new Date('2036-11-06T00:00:00.000Z'),
    pspNote: 'Manhar Nexus Counter monthly',
  };

  it('createSubscription posts a PERIODIC monthly UPI plan with the amount in rupees and returns the session', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respond(200, { cf_subscription_id: 1472, subscription_id: create.subscriptionId, subscription_status: 'INITIALIZED', subscription_session_id: 'sub_session_x' }));
    const sub = await new CashfreeClient().useForTests({ fetch: fetchImpl as unknown as typeof fetch, config: () => SANDBOX }).createSubscription(create);
    expect(sub).toEqual({ subscriptionId: create.subscriptionId, cfSubscriptionId: '1472', sessionId: 'sub_session_x', status: 'INITIALIZED' });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe('https://sandbox.cashfree.com/pg/subscriptions');
    expect(init.method).toBe('POST');
    expect(init.headers['x-api-version']).toBe('2025-01-01');
    const body = JSON.parse(init.body as string) as { plan_details: Record<string, unknown>; authorization_details: Record<string, unknown>; subscription_first_charge_time: string };
    expect(body.plan_details).toMatchObject({ plan_type: 'PERIODIC', plan_amount: 706.82, plan_max_amount: 706.82, plan_interval_type: 'MONTH', plan_intervals: 1, plan_currency: 'INR' });
    expect(body.authorization_details).toEqual({ authorization_amount: 1, authorization_amount_refund: true, payment_methods: ['upi'] });
    expect(body.subscription_first_charge_time).toBe('2026-11-08T00:00:00.000Z');
  });

  it('cancelSubscription posts action CANCEL to /manage; getSubscription reads it', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respond(200, { subscription_id: 's1', subscription_status: 'cancelled' }));
    const client = new CashfreeClient().useForTests({ fetch: fetchImpl as unknown as typeof fetch, config: () => SANDBOX });
    expect((await client.cancelSubscription('s1')).status).toBe('CANCELLED');
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://sandbox.cashfree.com/pg/subscriptions/s1/manage');
    expect(JSON.parse(init.body as string)).toEqual({ subscription_id: 's1', action: 'CANCEL' });
    await client.getSubscription('s1');
    expect((fetchImpl.mock.calls[1] as [string, RequestInit])[1].method).toBe('GET');
  });

  it('a Cashfree refusal is a provider error with the reason; a reply with no status is one too', async () => {
    const refused = jest.fn().mockResolvedValue(respond(422, { code: 'subscription_not_enabled', message: 'Not enabled' }));
    await expect(new CashfreeClient().useForTests({ fetch: refused as unknown as typeof fetch, config: () => SANDBOX }).createSubscription(create)).rejects.toThrow(/Not enabled/);
    const empty = jest.fn().mockResolvedValue(respond(200, {}));
    await expect(new CashfreeClient().useForTests({ fetch: empty as unknown as typeof fetch, config: () => SANDBOX }).getSubscription('s1')).rejects.toBeInstanceOf(PaymentProviderError);
  });
});

describe('parseSubscriptionEvent (shapes from the Cashfree webhook docs, version 2025-01-01)', () => {
  it('STATUS_CHANGED', () => {
    const raw = JSON.stringify({ data: { subscription_details: { subscription_id: 'S1', subscription_status: 'bank_approval_pending' } }, type: 'SUBSCRIPTION_STATUS_CHANGED' });
    expect(subscriptionEventType(raw)).toBe('SUBSCRIPTION_STATUS_CHANGED');
    expect(parseSubscriptionEvent(raw)).toEqual({ kind: 'status', subscriptionId: 'S1', status: 'BANK_APPROVAL_PENDING' });
  });

  it('AUTH_STATUS: success from payment_status or the authorisation status; failure otherwise', () => {
    const base = { subscription_id: 'S1', cf_payment_id: '49988825', payment_type: 'AUTH', payment_amount: 2.0 };
    const ok = parseSubscriptionEvent(JSON.stringify({ data: { ...base, payment_status: 'SUCCESS' }, type: 'SUBSCRIPTION_AUTH_STATUS', event_time: '2025-08-07T10:34:23+05:30' }));
    expect(ok).toMatchObject({ kind: 'payment', paymentType: 'AUTH', success: true, amountRupees: 2, cfPaymentId: '49988825' });
    const failed = parseSubscriptionEvent(JSON.stringify({ data: { ...base, payment_status: 'FAILED', failure_details: { failure_reason: 'DEBIT HAS BEEN FAILED' } }, type: 'SUBSCRIPTION_AUTH_STATUS' }));
    expect(failed).toMatchObject({ success: false, failureReason: 'DEBIT HAS BEEN FAILED' });
  });

  it('PAYMENT_SUCCESS is a CHARGE unless payment_type says AUTH; PAYMENT_FAILED is never a success', () => {
    const data = { subscription_id: 'S1', cf_payment_id: 'p1', payment_type: 'PERIODIC', payment_amount: 706.82, payment_status: 'SUCCESS' };
    expect(parseSubscriptionEvent(JSON.stringify({ data, type: 'SUBSCRIPTION_PAYMENT_SUCCESS' }))).toMatchObject({ paymentType: 'CHARGE', success: true, amountRupees: 706.82 });
    expect(parseSubscriptionEvent(JSON.stringify({ data: { ...data, payment_type: 'AUTH' }, type: 'SUBSCRIPTION_PAYMENT_SUCCESS' }))).toMatchObject({ paymentType: 'AUTH' });
    expect(parseSubscriptionEvent(JSON.stringify({ data: { ...data, payment_status: 'SUCCESS' }, type: 'SUBSCRIPTION_PAYMENT_FAILED' }))).toMatchObject({ success: false });
  });

  it('ignores types we only acknowledge, non-subscription events, malformed bodies and events without ids', () => {
    expect(parseSubscriptionEvent(JSON.stringify({ data: { subscription_id: 'S1' }, type: 'SUBSCRIPTION_PAYMENT_NOTIFICATION_INITIATED' }))).toBeNull();
    expect(subscriptionEventType(JSON.stringify({ type: 'PAYMENT_LINK_EVENT', data: {} }))).toBeNull();
    expect(subscriptionEventType('not json')).toBeNull();
    expect(parseSubscriptionEvent('not json')).toBeNull();
    expect(parseSubscriptionEvent(JSON.stringify({ data: { payment_status: 'SUCCESS' }, type: 'SUBSCRIPTION_PAYMENT_SUCCESS' }))).toBeNull();
  });
});
