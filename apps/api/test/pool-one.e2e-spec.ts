import { createHash } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';
import { CashfreeClient } from '../src/cashfree/cashfree.client';
import type { CashfreeConfig } from '../src/cashfree/cashfree.config';
import { RegistrationPaymentService } from '../src/cashfree/registration-payment.service';
import { SubscriptionService } from '../src/cashfree/subscription.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { CONSENT_VERSIONS } from '../src/registration/registration.dto';
import { generateReferenceCode } from '../src/registration/registration.util';

/**
 * Neon's pooled URL on Vercel gives every serverless instance ONE database connection (connection_limit=1). Code that
 * opens a transaction and then runs another query through the normal client while it waits (or calls Cashfree while
 * holding a transaction) waits forever for a connection that never frees up. Local and CI use bigger pools, so those
 * bugs only show in production. This runs the money -> account -> claim chain with a pool of exactly ONE connection and
 * a 5 second pool timeout, so any such wait fails here instead.
 */
describe('Pay now -> paid -> account -> claim with a pool of one connection (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const RUN = Date.now().toString(36);
  const http = () => app.getHttpServer();
  const saved = { ...process.env };
  const cashfreeFetch = jest.fn();
  const CONFIG: CashfreeConfig = {
    clientId: 'e2e-app-id',
    clientSecret: 'e2e-cashfree-secret-not-real',
    environment: 'sandbox',
    baseUrl: 'https://sandbox.cashfree.com/pg',
    apiVersion: '2025-01-01',
    webhookUrl: undefined,
  };
  const SECRET = 'pool-one-payer-secret-0123456789abcdef-xyz';
  let seq = 0;

  const lead = () =>
    prisma.registrationRequest.create({
      data: {
        referenceCode: generateReferenceCode(),
        restaurantName: `Pool One Cafe ${RUN}-${++seq}`,
        contactName: 'Asha Patel',
        email: `pool${seq}-${RUN}@example.test`,
        phone: '+919714571522',
        city: 'Visnagar',
        businessKind: 'cafe',
        outlets: 1,
        planKey: 'floor',
        billingCycle: 'yearly',
        consentVersion: CONSENT_VERSIONS[0],
        consentAt: new Date(),
        payerSecretHash: createHash('sha256').update(SECRET).digest('hex'),
      },
    });

  beforeAll(async () => {
    const base = process.env.DATABASE_URL ?? '';
    process.env.DATABASE_URL = `${base}${base.includes('?') ? '&' : '?'}connection_limit=1&pool_timeout=5`;
    process.env.CASHFREE_CLIENT_ID = 'e2e-app-id';
    process.env.CASHFREE_CLIENT_SECRET = 'e2e-cashfree-secret-not-real';
    process.env.CUSTOMER_PAY_ENABLED = 'true';
    process.env.CUSTOMER_PAY_RATE_LIMIT = '1000';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    applyHttpDefaults(app);
    await app.init();
    prisma = app.get(PrismaService);
    app.get(CashfreeClient).useForTests({ fetch: cashfreeFetch as unknown as typeof fetch, config: () => CONFIG });
  });

  afterAll(async () => {
    await app.close();
    process.env = { ...saved };
  });

  it('the pool really is one connection', async () => {
    // Two queries at once on one connection still complete (they queue), proving the limit is in effect without a deadlock.
    const rows = await Promise.all([prisma.$queryRaw`select 1 as a`, prisma.$queryRaw`select 2 as a`]);
    expect(rows).toHaveLength(2);
    expect(process.env.DATABASE_URL).toContain('connection_limit=1');
  });

  it('two Pay now taps at once: one Cashfree call, one link, the claim released, nothing times out', async () => {
    const l = await lead();
    cashfreeFetch.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ cf_link_id: 7, link_status: 'ACTIVE', link_url: 'https://payments-test.cashfree.com/links/pool' }) });
    const who = { referenceCode: l.referenceCode, email: l.email };
    const [a, b] = await Promise.all([request(http()).post('/public/payments/pay-link').send(who), request(http()).post('/public/payments/pay-link').send(who)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(a.body.link.linkUrl).toBe(b.body.link.linkUrl);
    expect(cashfreeFetch).toHaveBeenCalledTimes(1);
    expect(await prisma.registrationPayment.count({ where: { registrationId: l.id } })).toBe(1);
    expect((await prisma.registrationRequest.findUniqueOrThrow({ where: { id: l.id } })).payLockedAt).toBeNull();
  });

  it('paid -> the account is created -> the owner claims it, all on one connection', async () => {
    const l = await lead();
    cashfreeFetch.mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ cf_link_id: 8, link_status: 'ACTIVE', link_url: 'https://payments-test.cashfree.com/links/pool2' }) });
    const created = await request(http()).post('/public/payments/pay-link').send({ referenceCode: l.referenceCode, email: l.email });
    expect(created.status).toBe(200);
    const payment = await prisma.registrationPayment.findFirstOrThrow({ where: { registrationId: l.id } });

    const outcome = await app.get(RegistrationPaymentService).applyLinkEvent({ linkId: payment.linkId, linkStatus: 'PAID', amountPaidRupees: payment.amountPaise / 100, orderId: 'CFPay_pool' });
    expect(outcome).toBe('updated');

    // The payment already started the account after its response; a claim asked meanwhile may see "pending" while that
    // run finishes. Poll like the web page does (every second here) until the link is ready.
    let token: string | undefined;
    for (let i = 0; i < 40 && !token; i++) {
      const issue = await request(http()).post('/public/claim/issue').send({ referenceCode: l.referenceCode, phoneLast4: '1522', payerSecret: SECRET });
      expect(issue.status).toBe(200);
      expect(['ready', 'pending']).toContain(issue.body.status);
      if (issue.body.status === 'ready') token = issue.body.token as string;
      else await new Promise((r) => setTimeout(r, 1000));
    }
    expect(token).toBeTruthy();
    const redeem = await request(http()).post('/public/claim/redeem').send({ token, password: 'A-strong-passw0rd-for-pool' });
    expect(redeem.status).toBe(200);
    expect(redeem.body.email).toBe(l.email);
    expect(await prisma.business.findUnique({ where: { registrationId: l.id } })).not.toBeNull();
  });

  it('the AutoPay first-debit write (advisory lock inside a transaction) works and is idempotent on one connection', async () => {
    const l = await lead();
    const sub = { registrationId: l.id, amountPaise: 70_682, planKey: 'counter', quote: { description: 'pool one' } };
    const event = { kind: 'payment', cfPaymentId: `pool-${RUN}`, occurredAt: new Date() };
    const record = (): Promise<boolean> => (app.get(SubscriptionService) as unknown as { recordFirstPayment: (...a: unknown[]) => Promise<boolean> }).recordFirstPayment(sub, 70_682, event, new Date());
    expect(await record()).toBe(true);
    expect(await record()).toBe(false);
    expect(await prisma.registrationPayment.count({ where: { registrationId: l.id, status: 'PAID' } })).toBe(1);
    // Leave nothing behind that the provisioning cron (and the specs that count its work) would pick up later.
    await prisma.registrationRequest.update({ where: { id: l.id }, data: { status: 'SPAM' } });
  });
});
