import { CashfreeClient } from './cashfree.client';
import { readCashfreeConfig, type CashfreeConfig } from './cashfree.config';
import { PaymentProviderError, PaymentsNotConfiguredError } from './cashfree.errors';

const SANDBOX: CashfreeConfig = {
  clientId: 'app-id-123',
  clientSecret: 'secret-key-456',
  environment: 'sandbox',
  baseUrl: 'https://sandbox.cashfree.com/pg',
  apiVersion: '2025-01-01',
  webhookUrl: 'https://example.test/api/public/cashfree/webhook',
};

const input = {
  linkId: 'NX-ABC123-ab12cd34',
  amountPaise: 150_050,
  purpose: 'Manhar Nexus subscription',
  customer: { name: 'Asha Patel', email: 'asha@example.com', phone: '9714571522' },
  expiresAt: new Date('2026-11-12T10:00:00.000Z'),
};

function respond(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) } as unknown as Response;
}

function clientWith(fetchImpl: jest.Mock, config: CashfreeConfig | null = SANDBOX): CashfreeClient {
  return new CashfreeClient().useForTests({ fetch: fetchImpl as unknown as typeof fetch, config: () => config });
}

describe('readCashfreeConfig', () => {
  it('is null until both keys are set', () => {
    expect(readCashfreeConfig({})).toBeNull();
    expect(readCashfreeConfig({ CASHFREE_CLIENT_ID: 'a' })).toBeNull();
    expect(readCashfreeConfig({ CASHFREE_CLIENT_SECRET: 'b' })).toBeNull();
    expect(readCashfreeConfig({ CASHFREE_CLIENT_ID: ' ', CASHFREE_CLIENT_SECRET: 'b' })).toBeNull();
  });

  it('defaults to the SANDBOX host and picks production only when asked', () => {
    const base = { CASHFREE_CLIENT_ID: 'a', CASHFREE_CLIENT_SECRET: 'b' };
    expect(readCashfreeConfig(base)?.baseUrl).toBe('https://sandbox.cashfree.com/pg');
    expect(readCashfreeConfig({ ...base, CASHFREE_ENV: 'Production' })?.baseUrl).toBe('https://api.cashfree.com/pg');
    expect(readCashfreeConfig({ ...base, CASHFREE_ENV: 'anything-else' })?.environment).toBe('sandbox');
  });

  it('derives the webhook URL from the public base unless one is given', () => {
    const base = { CASHFREE_CLIENT_ID: 'a', CASHFREE_CLIENT_SECRET: 'b' };
    expect(readCashfreeConfig({ ...base, QR_PUBLIC_BASE_URL: 'https://x.test/' })?.webhookUrl).toBe('https://x.test/api/public/cashfree/webhook');
    expect(readCashfreeConfig({ ...base, QR_PUBLIC_BASE_URL: 'https://x.test', CASHFREE_WEBHOOK_URL: 'https://y.test/hook' })?.webhookUrl).toBe('https://y.test/hook');
    expect(readCashfreeConfig(base)?.webhookUrl).toBeUndefined();
  });
});

