import { createHmac } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';
import { CashfreeClient } from '../src/cashfree/cashfree.client';
import type { CashfreeConfig } from '../src/cashfree/cashfree.config';
import { PrismaService } from '../src/prisma/prisma.service';
import { CONSENT_VERSIONS } from '../src/registration/registration.dto';
import { generateReferenceCode } from '../src/registration/registration.util';

/**
 * Cashfree payment links for the owner's subscription (platform side): staff create a link for a registration request,
 * the owner pays on Cashfree, a SIGNED webhook marks it paid. Cashfree itself is stubbed (no network); everything else is
 * the real stack: raw-body capture, signature check, guards, Prisma and the database.
 */
describe('Cashfree payment links (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let client: CashfreeClient;
  let platformToken: string;
  let businessToken: string;

  const RUN = Date.now().toString(36);
  const EMAIL_TAG = `-cf-${RUN}@example.test`;
  const SECRET = 'e2e-cashfree-secret-not-real';
  const http = () => app.getHttpServer();
  let seq = 0;

  const CONFIG: CashfreeConfig = {
    clientId: 'e2e-app-id',
    clientSecret: SECRET,
    environment: 'sandbox',
    baseUrl: 'https://sandbox.cashfree.com/pg',
    apiVersion: '2025-01-01',
    webhookUrl: 'https://example.test/api/public/cashfree/webhook',
  };
  let activeConfig: CashfreeConfig | null = CONFIG;
  const cashfreeFetch = jest.fn();

  const pGet = (path: string) => request(http()).get(path).set('authorization', `Bearer ${platformToken}`);
  const pPost = (path: string, b: object) => request(http()).post(path).set('authorization', `Bearer ${platformToken}`).send(b);

  /** A stored registration request (inserted directly: the public endpoint has its own per-IP throttle). */
  async function createLead() {
    return prisma.registrationRequest.create({
      data: {
        referenceCode: generateReferenceCode(),
        restaurantName: 'Ananda Cafe',
        contactName: 'Asha Patel',
        email: `lead${++seq}${EMAIL_TAG}`,
        phone: '+919714571522',
        city: 'Visnagar',
        businessKind: 'cafe',
        outlets: 2,
        planKey: 'not-sure',
        billingCycle: 'yearly',
        consentVersion: CONSENT_VERSIONS[0],
        consentAt: new Date(),
      },
    });
  }

  function stubCashfreeLink(linkUrl = 'https://payments-test.cashfree.com/links/e2e'): void {
    cashfreeFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ cf_link_id: 4242, link_status: 'ACTIVE', link_url: linkUrl }),
    });
  }

  /** Creates a payment link for a fresh lead and returns the lead and the stored payment. */
  async function leadWithLink(amountRupees = 1500) {
    const lead = await createLead();
    stubCashfreeLink();
    const res = await pPost(`/internal/registrations/${lead.id}/payment-links`, { amountRupees });
    expect(res.status).toBe(201);
    const payment = await prisma.registrationPayment.findUniqueOrThrow({ where: { linkId: res.body.linkId as string } });
    return { lead, payment, view: res.body as Record<string, unknown> };
  }

  const sign = (timestamp: string, raw: string, secret = SECRET): string =>
    createHmac('sha256', secret).update(`${timestamp}${raw}`).digest('base64');

  function webhook(raw: string, opts: { secret?: string; contentType?: string; timestamp?: string; signature?: string } = {}) {
    const timestamp = opts.timestamp ?? Date.now().toString();
    const req = request(http())
      .post('/public/cashfree/webhook')
      .set('content-type', opts.contentType ?? 'application/json')
      .set('x-webhook-timestamp', timestamp);
    const signature = opts.signature ?? sign(timestamp, raw, opts.secret);
    return req.set('x-webhook-signature', signature).send(raw);
  }

  const linkEvent = (linkId: string, over: { status?: string; paid?: number | null; orderId?: string | null; type?: string } = {}): string =>
    JSON.stringify({
      type: over.type ?? 'PAYMENT_LINK_EVENT',
      version: 1,
      event_time: new Date().toISOString(),
      data: {
        cf_link_id: 4242,
        link_id: linkId,
        link_status: over.status ?? 'PAID',
        link_amount: 1500,
        link_amount_paid: over.paid === undefined ? 1500 : over.paid,
        order: over.orderId === null ? null : { order_id: over.orderId ?? 'CFPay_e2e', transaction_status: 'SUCCESS' },
      },
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    // rawBody: webhook signatures are over the exact bytes received (createApp enables it in production).
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    applyHttpDefaults(app);
    await app.init();
    prisma = app.get(PrismaService);
    client = app.get(CashfreeClient).useForTests({
      fetch: cashfreeFetch as unknown as typeof fetch,
      config: () => activeConfig,
    });

    const login = await request(http()).post('/auth/login').send({ email: 'platform@manhar.local', password: 'ChangeMe!Dev12345' });
    expect(login.status).toBe(200);
    platformToken = login.body.accessToken as string;

    const biz = await pPost('/internal/businesses', { name: `CashfreeTestBiz ${RUN}`, businessTypeKey: 'restaurant' });
    expect(biz.status).toBe(201);
    const ownerEmail = `cf-owner-${RUN}@test.local`;
    const pw = 'TestCf!Pass123';
    expect((await pPost(`/internal/businesses/${biz.body.id as string}/provision`, { email: ownerEmail, displayName: 'Cf Owner', password: pw })).status).toBe(201);
    const bizLogin = await request(http()).post('/auth/login').send({ email: ownerEmail, password: pw });
    expect(bizLogin.status).toBe(200);
    businessToken = bizLogin.body.accessToken as string;
  });

  beforeEach(() => {
    cashfreeFetch.mockReset();
    activeConfig = CONFIG;
  });

  afterAll(async () => {
    if (prisma) {
      const leads = await prisma.registrationRequest.findMany({ where: { email: { endsWith: EMAIL_TAG } }, select: { id: true } });
      await prisma.registrationPayment.deleteMany({ where: { registrationId: { in: leads.map((l) => l.id) } } });
      await prisma.registrationRequest.deleteMany({ where: { email: { endsWith: EMAIL_TAG } } });
    }
    if (app) await app.close();
  });

  // ─── Not configured ───────────────────────────────────────────────────────────

  describe('when the Cashfree keys are not set', () => {
    it('creating a link answers 503 with a plain message, and nothing is stored or sent', async () => {
      activeConfig = null;
      const lead = await createLead();
      const res = await pPost(`/internal/registrations/${lead.id}/payment-links`, { amountRupees: 1500 });
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('PAYMENTS_NOT_CONFIGURED');
      expect(res.body.error.message).toMatch(/not set up/i);
      expect(cashfreeFetch).not.toHaveBeenCalled();
      expect(await prisma.registrationPayment.count({ where: { registrationId: lead.id } })).toBe(0);
    });

    it('the webhook answers 503 so Cashfree retries later, rather than silently accepting', async () => {
      activeConfig = null;
      expect((await webhook(linkEvent('whatever'))).status).toBe(503);
    });
  });

  // ─── Creating links ───────────────────────────────────────────────────────────

  describe('POST /internal/registrations/:id/payment-links', () => {
    it('401 without a token, 403 for a restaurant (business-realm) user', async () => {
      const lead = await createLead();
      const url = `/internal/registrations/${lead.id}/payment-links`;
      expect((await request(http()).post(url).send({ amountRupees: 100 })).status).toBe(401);
      const denied = await request(http()).post(url).set('authorization', `Bearer ${businessToken}`).send({ amountRupees: 100 });
      expect(denied.status).toBe(403);
      expect((await request(http()).get(url).set('authorization', `Bearer ${businessToken}`)).status).toBe(403);
      expect(cashfreeFetch).not.toHaveBeenCalled();
    });

    it('validates the amount: positive, at most two decimals, within bounds, no unknown fields', async () => {
      const lead = await createLead();
      const url = `/internal/registrations/${lead.id}/payment-links`;
      for (const bad of [{}, { amountRupees: 0 }, { amountRupees: -5 }, { amountRupees: 10.001 }, { amountRupees: 5_000_000 }, { amountRupees: '100' }, { amountRupees: 100, extra: 1 }]) {
        expect((await pPost(url, bad)).status).toBe(400);
      }
      expect(cashfreeFetch).not.toHaveBeenCalled();
    });

    it('404 for an unknown request', async () => {
      expect((await pPost('/internal/registrations/00000000-0000-4000-8000-000000000000/payment-links', { amountRupees: 100 })).status).toBe(404);
    });

    it('creates the link on Cashfree and stores it, with the owner details Cashfree needs', async () => {
      const { lead, payment, view } = await leadWithLink(1500.5);
      expect(view).toMatchObject({ linkUrl: 'https://payments-test.cashfree.com/links/e2e', amountPaise: 150_050, status: 'CREATED', currency: 'INR' });
      expect(view).not.toHaveProperty('createdBy');
      expect(payment.registrationId).toBe(lead.id);
      expect(payment.cfLinkId).toBe('4242');
      expect(payment.linkId).toMatch(new RegExp(`^${lead.referenceCode}-[0-9a-f]{8}$`));

      const [url, init] = cashfreeFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://sandbox.cashfree.com/pg/links');
      expect(init.headers).toMatchObject({ 'x-client-id': 'e2e-app-id', 'x-client-secret': SECRET });
      const sent = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(sent).toMatchObject({
        link_id: payment.linkId,
        link_amount: 1500.5,
        customer_details: { customer_name: 'Asha Patel', customer_phone: '9714571522' },
        link_meta: { notify_url: CONFIG.webhookUrl },
      });
    });

    it('shows the link on GET .../payment-links and inside the registration request itself', async () => {
      const { lead, payment } = await leadWithLink();
      const list = await pGet(`/internal/registrations/${lead.id}/payment-links`);
      expect(list.status).toBe(200);
      expect((list.body as { linkId: string }[]).map((p) => p.linkId)).toEqual([payment.linkId]);
      const one = await pGet(`/internal/registrations/${lead.id}`);
      expect(one.body.payments).toHaveLength(1);
      expect(one.body.payments[0]).toMatchObject({ linkId: payment.linkId, status: 'CREATED' });
      const all = await pGet('/internal/registrations?take=100');
      const row = (all.body.items as { id: string; payments: unknown[] }[]).find((i) => i.id === lead.id);
      expect(row?.payments).toHaveLength(1);
    });

    it('reports a Cashfree refusal as 502 with the reason, and stores nothing', async () => {
      const lead = await createLead();
      cashfreeFetch.mockResolvedValueOnce({ ok: false, status: 401, text: async () => JSON.stringify({ code: 'authentication_failed', message: 'Invalid client credentials' }) });
      const res = await pPost(`/internal/registrations/${lead.id}/payment-links`, { amountRupees: 100 });
      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('PAYMENT_PROVIDER_ERROR');
      expect(res.body.error.message).toContain('Invalid client credentials');
      expect(JSON.stringify(res.body)).not.toContain(SECRET);
      expect(await prisma.registrationPayment.count({ where: { registrationId: lead.id } })).toBe(0);
    });
  });

  // ─── The webhook ──────────────────────────────────────────────────────────────

  describe('POST /public/cashfree/webhook', () => {
    it('rejects an unsigned, wrongly signed or tampered request with 401 and changes nothing', async () => {
      const { payment } = await leadWithLink();
      const raw = linkEvent(payment.linkId);
      const stamp = Date.now().toString();

      expect((await request(http()).post('/public/cashfree/webhook').set('content-type', 'application/json').send(raw)).status).toBe(401);
      expect((await webhook(raw, { secret: 'someone-elses-secret' })).status).toBe(401);
      expect((await webhook(raw, { timestamp: stamp, signature: sign(stamp, raw) + 'x' })).status).toBe(401);
      // signed for a different body (a $1 link "paid" as a $1500 one)
      const signedForOther = sign(stamp, linkEvent(payment.linkId, { paid: 1 }));
      expect((await webhook(raw, { timestamp: stamp, signature: signedForOther })).status).toBe(401);

      expect((await prisma.registrationPayment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('CREATED');
    });

    it('marks the payment PAID, records the order, and qualifies the request', async () => {
      const { lead, payment } = await leadWithLink(1500);
      const res = await webhook(linkEvent(payment.linkId, { orderId: 'CFPay_e2e_1' }));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, outcome: 'updated' });

      const row = await prisma.registrationPayment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(row).toMatchObject({ status: 'PAID', paidAmountPaise: 150_000, providerOrderId: 'CFPay_e2e_1' });
      expect(row.paidAt).not.toBeNull();
      expect((await prisma.registrationRequest.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe('QUALIFIED');
      const shown = await pGet(`/internal/registrations/${lead.id}`);
      expect(shown.body.payments[0].status).toBe('PAID');
    });

    it('is idempotent: Cashfree retrying the same event changes nothing', async () => {
      const { payment } = await leadWithLink();
      expect((await webhook(linkEvent(payment.linkId))).body.outcome).toBe('updated');
      const first = await prisma.registrationPayment.findUniqueOrThrow({ where: { id: payment.id } });
      const again = await webhook(linkEvent(payment.linkId, { orderId: 'CFPay_other' }));
      expect(again.status).toBe(200);
      expect(again.body.outcome).toBe('duplicate');
      const second = await prisma.registrationPayment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(second.paidAt?.getTime()).toBe(first.paidAt?.getTime());
      expect(second.providerOrderId).toBe(first.providerOrderId);
    });

    it('survives many retries arriving at once: exactly one applies', async () => {
      const { payment } = await leadWithLink();
      const results = await Promise.all(Array.from({ length: 6 }, () => webhook(linkEvent(payment.linkId))));
      expect(results.every((r) => r.status === 200)).toBe(true);
      const outcomes = results.map((r) => r.body.outcome as string);
      expect(outcomes.filter((o) => o === 'updated')).toHaveLength(1);
      expect(outcomes.filter((o) => o === 'duplicate')).toHaveLength(5);
    });

    it('does not treat a wrong amount as paid: AMOUNT_MISMATCH, request not qualified', async () => {
      const { lead, payment } = await leadWithLink(1500);
      const res = await webhook(linkEvent(payment.linkId, { paid: 1 }));
      expect(res.status).toBe(200);
      expect(res.body.outcome).toBe('amount-mismatch');
      expect((await prisma.registrationPayment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('AMOUNT_MISMATCH');
      expect((await prisma.registrationRequest.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe('NEW');
    });

    it('accepts a form-encoded body (the docs also describe "form data") signed over its raw bytes', async () => {
      const { lead, payment } = await leadWithLink(1500);
      const form = new URLSearchParams({ type: 'PAYMENT_LINK_EVENT', data: JSON.stringify(JSON.parse(linkEvent(payment.linkId)).data) }).toString();
      const res = await webhook(form, { contentType: 'application/x-www-form-urlencoded' });
      expect(res.status).toBe(200);
      expect(res.body.outcome).toBe('updated');
      expect((await prisma.registrationRequest.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe('QUALIFIED');
    });

    it('applies EXPIRED to an open link, and a later PAID still wins (money moved)', async () => {
      const { payment } = await leadWithLink();
      expect((await webhook(linkEvent(payment.linkId, { status: 'EXPIRED', paid: null, orderId: null }))).body.outcome).toBe('updated');
      expect((await prisma.registrationPayment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('EXPIRED');
      expect((await webhook(linkEvent(payment.linkId))).body.outcome).toBe('updated');
      expect((await prisma.registrationPayment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('PAID');
      // ...and an out-of-order EXPIRED afterwards cannot undo it
      expect((await webhook(linkEvent(payment.linkId, { status: 'EXPIRED', paid: null, orderId: null }))).body.outcome).toBe('duplicate');
      expect((await prisma.registrationPayment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('PAID');
    });

    it('acknowledges (200, ignored) an unknown link and an event of another type, so Cashfree stops retrying', async () => {
      expect((await webhook(linkEvent('NX-UNKNOWN-00000000'))).body.outcome).toBe('ignored');
      expect((await webhook(linkEvent('x', { type: 'PAYMENT_SUCCESS_WEBHOOK' }))).body.outcome).toBe('ignored');
      // a body that is not JSON at all never reaches the handler (the body parser answers 400)
      expect((await webhook('not json at all')).status).toBe(400);
    });

    it('once paid, another link for the same request is refused (409): no double charge', async () => {
      const { lead, payment } = await leadWithLink();
      expect((await webhook(linkEvent(payment.linkId))).status).toBe(200);
      const res = await pPost(`/internal/registrations/${lead.id}/payment-links`, { amountRupees: 100 });
      expect(res.status).toBe(409);
      expect(cashfreeFetch).toHaveBeenCalledTimes(1); // only the original creation
    });
  });

  it('the client the app uses is the one under test', () => {
    expect(client).toBeInstanceOf(CashfreeClient);
  });
});
