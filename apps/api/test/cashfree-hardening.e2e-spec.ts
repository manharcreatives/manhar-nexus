import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';
import { CashfreeClient } from '../src/cashfree/cashfree.client';
import type { CashfreeConfig } from '../src/cashfree/cashfree.config';
import { claimCreateLock, releaseCreateLock } from '../src/cashfree/pay-lock';
import { AutoProvisionService } from '../src/provisioning/auto-provision.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { CONSENT_VERSIONS } from '../src/registration/registration.dto';
import { generateReferenceCode } from '../src/registration/registration.util';

/**
 * Hardening from the final security review: the link-creation lock is only ever released by the holder that wrote it,
 * staff and the owner cannot both create a live link, public responses are never cacheable, and a Cashfree link that
 * could not be recorded is closed again. Cashfree is stubbed; the rest is the real stack.
 */
describe('Payment link hardening (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let platformToken: string;
  const RUN = Date.now().toString(36);
  const EMAIL_TAG = `-hard-${RUN}@example.test`;
  const http = () => app.getHttpServer();
  const cashfreeFetch = jest.fn();
  let seq = 0;
  const CONFIG: CashfreeConfig = {
    clientId: 'e2e-app-id',
    clientSecret: 'e2e-cashfree-secret-not-real',
    environment: 'sandbox',
    baseUrl: 'https://sandbox.cashfree.com/pg',
    apiVersion: '2025-01-01',
    webhookUrl: undefined,
  };
  const saved = { ...process.env };

  const okLink = (url = 'https://payments-test.cashfree.com/links/hard') => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ cf_link_id: 7, link_status: 'ACTIVE', link_url: url }),
  });
  const okEmpty = { ok: true, status: 200, text: async () => '{}' };

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
        outlets: 1,
        planKey: 'floor',
        billingCycle: 'yearly',
        consentVersion: CONSENT_VERSIONS[0],
        consentAt: new Date(),
      },
    });
  }

  const payLink = (lead: { referenceCode: string; email: string }) =>
    request(http()).post('/public/payments/pay-link').send({ referenceCode: lead.referenceCode, email: lead.email });
  const staffCreate = (id: string, body: object = {}) =>
    request(http()).post(`/internal/registrations/${id}/payment-links`).set('authorization', `Bearer ${platformToken}`).send(body);
  const lockOf = async (id: string) => (await prisma.registrationRequest.findUniqueOrThrow({ where: { id } })).payLockedAt;
  const waitFor = async (check: () => Promise<boolean>) => {
    for (let i = 0; i < 100; i++) {
      if (await check()) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error('condition not reached');
  };

  beforeAll(async () => {
    process.env.CASHFREE_CLIENT_ID = 'e2e-app-id';
    process.env.CASHFREE_CLIENT_SECRET = 'e2e-cashfree-secret-not-real';
    process.env.CUSTOMER_PAY_ENABLED = 'true';
    process.env.CUSTOMER_PAY_RATE_LIMIT = '1000';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    applyHttpDefaults(app);
    await app.init();
    prisma = app.get(PrismaService);
    jest.spyOn(app.get(AutoProvisionService), 'autoProvision').mockResolvedValue('skipped');
    app.get(CashfreeClient).useForTests({ fetch: cashfreeFetch as unknown as typeof fetch, config: () => CONFIG });
    const login = await request(http()).post('/auth/login').send({ email: 'platform@manhar.local', password: 'ChangeMe!Dev12345' });
    expect(login.status).toBe(200);
    platformToken = login.body.accessToken as string;
  });

  beforeEach(() => {
    cashfreeFetch.mockReset();
  });

  afterAll(async () => {
    await prisma.registrationPayment.deleteMany({ where: { registration: { email: { endsWith: EMAIL_TAG } } } });
    await prisma.registrationRequest.deleteMany({ where: { email: { endsWith: EMAIL_TAG } } });
    await app.close();
    process.env = { ...saved };
  });

  it('a stalled tap whose claim went stale cannot clear the newer holder\'s lock, so no second live link appears', async () => {
    const lead = await createLead();
    let finishCashfree!: () => void;
    cashfreeFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishCashfree = () => resolve(okLink());
        }),
    );
    // Tap A claims the lock and stalls inside the Cashfree call.
    const tapA = payLink(lead).then((r) => r);
    await waitFor(async () => (await lockOf(lead.id)) !== null && cashfreeFetch.mock.calls.length === 1);

    // A's claim goes stale and tap B takes it over (simulated: B's claim value replaces A's).
    const bValue = new Date(Date.now() + 5_000);
    await prisma.registrationRequest.update({ where: { id: lead.id }, data: { payLockedAt: bValue } });

    finishCashfree();
    const resA = await tapA;
    expect(resA.status).toBe(200);
    expect(resA.body.outcome).toBe('link');

    // A's release did nothing to B's claim: still held, so a third tap cannot start a second link.
    expect((await lockOf(lead.id))?.getTime()).toBe(bValue.getTime());
    expect(await claimCreateLock(prisma, lead.id, new Date())).toBeNull();
    expect(await prisma.registrationPayment.count({ where: { registrationId: lead.id } })).toBe(1);
    expect(cashfreeFetch).toHaveBeenCalledTimes(1);

    // Only the holder's own value releases it.
    await releaseCreateLock(prisma, lead.id, new Date(bValue.getTime() + 1));
    expect(await lockOf(lead.id)).not.toBeNull();
    await releaseCreateLock(prisma, lead.id, bValue);
    expect(await lockOf(lead.id)).toBeNull();
  });

  it('a staff click while the owner\'s Pay now is creating a link is refused (409) and nothing is sent to Cashfree', async () => {
    const lead = await createLead();
    await prisma.registrationRequest.update({ where: { id: lead.id }, data: { payLockedAt: new Date() } });
    const res = await staffCreate(lead.id);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/being created/);
    expect(cashfreeFetch).not.toHaveBeenCalled();
    expect(await prisma.registrationPayment.count({ where: { registrationId: lead.id } })).toBe(0);
    // The refused staff click did not steal or clear the owner's claim.
    expect(await lockOf(lead.id)).not.toBeNull();
  });

  it('a staff link creates normally when nobody holds the lock, and always releases it', async () => {
    const lead = await createLead();
    cashfreeFetch.mockResolvedValueOnce(okLink());
    const res = await staffCreate(lead.id);
    expect(res.status).toBe(201);
    expect(await lockOf(lead.id)).toBeNull();
    // A refused second link (409 open link) also releases the lock it claimed.
    const again = await staffCreate(lead.id);
    expect(again.status).toBe(409);
    expect(await lockOf(lead.id)).toBeNull();
  });

  it('a stale lock (crashed instance) does not block staff for ever', async () => {
    const lead = await createLead();
    await prisma.registrationRequest.update({ where: { id: lead.id }, data: { payLockedAt: new Date(Date.now() - 120_000) } });
    cashfreeFetch.mockResolvedValueOnce(okLink());
    expect((await staffCreate(lead.id)).status).toBe(201);
    expect(await lockOf(lead.id)).toBeNull();
  });

  it('public responses are never cacheable; a non-public API route is not touched by the default', async () => {
    const config = await request(http()).get('/public/payments/config');
    expect(config.status).toBe(200);
    expect(config.headers['cache-control']).toBe('no-store');
    const claim = await request(http()).post('/public/claim/issue').send({ referenceCode: generateReferenceCode(), phoneLast4: '0000', payerSecret: 'x'.repeat(43) });
    expect(claim.status).toBe(404);
    expect(claim.headers['cache-control']).toBe('no-store');
    const internal = await request(http()).get('/internal/registrations?take=1').set('authorization', `Bearer ${platformToken}`);
    expect(internal.headers['cache-control']).not.toBe('no-store');
  });

  it('if the link cannot be recorded after Cashfree created it, the link is cancelled at Cashfree and the error is not hidden', async () => {
    const lead = await createLead();
    const spy = jest.spyOn(prisma.registrationPayment, 'create').mockRejectedValueOnce(new Error('db went away'));
    try {
      cashfreeFetch.mockResolvedValueOnce(okLink()).mockResolvedValueOnce(okEmpty);
      const res = await staffCreate(lead.id);
      expect(res.status).toBe(500);
      expect(cashfreeFetch).toHaveBeenCalledTimes(2);
      const [cancelUrl, cancelInit] = cashfreeFetch.mock.calls[1] as [string, RequestInit];
      expect(cancelUrl).toMatch(/\/pg\/links\/.+\/cancel$/);
      expect(cancelInit.method).toBe('POST');
      const created = JSON.parse((cashfreeFetch.mock.calls[0] as [string, RequestInit])[1].body as string) as { link_id: string };
      expect(cancelUrl).toContain(encodeURIComponent(created.link_id));
      expect(await prisma.registrationPayment.count({ where: { registrationId: lead.id } })).toBe(0);
      expect(await lockOf(lead.id)).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it('if even the cancel fails, the original error still surfaces (best effort)', async () => {
    const lead = await createLead();
    const spy = jest.spyOn(prisma.registrationPayment, 'create').mockRejectedValueOnce(new Error('db went away'));
    try {
      cashfreeFetch.mockResolvedValueOnce(okLink()).mockResolvedValueOnce({ ok: false, status: 500, text: async () => '{}' });
      expect((await staffCreate(lead.id)).status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });
});