describe('CashfreeClient', () => {
  it('says plainly that payments are not set up when the keys are missing, and calls nothing', async () => {
    const fetchImpl = jest.fn();
    await expect(clientWith(fetchImpl, null).createLink(input)).rejects.toBeInstanceOf(PaymentsNotConfiguredError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('creates a link: right host, headers and body (amount in rupees, 10-digit phone, notify url)', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      respond(200, { cf_link_id: 987, link_id: input.linkId, link_status: 'ACTIVE', link_url: 'https://payments-test.cashfree.com/links/abc' }),
    );
    const link = await clientWith(fetchImpl).createLink(input);
    expect(link).toEqual({ cfLinkId: '987', linkId: input.linkId, linkUrl: 'https://payments-test.cashfree.com/links/abc', status: 'ACTIVE' });

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://sandbox.cashfree.com/pg/links');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'x-client-id': 'app-id-123', 'x-client-secret': 'secret-key-456', 'x-api-version': '2025-01-01' });
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      link_id: input.linkId,
      link_amount: 1500.5,
      link_currency: 'INR',
      link_purpose: 'Manhar Nexus subscription',
      link_partial_payments: false,
      link_expiry_time: '2026-11-12T10:00:00.000Z',
      customer_details: { customer_name: 'Asha Patel', customer_email: 'asha@example.com', customer_phone: '9714571522' },
      link_meta: { notify_url: 'https://example.test/api/public/cashfree/webhook' },
    });
  });

  it('leaves link_meta out when no webhook URL is known', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respond(200, { link_url: 'https://pay.test/x' }));
    await clientWith(fetchImpl, { ...SANDBOX, webhookUrl: undefined }).createLink(input);
    expect(JSON.parse((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body as string)).not.toHaveProperty('link_meta');
  });

  it('uses the production host when configured for production', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respond(200, { link_url: 'https://pay.test/x' }));
    await clientWith(fetchImpl, { ...SANDBOX, environment: 'production', baseUrl: 'https://api.cashfree.com/pg' }).createLink(input);
    expect((fetchImpl.mock.calls[0] as [string])[0]).toBe('https://api.cashfree.com/pg/links');
  });

  it('turns a Cashfree refusal into a readable error that never contains the secret', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respond(401, { code: 'authentication_failed', message: 'Invalid client credentials' }));
    const err = (await clientWith(fetchImpl).createLink(input).then(() => null, (e: unknown) => e)) as PaymentProviderError;
    expect(err).toBeInstanceOf(PaymentProviderError);
    expect(err.httpStatus).toBe(502);
    expect(err.message).toContain('401');
    expect(err.message).toContain('Invalid client credentials');
    expect(err.message).not.toContain('secret-key-456');
    expect(err.message).not.toContain('app-id-123');
  });

  it('handles a non-JSON error page, a network failure and a response with no link URL', async () => {
    await expect(clientWith(jest.fn().mockResolvedValue(respond(502, '<html>bad gateway</html>'))).createLink(input)).rejects.toBeInstanceOf(PaymentProviderError);
    await expect(clientWith(jest.fn().mockRejectedValue(new TypeError('fetch failed'))).createLink(input)).rejects.toThrow(/Could not reach Cashfree/);
    await expect(clientWith(jest.fn().mockResolvedValue(respond(200, { link_status: 'ACTIVE' }))).createLink(input)).rejects.toThrow(/did not return a payment link/);
  });

  it('finds the paid order of a link (shape confirmed against the sandbox) and ignores unpaid ones', async () => {
    const orders = [
      { order_id: 'CFPay_unpaid', order_status: 'ACTIVE' },
      { order_id: 'CFPay_paid_1', order_status: 'PAID', link_id: 'L9' },
    ];
    const fetchImpl = jest.fn().mockResolvedValue(respond(200, orders));
    expect(await clientWith(fetchImpl).getPaidOrderId('L9')).toBe('CFPay_paid_1');
    expect((fetchImpl.mock.calls[0] as [string])[0]).toBe('https://sandbox.cashfree.com/pg/links/L9/orders');
    expect(await clientWith(jest.fn().mockResolvedValue(respond(200, [{ order_id: 'x', order_status: 'ACTIVE' }]))).getPaidOrderId('L9')).toBeNull();
    expect(await clientWith(jest.fn().mockResolvedValue(respond(200, []))).getPaidOrderId('L9')).toBeNull();
    expect(await clientWith(jest.fn().mockResolvedValue(respond(200, { not: 'an array' }))).getPaidOrderId('L9')).toBeNull();
  });

  it('fetches a link and reports the amount paid', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(respond(200, { link_id: 'L9', link_status: 'PAID', link_url: 'https://pay.test/l9', link_amount_paid: 1500 }));
    const link = await clientWith(fetchImpl).getLink('L9');
    expect(link).toMatchObject({ linkId: 'L9', status: 'PAID', amountPaidRupees: 1500 });
    expect((fetchImpl.mock.calls[0] as [string, RequestInit])[0]).toBe('https://sandbox.cashfree.com/pg/links/L9');
    expect((fetchImpl.mock.calls[0] as [string, RequestInit])[1].method).toBe('GET');
  });
});
