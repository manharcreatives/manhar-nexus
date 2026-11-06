import { createHash } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AutoProvisionService } from '../src/provisioning/auto-provision.service';
import { applyHttpDefaults } from '../src/app.factory';
import { CashfreeClient } from '../src/cashfree/cashfree.client';
import type { CashfreeConfig } from '../src/cashfree/cashfree.config';
import { PrismaService } from '../src/prisma/prisma.service';
import { CONSENT_VERSIONS } from '../src/registration/registration.dto';
import { generateReferenceCode } from '../src/registration/registration.util';

/**
 * The owner pays for their own request (CUSTOMER_PAY_ENABLED). Cashfree is stubbed; the rest is the real stack:
 * guards, throttling, validation, Prisma and the database.
 */
describe('Customer "Pay now" (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let autoProvision: jest.SpyInstance<Promise<unknown>, [string, Date?]>;
  const RUN = Date.now().toString(36);
  const http = () => app.getHttpServer();
  let seq = 0;
  const cashfreeFetch = jest.fn();
  const CONFIG: CashfreeConfig = {
    clientId: 'e2e-app-id',
    clientSecret: 'e2e-cashfree-secret-not-real',
    environment: 'sandbox',
    baseUrl: 'https://sandbox.cashfree.com/pg',
    apiVersion: '2025-01-01',
    webhookUrl: undefined,
  };
  const saved = { ...process.env };

  async function createLead(plan: { planKey?: string; billingCycle?: string; createdAt?: Date; status?: 'NEW' | 'SPAM' } = {}) {
    return prisma.registrationRequest.create({
      data: {
        referenceCode: generateReferenceCode(),
        restaurantName: 'Ananda Cafe',
        contactName: 'Asha Patel',
        email: `owner${++seq}-${RUN}@example.test`,
        phone: '+919714571522',
        city: 'Visnagar',
        businessKind: 'cafe',
        outlets: 1,
        planKey: plan.planKey ?? 'floor',
        billingCycle: plan.billingCycle ?? 'yearly',
        consentVersion: CONSENT_VERSIONS[0],
        consentAt: new Date(),
        ...(plan.status ? { status: plan.status } : {}),
        ...(plan.createdAt ? { createdAt: plan.createdAt } : {}),
      },
    });
  }

  function stubLink(url = 'https://payments-test.cashfree.com/links/cust'): void {
    cashfreeFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ cf_link_id: 99, link_status: 'ACTIVE', link_url: url }),
    });
  }

  const payLink = (body: object) => request(http()).post('/public/payments/pay-link').send(body);
  const status = (body: object) => request(http()).post('/public/payments/status').send(body);
  const who = (lead: { referenceCode: string; email: string }) => ({ referenceCode: lead.referenceCode, email: lead.email });

  beforeAll(async () => {
    process.env.CASHFREE_CLIENT_ID = 'e2e-app-id';
    process.env.CASHFREE_CLIENT_SECRET = 'e2e-cashfree-secret-not-real';
    process.env.CUSTOMER_PAY_RATE_LIMIT = '1000';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    applyHttpDefaults(app);
    await app.init();
    prisma = app.get(PrismaService);
    // No real restaurant is created here (that has its own tests); we only record that it was asked for.
    autoProvision = jest.spyOn(app.get(AutoProvisionService), 'autoProvision').mockResolvedValue('skipped');
    app.get(CashfreeClient).useForTests({ fetch: cashfreeFetch as unknown as typeof fetch, config: () => CONFIG });
  });

  beforeEach(() => {
    cashfreeFetch.mockReset();
    process.env.CUSTOMER_PAY_ENABLED = 'true';
  });

  afterAll(async () => {
    await prisma.registrationPayment.deleteMany({ where: { registration: { email: { endsWith: `-${RUN}@example.test` } } } });
    await prisma.registrationRequest.deleteMany({ where: { email: { endsWith: `-${RUN}@example.test` } } });
    await app.close();
    process.env = { ...saved };
  });

  it('config says off by default (flag unset) and on when enabled with keys', async () => {
    delete process.env.CUSTOMER_PAY_ENABLED;
    expect((await request(http()).get('/public/payments/config')).body).toEqual({ customerPay: false });
    process.env.CUSTOMER_PAY_ENABLED = 'true';
    expect((await request(http()).get('/public/payments/config')).body).toEqual({ customerPay: true });
  });

  it('with the flag off, pay-link and status are 404 and Cashfree is never called', async () => {
    const lead = await createLead();
    process.env.CUSTOMER_PAY_ENABLED = 'false';
    expect((await payLink(who(lead))).status).toBe(404);
    expect((await status(who(lead))).status).toBe(404);
    expect(cashfreeFetch).not.toHaveBeenCalled();
    expect(await prisma.registrationPayment.count({ where: { registrationId: lead.id } })).toBe(0);
  });

  it('creates the link priced by the server: Floor yearly in the Founding window = 9,740 + 18% GST, source CUSTOMER', async () => {
    const lead = await createLead({ planKey: 'floor', billingCycle: 'yearly', createdAt: new Date('2026-12-01T10:00:00+05:30') });
    stubLink();
    const res = await payLink(who(lead));
    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe('link');
    expect(res.body.link).toMatchObject({ linkUrl: 'https://payments-test.cashfree.com/links/cust', amountPaise: 1_149_320 });
    expect(Object.keys(res.body.link as object).sort()).toEqual(['amountPaise', 'breakdown', 'expiresAt', 'linkUrl', 'payerSecret', 'purpose']);
    const row = await prisma.registrationPayment.findFirstOrThrow({ where: { registrationId: lead.id } });
    expect(row).toMatchObject({ source: 'CUSTOMER', planKey: 'floor', amountPaise: 1_149_320, status: 'CREATED' });
    // Only the hash of the payer secret is stored; asking again never returns the secret.
    const secret = res.body.link.payerSecret as string;
    expect(secret.length).toBeGreaterThanOrEqual(43);
    expect(row.payerSecretHash).toBe(createHash('sha256').update(secret).digest('hex'));
    expect(JSON.stringify(row)).not.toContain(secret);
    const again = await payLink(who(lead));
    expect(again.body.link.payerSecret).toBeUndefined();
    expect((await status(who(lead))).body).toEqual({ paid: false });
    const sent = JSON.parse((cashfreeFetch.mock.calls[0] as [string, RequestInit])[1].body as string) as { link_amount: number };
    expect(sent.link_amount).toBe(11_493.2);
  });

  it('a browser cannot choose the price: extra fields are refused (400) and nothing is created', async () => {
    const lead = await createLead();
    for (const extra of [{ amountRupees: 1 }, { amountPaise: 100 }, { planKey: 'counter' }, { registrationId: lead.id }]) {
      expect((await payLink({ ...who(lead), ...extra })).status).toBe(400);
    }
    expect(cashfreeFetch).not.toHaveBeenCalled();
    expect(await prisma.registrationPayment.count({ where: { registrationId: lead.id } })).toBe(0);
  });

  it('asking again returns the same open link: one live link per request', async () => {
    const lead = await createLead();
    stubLink();
    const first = await payLink(who(lead));
    const second = await payLink(who(lead));
    expect(second.body.link.linkUrl).toBe(first.body.link.linkUrl);
    expect(cashfreeFetch).toHaveBeenCalledTimes(1);
    expect(await prisma.registrationPayment.count({ where: { registrationId: lead.id } })).toBe(1);
  });

  it('two taps at once make exactly ONE link (a per-request lock), both get the same URL, no error', async () => {
    const lead = await createLead();
    stubLink();
    stubLink('https://payments-test.cashfree.com/links/cust-2');
    const [a, b] = await Promise.all([payLink(who(lead)), payLink(who(lead))]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(a.body.link.linkUrl).toBe(b.body.link.linkUrl);
    expect(cashfreeFetch).toHaveBeenCalledTimes(1);
    expect(await prisma.registrationPayment.count({ where: { registrationId: lead.id } })).toBe(1);
  });

  it('a wrong email and an unknown code are indistinguishable 404s, and nothing is created', async () => {
    const lead = await createLead();
    const wrong = await payLink({ referenceCode: lead.referenceCode, email: 'someone.else@example.test' });
    const unknown = await payLink({ referenceCode: 'NX-ZZZZZZ', email: lead.email });
    expect(wrong.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(wrong.body.error.code).toBe(unknown.body.error.code);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
    expect(cashfreeFetch).not.toHaveBeenCalled();
  });

  it('email matching ignores case and spaces (the same way registration stored it)', async () => {
    const lead = await createLead();
    stubLink();
    const res = await payLink({ referenceCode: ` ${lead.referenceCode.toLowerCase()} `, email: `  ${lead.email.toUpperCase()} ` });
    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe('link');
  });

  it.each([['many-doors'], ['not-sure']])('plan %s: "contact us", no link made', async (planKey) => {
    const lead = await createLead({ planKey });
    const res = await payLink(who(lead));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ outcome: 'contact-us' });
    expect(cashfreeFetch).not.toHaveBeenCalled();
  });

  it('a SPAM request is not payable by the visitor', async () => {
    const lead = await createLead({ status: 'SPAM' });
    expect((await payLink(who(lead))).body).toEqual({ outcome: 'contact-us' });
    expect(cashfreeFetch).not.toHaveBeenCalled();
  });

  it('answers paid (and makes no new link) once a payment is PAID; status agrees', async () => {
    const lead = await createLead();
    stubLink();
    await payLink(who(lead));
    await prisma.registrationPayment.updateMany({ where: { registrationId: lead.id }, data: { status: 'PAID', paidAt: new Date(), paidAmountPaise: 1 } });
    expect((await payLink(who(lead))).body).toEqual({ outcome: 'paid' });
    expect((await status(who(lead))).body).toEqual({ paid: true });
    expect(cashfreeFetch).toHaveBeenCalledTimes(1);
  });

  it('status: false before payment, and it asks Cashfree about the open link (so a late webhook does not matter)', async () => {
    const lead = await createLead();
    expect((await status(who(lead))).body).toEqual({ paid: false });
    stubLink();
    await payLink(who(lead));
    const row = await prisma.registrationPayment.findFirstOrThrow({ where: { registrationId: lead.id } });
    // Cashfree: link PAID for the exact amount, then its order list.
    cashfreeFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ link_id: row.linkId, link_url: row.linkUrl, link_status: 'PAID', link_amount_paid: row.amountPaise / 100 }),
    });
    cashfreeFetch.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify([{ order_id: 'CFPay_cust', order_status: 'PAID' }]) });
    const res = await status(who(lead));
    expect(res.body).toEqual({ paid: true });
    expect((await prisma.registrationPayment.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('PAID');
    // Discovering the payment through the status check creates the account once, after the answer.
    for (let i = 0; i < 4; i += 1) await new Promise((r) => setImmediate(r));
    expect(autoProvision.mock.calls.filter((c) => c[0] === lead.id)).toHaveLength(1);
    // Asking again does not start it again (the payment is already PAID).
    await status(who(lead));
    for (let i = 0; i < 4; i += 1) await new Promise((r) => setImmediate(r));
    expect(autoProvision.mock.calls.filter((c) => c[0] === lead.id)).toHaveLength(1);
  });

  it('status never leaks anything but one boolean, and a wrong email is a 404', async () => {
    const lead = await createLead();
    expect(Object.keys((await status(who(lead))).body as object)).toEqual(['paid']);
    expect((await status({ referenceCode: lead.referenceCode, email: 'x@example.test' })).status).toBe(404);
  });

  it('a Cashfree failure is an error for the page to handle, and leaves nothing behind', async () => {
    const lead = await createLead();
    cashfreeFetch.mockResolvedValueOnce({ ok: false, status: 401, text: async () => JSON.stringify({ code: 'authentication_failed', message: 'Invalid client credentials' }) });
    const res = await payLink(who(lead));
    expect(res.status).toBe(502);
    expect(await prisma.registrationPayment.count({ where: { registrationId: lead.id } })).toBe(0);
  });

  it('is rate limited per IP (429) so reference codes cannot be tried in bulk', async () => {
    process.env.CUSTOMER_PAY_RATE_LIMIT = '3';
    process.env.CUSTOMER_PAY_RATE_TTL_MS = '60000';
    const codes: number[] = [];
    for (let i = 0; i < 40; i++) {
      const res = await payLink({ referenceCode: 'NX-ZZZZZZ', email: 'nobody@example.test' });
      codes.push(res.status);
      if (res.status === 429) break;
    }
    expect(codes).toContain(429);
    process.env.CUSTOMER_PAY_RATE_LIMIT = '1000';
  });
});
