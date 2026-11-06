import { createHmac } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AutoProvisionService } from '../src/provisioning/auto-provision.service';
import { BillingRecordService } from '../src/provisioning/billing-record.service';
import { applyHttpDefaults } from '../src/app.factory';
import { CashfreeClient } from '../src/cashfree/cashfree.client';
import type { CashfreeConfig } from '../src/cashfree/cashfree.config';
import { PrismaService } from '../src/prisma/prisma.service';
import { CONSENT_VERSIONS } from '../src/registration/registration.dto';
import { generateReferenceCode } from '../src/registration/registration.util';

/**
 * UPI AutoPay mandates (Cashfree Subscriptions) for the owner's monthly plan. Cashfree is stubbed (no network); the
 * rest is the real stack: guards, signature check on the raw body, Prisma and the database.
 */
describe('Cashfree AutoPay subscriptions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let autoProvision: jest.SpyInstance<Promise<unknown>, [string, Date?]>;
  let extendPaidUntil: jest.SpyInstance<Promise<void>, [string, Date, string]>;
  const settle = async () => {
    for (let i = 0; i < 4; i += 1) await new Promise((r) => setImmediate(r));
  };
  let platformToken: string;
  let businessToken: string;

  const RUN = Date.now().toString(36);
  const EMAIL_TAG = `-sub-${RUN}@example.test`;
  const SECRET = 'e2e-cashfree-secret-not-real';
  const http = () => app.getHttpServer();
  let seq = 0;

  const CONFIG: CashfreeConfig = {
    clientId: 'e2e-app-id',
    clientSecret: SECRET,
    environment: 'sandbox',
    baseUrl: 'https://sandbox.cashfree.com/pg',
    apiVersion: '2025-01-01',
    webhookUrl: undefined,
  };
  const cashfreeFetch = jest.fn();

  const pGet = (path: string) => request(http()).get(path).set('authorization', `Bearer ${platformToken}`);
  const pPost = (path: string, b: object) => request(http()).post(path).set('authorization', `Bearer ${platformToken}`).send(b);

  async function createLead(plan: { planKey?: string } = {}) {
    return prisma.registrationRequest.create({
      data: {
        referenceCode: generateReferenceCode(),
        restaurantName: 'Ananda Cafe',
        contactName: 'Asha Patel',
        email: `lead${++seq}${EMAIL_TAG}`,
        phone: '+919714571522',
        city: 'Visnagar',
        businessKind: 'cafe',
        outlets: 1,
        planKey: plan.planKey ?? 'counter',
        billingCycle: 'monthly',
        consentVersion: CONSENT_VERSIONS[0],
        consentAt: new Date(),
      },
    });
  }

  const subscriptionBody = (status = 'INITIALIZED', session: string | null = 'sub_session_e2e') =>
    JSON.stringify({ cf_subscription_id: '555', subscription_id: 'x', subscription_status: status, ...(session ? { subscription_session_id: session } : {}) });

  function stubCashfree(status = 'INITIALIZED', session: string | null = 'sub_session_e2e'): void {
    cashfreeFetch.mockResolvedValueOnce({ ok: true, status: 200, text: async () => subscriptionBody(status, session) });
  }

  const urlsCalled = () => cashfreeFetch.mock.calls.map((c) => `${(c[1] as RequestInit).method} ${(c[0] as string).replace('https://sandbox.cashfree.com/pg', '')}`);

  const sign = (timestamp: string, raw: string): string => createHmac('sha256', SECRET).update(`${timestamp}${raw}`).digest('base64');
  function webhook(raw: string) {
    const timestamp = Date.now().toString();
    return request(http())
      .post('/public/cashfree/webhook')
      .set('content-type', 'application/json')
      .set('x-webhook-timestamp', timestamp)
      .set('x-webhook-signature', sign(timestamp, raw))
      .send(raw);
  }

  const statusEvent = (subscriptionId: string, status: string): string =>
    JSON.stringify({ data: { subscription_details: { subscription_id: subscriptionId, subscription_status: status } }, event_time: new Date().toISOString(), type: 'SUBSCRIPTION_STATUS_CHANGED' });

  const paymentEvent = (
    subscriptionId: string,
    over: { type?: string; paymentType?: string; amount?: number; status?: string; cfPaymentId?: string; reason?: string | null },
  ): string =>
    JSON.stringify({
      data: {
        payment_id: 'p-1',
        cf_payment_id: over.cfPaymentId ?? 'cfp-1',
        subscription_id: subscriptionId,
        payment_type: over.paymentType ?? 'PERIODIC',
        payment_amount: over.amount,
        payment_status: over.status ?? 'SUCCESS',
        failure_details: { failure_reason: over.reason ?? null },
      },
      event_time: new Date().toISOString(),
      type: over.type ?? 'SUBSCRIPTION_PAYMENT_SUCCESS',
    });

  /** A lead with a created, unauthorised mandate. */
  async function leadWithMandate(planKey = 'counter') {
    const lead = await createLead({ planKey });
    stubCashfree();
    const res = await pPost(`/internal/registrations/${lead.id}/subscriptions`, {});
    expect(res.status).toBe(201);
    const row = await prisma.registrationSubscription.findUniqueOrThrow({ where: { id: res.body.id as string } });
    return { lead, row, view: res.body as Record<string, unknown> };
  }

  beforeAll(async () => {
    process.env.SUBSCRIPTIONS_ENABLED = 'true';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    applyHttpDefaults(app);
    await app.init();
    prisma = app.get(PrismaService);
    // No real restaurant is created here (it has its own tests); we only record what was asked for.
    autoProvision = jest.spyOn(app.get(AutoProvisionService), 'autoProvision').mockResolvedValue('skipped');
    extendPaidUntil = jest.spyOn(app.get(BillingRecordService), 'extendPaidUntil').mockResolvedValue(undefined);
    app.get(CashfreeClient).useForTests({ fetch: cashfreeFetch as unknown as typeof fetch, config: () => CONFIG });

    const login = await request(http()).post('/auth/login').send({ email: 'platform@manhar.local', password: 'ChangeMe!Dev12345' });
    expect(login.status).toBe(200);
    platformToken = login.body.accessToken as string;

    const biz = await pPost('/internal/businesses', { name: `SubTestBiz ${RUN}`, businessTypeKey: 'restaurant' });
    expect(biz.status).toBe(201);
    const ownerEmail = `sub-owner-${RUN}@test.local`;
    const pw = 'TestSub!Pass123';
    expect((await pPost(`/internal/businesses/${biz.body.id as string}/provision`, { email: ownerEmail, displayName: 'Sub Owner', password: pw })).status).toBe(201);
    const bizLogin = await request(http()).post('/auth/login').send({ email: ownerEmail, password: pw });
    businessToken = bizLogin.body.accessToken as string;
  });

  beforeEach(() => {
    cashfreeFetch.mockReset();
    process.env.SUBSCRIPTIONS_ENABLED = 'true';
  });

  afterAll(async () => {
    delete process.env.SUBSCRIPTIONS_ENABLED;
    if (prisma) {
      const leads = await prisma.registrationRequest.findMany({ where: { email: { endsWith: EMAIL_TAG } }, select: { id: true } });
      const ids = leads.map((l) => l.id);
      const subs = await prisma.registrationSubscription.findMany({ where: { registrationId: { in: ids } }, select: { id: true } });
      await prisma.registrationSubscriptionCharge.deleteMany({ where: { subscriptionRowId: { in: subs.map((s) => s.id) } } });
      await prisma.registrationSubscription.deleteMany({ where: { registrationId: { in: ids } } });
      await prisma.registrationPayment.deleteMany({ where: { registrationId: { in: ids } } });
      await prisma.registrationRequest.deleteMany({ where: { email: { endsWith: EMAIL_TAG } } });
    }
    if (app) await app.close();
  });

  describe('creating a mandate', () => {
    it('is off (503, nothing sent) until SUBSCRIPTIONS_ENABLED is set', async () => {
      process.env.SUBSCRIPTIONS_ENABLED = 'false';
      const lead = await createLead();
      const res = await pPost(`/internal/registrations/${lead.id}/subscriptions`, {});
      expect(res.status).toBe(503);
      expect(cashfreeFetch).not.toHaveBeenCalled();
    });

    it('401 without a token, 403 for a restaurant user', async () => {
      const lead = await createLead();
      expect((await request(http()).post(`/internal/registrations/${lead.id}/subscriptions`).send({})).status).toBe(401);
      const denied = await request(http()).post(`/internal/registrations/${lead.id}/subscriptions`).set('authorization', `Bearer ${businessToken}`).send({});
      expect(denied.status).toBe(403);
    });

    it('prices the MONTHLY plan + 18% GST on the server and sends a PERIODIC monthly UPI plan to Cashfree', async () => {
      const lead = await createLead({ planKey: 'floor' });
      stubCashfree();
      const res = await pPost(`/internal/registrations/${lead.id}/subscriptions`, {});
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ planKey: 'floor', amountPaise: 153_282, status: 'INITIALIZED' });
      expect(res.body.authPath).toMatch(/^\/pay\/autopay\/[A-Za-z0-9_-]{30,}$/);
      expect(JSON.stringify(res.body)).not.toContain('sub_session');
      const sent = JSON.parse((cashfreeFetch.mock.calls[0] as [string, RequestInit])[1].body as string) as { plan_details: Record<string, unknown>; authorization_details: { payment_methods: string[] }; customer_details: { customer_phone: string } };
      expect(sent.plan_details).toMatchObject({ plan_type: 'PERIODIC', plan_amount: 1532.82, plan_max_amount: 1532.82, plan_interval_type: 'MONTH', plan_intervals: 1 });
      expect(sent.authorization_details.payment_methods).toEqual(['upi']);
      expect(sent.customer_details.customer_phone).toBe('9714571522');
    });

    it('rejects client prices and unknown fields (400) and a plan with no fixed price (400 needsPlan)', async () => {
      const lead = await createLead();
      for (const bad of [{ amountRupees: 1 }, { amountPaise: 1 }, { cycle: 'yearly' }, { planKey: 'many-doors' }, { extra: 1 }]) {
        expect((await pPost(`/internal/registrations/${lead.id}/subscriptions`, bad)).status).toBe(400);
      }
      const unsure = await createLead({ planKey: 'not-sure' });
      const res = await pPost(`/internal/registrations/${unsure.id}/subscriptions`, {});
      expect(res.status).toBe(400);
      expect(res.body.error.details.needsPlan).toBe(true);
      expect(cashfreeFetch).not.toHaveBeenCalled();
    });

    it('one live mandate per request: a second is refused (409) until replaced, which cancels the old one at Cashfree first', async () => {
      const { lead, row } = await leadWithMandate();
      const url = `/internal/registrations/${lead.id}/subscriptions`;
      const blocked = await pPost(url, {});
      expect(blocked.status).toBe(409);
      expect(blocked.body.error.details.openSubscriptionIds).toEqual([row.id]);

      stubCashfree('CANCELLED'); // cancel
      stubCashfree(); // create
      const replaced = await pPost(url, { replaceOpen: true });
      expect(replaced.status).toBe(201);
      expect(urlsCalled().slice(-2)).toEqual([`POST /subscriptions/${row.subscriptionId}/manage`, 'POST /subscriptions']);
      expect((await prisma.registrationSubscription.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('CANCELLED');
    });

    it('an authorised (ACTIVE) mandate cannot be replaced, even with replaceOpen: cancel it first', async () => {
      const { lead, row } = await leadWithMandate();
      expect((await webhook(statusEvent(row.subscriptionId, 'ACTIVE'))).status).toBe(200);
      cashfreeFetch.mockReset();
      const res = await pPost(`/internal/registrations/${lead.id}/subscriptions`, { replaceOpen: true });
      expect(res.status).toBe(409);
      expect(cashfreeFetch).not.toHaveBeenCalled();
    });

    it('a Cashfree refusal is a 502 with the reason and stores nothing', async () => {
      const lead = await createLead();
      cashfreeFetch.mockResolvedValueOnce({ ok: false, status: 422, text: async () => JSON.stringify({ code: 'subscription_not_enabled', message: 'Subscriptions not enabled' }) });
      const res = await pPost(`/internal/registrations/${lead.id}/subscriptions`, {});
      expect(res.status).toBe(502);
      expect(res.body.error.message).toContain('Subscriptions not enabled');
      expect(await prisma.registrationSubscription.count({ where: { registrationId: lead.id } })).toBe(0);
    });

    it('delays the first debit by a month when a payment link was already paid', async () => {
      const lead = await createLead();
      const paidAt = new Date('2026-11-05T10:00:00Z');
      await prisma.registrationPayment.create({
        data: { registrationId: lead.id, linkId: `e2e-${RUN}-${lead.id.slice(0, 6)}`, linkUrl: 'https://x.test', amountPaise: 70_682, purpose: 'x', status: 'PAID', paidAmountPaise: 70_682, paidAt, createdBy: 'e2e' },
      });
      stubCashfree();
      expect((await pPost(`/internal/registrations/${lead.id}/subscriptions`, {})).status).toBe(201);
      const sent = JSON.parse((cashfreeFetch.mock.calls[0] as [string, RequestInit])[1].body as string) as Record<string, string>;
      expect(sent.subscription_first_charge_time.slice(0, 10)).toBe('2026-12-05');
    });
  });

  describe('the owner authorisation page API', () => {
    it('returns the checkout session for a fresh mandate, 404 for a made-up token', async () => {
      const { view } = await leadWithMandate();
      const token = (view.authPath as string).split('/').pop() as string;
      stubCashfree('INITIALIZED', 'sub_session_fresh');
      const res = await request(http()).get(`/public/subscriptions/checkout/${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ state: 'ready', sessionId: 'sub_session_fresh', environment: 'sandbox', restaurantName: 'Ananda Cafe', amountPaise: 70_682 });
      expect((await request(http()).get('/public/subscriptions/checkout/not-a-real-token')).status).toBe(404);
    });

    it('says "authorised" once the mandate moved on, without asking Cashfree', async () => {
      const { view, row } = await leadWithMandate();
      await webhook(statusEvent(row.subscriptionId, 'BANK_APPROVAL_PENDING'));
      cashfreeFetch.mockReset();
      const token = (view.authPath as string).split('/').pop() as string;
      const res = await request(http()).get(`/public/subscriptions/checkout/${token}`);
      expect(res.body).toEqual({ state: 'authorised' });
      expect(cashfreeFetch).not.toHaveBeenCalled();
    });
  });

  describe('webhooks', () => {
    it('status changes move the mandate forward; ACTIVE records the activation time; a closed mandate is never revived', async () => {
      const { row } = await leadWithMandate();
      expect((await webhook(statusEvent(row.subscriptionId, 'ACTIVE'))).body.outcome).toBe('updated');
      const active = await prisma.registrationSubscription.findUniqueOrThrow({ where: { id: row.id } });
      expect(active.status).toBe('ACTIVE');
      expect(active.activatedAt).not.toBeNull();
      expect((await webhook(statusEvent(row.subscriptionId, 'ACTIVE'))).body.outcome).toBe('duplicate');
      await webhook(statusEvent(row.subscriptionId, 'CUSTOMER_CANCELLED'));
      expect((await webhook(statusEvent(row.subscriptionId, 'ACTIVE'))).body.outcome).toBe('duplicate');
      const closed = await prisma.registrationSubscription.findUniqueOrThrow({ where: { id: row.id } });
      expect(closed.status).toBe('CUSTOMER_CANCELLED');
      expect(closed.cancelledAt).not.toBeNull();
    });

    it('records the authorisation debit and each failed or successful monthly debit once (retries are no-ops)', async () => {
      const { row } = await leadWithMandate();
      const auth = paymentEvent(row.subscriptionId, { type: 'SUBSCRIPTION_AUTH_STATUS', paymentType: 'AUTH', amount: 1, cfPaymentId: 'auth-1' });
      expect((await webhook(auth)).body.outcome).toBe('updated');
      expect((await webhook(auth)).body.outcome).toBe('duplicate');
      const failed = paymentEvent(row.subscriptionId, { type: 'SUBSCRIPTION_PAYMENT_FAILED', amount: 706.82, status: 'FAILED', cfPaymentId: 'dbt-fail', reason: 'INSUFFICIENT FUNDS' });
      expect((await webhook(failed)).body.outcome).toBe('updated');
      const charges = await prisma.registrationSubscriptionCharge.findMany({ where: { subscriptionRowId: row.id }, orderBy: { occurredAt: 'asc' } });
      expect(charges.map((c) => [c.cfPaymentId, c.kind, c.status])).toEqual([
        ['auth-1', 'AUTH', 'SUCCESS'],
        ['dbt-fail', 'CHARGE', 'FAILED'],
      ]);
      expect(charges[1]?.failureReason).toBe('INSUFFICIENT FUNDS');
      expect((await prisma.registrationSubscription.findUniqueOrThrow({ where: { id: row.id } })).lastChargeStatus).toBe('FAILED');
      expect(await prisma.registrationPayment.count({ where: { registrationId: row.registrationId } })).toBe(0); // a failed debit is not a payment
    });

    it('the first successful monthly debit counts as paid (PAID payment row, lead QUALIFIED); later months do not add rows; a retry is a no-op', async () => {
      const { lead, row } = await leadWithMandate();
      const ok = paymentEvent(row.subscriptionId, { amount: 706.82, cfPaymentId: 'dbt-1' });
      expect((await webhook(ok)).body.outcome).toBe('updated');
      expect((await webhook(ok)).body.outcome).toBe('duplicate');
      const paid = await prisma.registrationPayment.findMany({ where: { registrationId: lead.id } });
      expect(paid).toHaveLength(1);
      expect(paid[0]).toMatchObject({ status: 'PAID', amountPaise: 70_682, paidAmountPaise: 70_682, billingCycle: 'monthly', source: 'AUTOPAY', planKey: 'counter' });
      expect((await prisma.registrationRequest.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe('QUALIFIED');
      await webhook(paymentEvent(row.subscriptionId, { amount: 706.82, cfPaymentId: 'dbt-2' }));
      await settle();
      // The first debit creates the account (once, even with a retried webhook); the next month only extends paid-until.
      expect(autoProvision.mock.calls.filter((c) => c[0] === lead.id)).toHaveLength(1);
      expect(extendPaidUntil.mock.calls.filter((c) => c[0] === lead.id)).toHaveLength(1);
      expect(extendPaidUntil.mock.calls.find((c) => c[0] === lead.id)?.[2]).toBe('monthly');
      expect(await prisma.registrationPayment.count({ where: { registrationId: lead.id } })).toBe(1);
      expect(await prisma.registrationSubscriptionCharge.count({ where: { subscriptionRowId: row.id } })).toBe(2);
    });

    it('a monthly debit for a different amount is flagged AMOUNT_MISMATCH and does NOT mark the request paid', async () => {
      const { lead, row } = await leadWithMandate();
      expect((await webhook(paymentEvent(row.subscriptionId, { amount: 1, cfPaymentId: 'dbt-bad' }))).body.outcome).toBe('amount-mismatch');
      const charge = await prisma.registrationSubscriptionCharge.findUniqueOrThrow({ where: { cfPaymentId: 'dbt-bad' } });
      expect(charge.status).toBe('AMOUNT_MISMATCH');
      expect(await prisma.registrationPayment.count({ where: { registrationId: lead.id } })).toBe(0);
      await settle();
      expect(autoProvision.mock.calls.filter((c) => c[0] === lead.id)).toHaveLength(0); // a mismatch is never auto-provisioned
    });

    it('unknown subscriptions and event types we only acknowledge are 200 and ignored; a bad signature is 401', async () => {
      expect((await webhook(statusEvent('no-such-sub', 'ACTIVE'))).body.outcome).toBe('ignored');
      const notification = JSON.stringify({ data: { subscription_id: 'x' }, type: 'SUBSCRIPTION_PAYMENT_NOTIFICATION_INITIATED' });
      expect((await webhook(notification)).body.outcome).toBe('ignored');
      const bad = await request(http()).post('/public/cashfree/webhook').set('content-type', 'application/json').set('x-webhook-timestamp', '1').set('x-webhook-signature', 'nope').send('{}');
      expect(bad.status).toBe(401);
    });
  });

  describe('cancel and refresh', () => {
    it('staff cancel: cancels at Cashfree, marks it, is idempotent, and 404s for another request', async () => {
      const { lead, row } = await leadWithMandate();
      const url = `/internal/registrations/${lead.id}/subscriptions/${row.id}/cancel`;
      cashfreeFetch.mockReset(); // forget the create call
      stubCashfree('CANCELLED');
      const res = await pPost(url, {});
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'CANCELLED', authPath: null });
      expect(urlsCalled()).toEqual([`POST /subscriptions/${row.subscriptionId}/manage`]);
      cashfreeFetch.mockReset();
      expect((await pPost(url, {})).status).toBe(200); // already closed: no call
      expect(cashfreeFetch).not.toHaveBeenCalled();
      const other = await createLead();
      expect((await pPost(`/internal/registrations/${other.id}/subscriptions/${row.id}/cancel`, {})).status).toBe(404);
    });

    it('if Cashfree refuses the cancel, the mandate stays as it was (502)', async () => {
      const { lead, row } = await leadWithMandate();
      cashfreeFetch.mockResolvedValueOnce({ ok: false, status: 400, text: async () => JSON.stringify({ code: 'x', message: 'Cannot cancel' }) });
      const res = await pPost(`/internal/registrations/${lead.id}/subscriptions/${row.id}/cancel`, {});
      expect(res.status).toBe(502);
      expect((await prisma.registrationSubscription.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('INITIALIZED');
    });

    it('"Check" asks Cashfree and applies the status like a webhook; list shows it with its charges', async () => {
      const { lead, row } = await leadWithMandate();
      stubCashfree('ACTIVE');
      const res = await pPost(`/internal/registrations/${lead.id}/subscriptions/${row.id}/refresh`, {});
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ outcome: 'updated', subscription: { status: 'ACTIVE' } });
      await webhook(paymentEvent(row.subscriptionId, { amount: 706.82, cfPaymentId: 'dbt-list' }));
      const list = await pGet(`/internal/registrations/${lead.id}/subscriptions`);
      expect(list.status).toBe(200);
      expect(list.body).toHaveLength(1);
      expect(list.body[0]).toMatchObject({ status: 'ACTIVE', authPath: null, lastChargeStatus: 'SUCCESS' });
      expect(list.body[0].charges).toHaveLength(1);
    });
  });
});
