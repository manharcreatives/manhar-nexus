import { quotePlan } from '@nexus/shared';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';
import { PrismaService } from '../src/prisma/prisma.service';
import { AutoProvisionService } from '../src/provisioning/auto-provision.service';
import { paidUntilFor } from '../src/provisioning/billing-record.service';
import { ClaimService } from '../src/provisioning/claim.service';
import { CONSENT_VERSIONS } from '../src/registration/registration.dto';
import { generateReferenceCode } from '../src/registration/registration.util';

/**
 * Operator tools: a client's people and password-reset links, correcting a lead's contact details, recording a payment
 * that did not come through Cashfree, accepting a mismatched payment, and the plan -> modules mapping. Real stack and DB.
 */
describe('Operator + billing API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auto: AutoProvisionService;
  let platformToken: string;

  const RUN = Date.now().toString(36);
  const http = () => app.getHttpServer();
  let seq = 0;

  const bearer = (t: string) => ({ authorization: `Bearer ${t}` });
  const pGet = (path: string) => request(http()).get(path).set(bearer(platformToken));
  const pPost = (path: string, b: object = {}) => request(http()).post(path).set(bearer(platformToken)).send(b);
  const pPatch = (path: string, b: object) => request(http()).patch(path).set(bearer(platformToken)).send(b);
  const login = (email: string, password: string) => request(http()).post('/auth/login').send({ email, password });
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function createLead(over: { status?: 'NEW' | 'SPAM'; planKey?: string; cycle?: string; phone?: string; payment?: Record<string, unknown> | null } = {}) {
    seq += 1;
    const lead = await prisma.registrationRequest.create({
      data: {
        referenceCode: generateReferenceCode(),
        status: over.status ?? 'NEW',
        restaurantName: `Operator Cafe ${RUN}-${seq}`,
        contactName: 'Asha Patel',
        email: `op${seq}-${RUN}@example.test`,
        phone: over.phone ?? '+919714571522',
        city: 'Visnagar',
        businessKind: 'cafe',
        outlets: 1,
        planKey: over.planKey ?? 'floor',
        billingCycle: over.cycle ?? 'yearly',
        consentVersion: CONSENT_VERSIONS[0],
        consentAt: new Date(),
      },
    });
    if (over.payment) {
      await prisma.registrationPayment.create({
        data: {
          registrationId: lead.id,
          linkId: `${lead.referenceCode}-${RUN}${seq}`,
          linkUrl: 'https://payments-test.cashfree.com/links/e2e',
          amountPaise: 1_149_320,
          purpose: 'e2e',
          createdBy: 'e2e',
          planKey: 'floor',
          billingCycle: 'yearly',
          source: 'CUSTOMER',
          status: 'AMOUNT_MISMATCH',
          paidAmountPaise: 10_000,
          ...over.payment,
        },
      });
    }
    return lead;
  }

  /** Waits for the account that the payment starts after its response (it runs in the background). */
  async function businessFor(registrationId: string, ms = 20_000) {
    const until = Date.now() + ms;
    for (;;) {
      const biz = await prisma.business.findUnique({ where: { registrationId } });
      if (biz) return biz;
      if (Date.now() > until) return null;
      await sleep(250);
    }
  }

  /** A created account whose owner has chosen a password and signed in. Returns ids and the owner's tokens. */
  async function signedInOwner(password = 'Owner-pass-1!') {
    const lead = await createLead({ payment: { status: 'PAID', paidAmountPaise: 1_149_320, paidAt: new Date('2026-12-01T10:00:00Z') } });
    expect(await auto.autoProvision(lead.id)).toBe('created');
    const biz = await prisma.business.findUniqueOrThrow({ where: { registrationId: lead.id } });
    const link = await pPost(`/internal/registrations/${lead.id}/claim-link`);
    expect(link.status).toBe(200);
    const redeemed = await request(http()).post('/public/claim/redeem').send({ token: link.body.token, password });
    expect(redeemed.status).toBe(200);
    const res = await login(lead.email, password);
    expect(res.status).toBe(200);
    const owner = await prisma.user.findFirstOrThrow({ where: { businessId: biz.id } });
    return { lead, biz, owner, password, accessToken: res.body.accessToken as string };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    applyHttpDefaults(app);
    await app.init();
    prisma = app.get(PrismaService);
    auto = app.get(AutoProvisionService);
    const res = await login('platform@manhar.local', 'ChangeMe!Dev12345');
    expect(res.status).toBe(200);
    platformToken = res.body.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  // ── a client's people ──────────────────────────────────────────────────────────

  describe('GET /internal/businesses/:id/users', () => {
    it('lists the people with last sign-in, roles and lock state, and never a hash', async () => {
      const { biz, owner, lead } = await signedInOwner();
      const res = await pGet(`/internal/businesses/${biz.id}/users`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ id: owner.id, email: lead.email, name: 'Asha Patel', status: 'ACTIVE', roles: ['Owner'], failedLoginCount: 0, lockedUntil: null });
      expect(typeof res.body[0].lastLoginAt).toBe('string');
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|argon2|tokenVersion/);
    });

    it('shows a lock and failed attempts', async () => {
      const { biz, owner } = await signedInOwner();
      await prisma.user.update({ where: { id: owner.id }, data: { failedAttempts: 5, lockedUntil: new Date(Date.now() + 600_000) } });
      const res = await pGet(`/internal/businesses/${biz.id}/users`);
      expect(res.body[0].failedLoginCount).toBe(5);
      expect(typeof res.body[0].lockedUntil).toBe('string');
    });

    it('is closed to a business user', async () => {
      const { biz, accessToken } = await signedInOwner();
      expect((await request(http()).get(`/internal/businesses/${biz.id}/users`).set(bearer(accessToken))).status).toBe(403);
    });
  });

  // ── reset link ─────────────────────────────────────────────────────────────────

  describe('POST /internal/businesses/:id/users/:userId/reset-link', () => {
    it('after the owner has signed in: revokes sessions, and the link sets a new password once', async () => {
      const { biz, owner, password, accessToken } = await signedInOwner();
      // The registration claim link is refused now (the owner has signed in); the reset link is the staff tool.
      const stale = await pPost(`/internal/registrations/${biz.registrationId}/claim-link`);
      expect(stale.status).toBe(409);

      const res = await pPost(`/internal/businesses/${biz.id}/users/${owner.id}/reset-link`);
      expect(res.status).toBe(200);
      expect(typeof res.body.token).toBe('string');
      expect(typeof res.body.expiresAt).toBe('string');

      // The owner's open session stops working, and they must choose a new password.
      expect((await request(http()).get('/auth/me').set(bearer(accessToken))).status).toBe(401);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).mustChangePassword).toBe(true);

      const next = 'Brand-new-pass-2!';
      const ok = await request(http()).post('/public/claim/redeem').send({ token: res.body.token, password: next });
      expect(ok.status).toBe(200);
      expect(ok.body.businessName).toBeTruthy();
      expect((await login(owner.email, next)).status).toBe(200);
      expect((await login(owner.email, password)).status).toBe(401);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).mustChangePassword).toBe(false);

      // Single use.
      expect((await request(http()).post('/public/claim/redeem').send({ token: res.body.token, password: 'Another-pass-3!' })).status).toBe(404);
      // The token itself is never stored.
      expect(await prisma.credentialToken.count({ where: { tokenHash: res.body.token } })).toBe(0);
      const audit = await prisma.auditEvent.findFirst({ where: { businessId: biz.id, action: 'user.password_reset_link_issued' } });
      expect(audit?.resourceId).toBe(owner.id);
      expect(JSON.stringify(audit?.metadata)).not.toContain(res.body.token);
    });

    it('a newer link replaces the older one', async () => {
      const { biz, owner } = await signedInOwner();
      const first = await pPost(`/internal/businesses/${biz.id}/users/${owner.id}/reset-link`);
      const second = await pPost(`/internal/businesses/${biz.id}/users/${owner.id}/reset-link`);
      expect((await request(http()).post('/public/claim/redeem').send({ token: first.body.token, password: 'Pass-word-1234!' })).status).toBe(404);
      expect((await request(http()).post('/public/claim/redeem').send({ token: second.body.token, password: 'Pass-word-1234!' })).status).toBe(200);
    });

    it('a payer link is still refused after the owner has signed in (only staff resets are honoured)', async () => {
      const { biz, owner } = await signedInOwner();
      // A leftover payer-style token for a user who has signed in.
      const claims = app.get(ClaimService);
      const payerLink = await claims.issue(owner.id, biz.registrationId as string, biz.id, 'customer');
      expect((await request(http()).post('/public/claim/redeem').send({ token: payerLink.token, password: 'Pass-word-1234!' })).status).toBe(404);
    });

    it('404 for a user of another business, 409 for a deactivated user, 403 for a business user', async () => {
      const a = await signedInOwner();
      const b = await signedInOwner();
      expect((await pPost(`/internal/businesses/${a.biz.id}/users/${b.owner.id}/reset-link`)).status).toBe(404);
      expect((await pPost(`/internal/businesses/${a.biz.id}/users/00000000-0000-4000-8000-000000000000/reset-link`)).status).toBe(404);
      await prisma.user.update({ where: { id: b.owner.id }, data: { status: 'SUSPENDED' } });
      expect((await pPost(`/internal/businesses/${b.biz.id}/users/${b.owner.id}/reset-link`)).status).toBe(409);
      expect((await request(http()).post(`/internal/businesses/${a.biz.id}/users/${a.owner.id}/reset-link`).set(bearer(a.accessToken))).status).toBe(403);
      expect((await request(http()).post(`/internal/businesses/${a.biz.id}/users/${a.owner.id}/reset-link`)).status).toBe(401);
    });
  });

  // ── correcting contact details ─────────────────────────────────────────────────

  describe('PATCH /internal/registrations/:id (contact details)', () => {
    it('fixes name, email and phone before the account exists (the phone is normalised)', async () => {
      const lead = await createLead({ phone: '+919000000000' });
      const res = await pPatch(`/internal/registrations/${lead.id}`, { contactName: 'Asha Shah', email: `Fixed-${RUN}@Example.test`, phone: '98765 43210' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ contactName: 'Asha Shah', email: `fixed-${RUN}@example.test`, phone: '+919876543210' });
      const row = await prisma.registrationRequest.findUniqueOrThrow({ where: { id: lead.id } });
      expect(row.phone).toBe('+919876543210');
    });

    it('rejects a bad phone, an unknown field, and an edit once the account exists', async () => {
      const lead = await createLead();
      expect((await pPatch(`/internal/registrations/${lead.id}`, { phone: '12345' })).status).toBe(400);
      expect((await pPatch(`/internal/registrations/${lead.id}`, { password: 'x' })).status).toBe(400);
      const made = await signedInOwner();
      const res = await pPatch(`/internal/registrations/${made.lead.id}`, { email: `new-${RUN}@example.test` });
      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/Clients > People/);
    });

    it('a waiting account job follows the corrected owner email and name', async () => {
      const lead = await createLead({ payment: { status: 'PAID', paidAmountPaise: 1_149_320 } });
      await prisma.registrationProvisioning.create({
        data: {
          registrationId: lead.id,
          status: 'FAILED',
          completedSteps: [],
          lastError: 'That email already has an account. Use a different owner email and retry.',
          startedBy: 'e2e',
          input: { name: 'X', locationName: 'Main', ownerName: 'Old Name', ownerEmail: 'old@example.test', commercialStatus: 'ACTIVE', modules: ['restaurant'] },
        },
      });
      const res = await pPatch(`/internal/registrations/${lead.id}`, { email: `corrected-${RUN}@example.test`, contactName: 'New Name' });
      expect(res.status).toBe(200);
      const job = await prisma.registrationProvisioning.findUniqueOrThrow({ where: { registrationId: lead.id } });
      expect(job.input).toMatchObject({ ownerEmail: `corrected-${RUN}@example.test`, ownerName: 'New Name' });
    });

    it('the claim proof follows the corrected phone (last four digits)', async () => {
      const lead = await createLead({ phone: '+919000001111' });
      await pPatch(`/internal/registrations/${lead.id}`, { phone: '9000002222' });
      const row = await prisma.registrationRequest.findUniqueOrThrow({ where: { id: lead.id } });
      expect(row.phone.slice(-4)).toBe('2222');
    });
  });

  // ── manual payment ─────────────────────────────────────────────────────────────

  describe('POST /internal/registrations/:id/manual-payment', () => {
    const body = (over: Record<string, unknown> = {}) => ({ planKey: 'floor', cycle: 'yearly', method: 'UPI', reference: `UPI-${RUN}-${Math.random().toString(36).slice(2, 8)}`, ...over });

    it('records the payment at the server quote, then the account appears with a MANUAL record', async () => {
      const lead = await createLead();
      const paidOn = '2026-11-05T09:30:00.000Z';
      const res = await pPost(`/internal/registrations/${lead.id}/manual-payment`, body({ paidOn }));
      expect(res.status).toBe(201);
      const quote = quotePlan({ planKey: 'floor', cycle: 'yearly', offerDate: lead.createdAt });
      expect(res.body).toMatchObject({ status: 'PAID', source: 'MANUAL', planKey: 'floor', billingCycle: 'yearly', amountPaise: quote.totalPaise, paidAmountPaise: quote.totalPaise, overrideReason: null });
      expect(new Date(res.body.paidAt).toISOString()).toBe(paidOn);
      expect(res.body.breakdown.length).toBeGreaterThan(0);

      const biz = await businessFor(lead.id);
      expect(biz).not.toBeNull();
      expect(biz).toMatchObject({ planKey: 'floor', billingCycle: 'yearly', billingSource: 'MANUAL' });
      expect(biz?.paidUntil?.toISOString()).toBe(paidUntilFor(new Date(paidOn), 'yearly').toISOString());
      expect((await prisma.registrationRequest.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe('CONVERTED');
    });

    it('a double click records one payment and one account', async () => {
      const lead = await createLead();
      const same = body({ reference: `UPI-DOUBLE-${RUN}` });
      const [a, b] = await Promise.all([pPost(`/internal/registrations/${lead.id}/manual-payment`, same), pPost(`/internal/registrations/${lead.id}/manual-payment`, same)]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      await businessFor(lead.id);
      expect(await prisma.registrationPayment.count({ where: { registrationId: lead.id, status: 'PAID' } })).toBe(1);
      expect(await prisma.business.count({ where: { registrationId: lead.id } })).toBe(1);
    });

    it('a second payment with another reference is refused (already paid)', async () => {
      const lead = await createLead();
      expect((await pPost(`/internal/registrations/${lead.id}/manual-payment`, body())).status).toBe(201);
      const again = await pPost(`/internal/registrations/${lead.id}/manual-payment`, body());
      expect(again.status).toBe(409);
    });

    it('a different amount needs a reason; with one it is recorded and still creates the account', async () => {
      const lead = await createLead();
      const quote = quotePlan({ planKey: 'floor', cycle: 'yearly', offerDate: lead.createdAt });
      const noReason = await pPost(`/internal/registrations/${lead.id}/manual-payment`, body({ amountRupees: 5000 }));
      expect(noReason.status).toBe(400);
      expect(await prisma.registrationPayment.count({ where: { registrationId: lead.id } })).toBe(0);
      const sameAmount = quote.totalPaise / 100;
      const equalIsNotAnOverride = await pPost(`/internal/registrations/${lead.id}/manual-payment`, body({ amountRupees: sameAmount }));
      expect(equalIsNotAnOverride.status).toBe(201);
      expect(equalIsNotAnOverride.body.overrideReason).toBeNull();

      const other = await createLead();
      const typed = await pPost(`/internal/registrations/${other.id}/manual-payment`, body({ amountRupees: 5000, overrideReason: 'Agreed discount for two years' }));
      expect(typed.status).toBe(201);
      expect(typed.body).toMatchObject({ amountPaise: 500_000, paidAmountPaise: 500_000, overrideReason: 'Agreed discount for two years' });
      expect(await businessFor(other.id)).not.toBeNull();
    });

    it('refuses unknown fields, unpriced plans, a future date, a closed request and an existing account', async () => {
      const lead = await createLead();
      const url = `/internal/registrations/${lead.id}/manual-payment`;
      expect((await pPost(url, body({ extra: 1 }))).status).toBe(400);
      expect((await pPost(url, body({ planKey: 'many-doors' }))).status).toBe(400);
      expect((await pPost(url, body({ method: 'CRYPTO' }))).status).toBe(400);
      expect((await pPost(url, body({ reference: 'ab' }))).status).toBe(400);
      expect((await pPost(url, body({ paidOn: '2099-01-01' }))).status).toBe(400);
      expect((await pPost(url, body({ paidOn: 'not a date' }))).status).toBe(400);
      const spam = await createLead({ status: 'SPAM' });
      expect((await pPost(`/internal/registrations/${spam.id}/manual-payment`, body())).status).toBe(400);
      const made = await signedInOwner();
      expect((await pPost(`/internal/registrations/${made.lead.id}/manual-payment`, body())).status).toBe(409);
      expect((await pPost('/internal/registrations/00000000-0000-4000-8000-000000000000/manual-payment', body())).status).toBe(404);
      expect(await prisma.registrationPayment.count({ where: { registrationId: lead.id } })).toBe(0);
    });

    it('is closed to a business user and to anonymous callers', async () => {
      const { accessToken } = await signedInOwner();
      const lead = await createLead();
      expect((await request(http()).post(`/internal/registrations/${lead.id}/manual-payment`).set(bearer(accessToken)).send(body())).status).toBe(403);
      expect((await request(http()).post(`/internal/registrations/${lead.id}/manual-payment`).send(body())).status).toBe(401);
    });
  });

  // ── accept a mismatch ──────────────────────────────────────────────────────────

  describe('POST /internal/registrations/:id/payments/:paymentId/accept', () => {
    it('accepts a mismatched payment with a reason, keeps the amount actually paid, and creates the account', async () => {
      const lead = await createLead({ payment: {} });
      const payment = await prisma.registrationPayment.findFirstOrThrow({ where: { registrationId: lead.id } });
      const res = await pPost(`/internal/registrations/${lead.id}/payments/${payment.id}/accept`, { reason: 'Owner paid the rest in cash' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'PAID', paidAmountPaise: 10_000, amountPaise: 1_149_320 });
      const stored = await prisma.registrationPayment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(stored.quote).toMatchObject({ accepted: { reason: 'Owner paid the rest in cash', quotedPaise: 1_149_320, paidPaise: 10_000 } });
      const biz = await businessFor(lead.id);
      expect(biz).toMatchObject({ planKey: 'floor', billingSource: 'LINK' });
      expect(biz?.paidUntil).not.toBeNull();
    });

    it('only works once, only for a mismatch, and only with a reason', async () => {
      const lead = await createLead({ payment: {} });
      const payment = await prisma.registrationPayment.findFirstOrThrow({ where: { registrationId: lead.id } });
      const url = `/internal/registrations/${lead.id}/payments/${payment.id}/accept`;
      expect((await pPost(url, { reason: 'x' })).status).toBe(400);
      expect((await pPost(url, {})).status).toBe(400);
      expect((await pPost(url, { reason: 'fine', extra: 1 })).status).toBe(400);
      const [a, b] = await Promise.all([pPost(url, { reason: 'Checked in Cashfree' }), pPost(url, { reason: 'Checked in Cashfree' })]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
      await businessFor(lead.id);
      expect(await prisma.business.count({ where: { registrationId: lead.id } })).toBe(1);

      const created = await createLead({ payment: { status: 'CREATED', paidAmountPaise: null } });
      const row = await prisma.registrationPayment.findFirstOrThrow({ where: { registrationId: created.id } });
      expect((await pPost(`/internal/registrations/${created.id}/payments/${row.id}/accept`, { reason: 'try anyway' })).status).toBe(409);
      const paid = await createLead({ payment: { status: 'PAID', paidAmountPaise: 1_149_320 } });
      const paidRow = await prisma.registrationPayment.findFirstOrThrow({ where: { registrationId: paid.id } });
      expect((await pPost(`/internal/registrations/${paid.id}/payments/${paidRow.id}/accept`, { reason: 'try anyway' })).status).toBe(409);
      const noAmount = await createLead({ payment: { paidAmountPaise: null } });
      const noAmountRow = await prisma.registrationPayment.findFirstOrThrow({ where: { registrationId: noAmount.id } });
      expect((await pPost(`/internal/registrations/${noAmount.id}/payments/${noAmountRow.id}/accept`, { reason: 'unknown amount' })).status).toBe(409);
    });

    it('404 for a payment of another request; closed to a business user', async () => {
      const lead = await createLead({ payment: {} });
      const other = await createLead();
      const payment = await prisma.registrationPayment.findFirstOrThrow({ where: { registrationId: lead.id } });
      expect((await pPost(`/internal/registrations/${other.id}/payments/${payment.id}/accept`, { reason: 'wrong request' })).status).toBe(404);
      const { accessToken } = await signedInOwner();
      expect((await request(http()).post(`/internal/registrations/${lead.id}/payments/${payment.id}/accept`).set(bearer(accessToken)).send({ reason: 'nope nope' })).status).toBe(403);
    });
  });

  // ── plan -> modules ────────────────────────────────────────────────────────────

  describe('automatic accounts get the modules their plan includes', () => {
    const modulesOf = async (businessId: string) =>
      (await prisma.moduleActivation.findMany({ where: { businessId }, select: { moduleKey: true } })).map((m) => m.moduleKey).sort();

    it.each([
      ['counter', ['catalog', 'checkout', 'reports', 'restaurant']],
      ['floor', ['catalog', 'checkout', 'costs', 'reports', 'restaurant']],
      ['pass', ['catalog', 'checkout', 'costs', 'reports', 'restaurant']],
    ])('%s', async (planKey, expected) => {
      const lead = await createLead({ planKey, payment: { status: 'PAID', planKey, paidAmountPaise: 1_149_320 } });
      expect(await auto.autoProvision(lead.id)).toBe('created');
      const biz = await prisma.business.findUniqueOrThrow({ where: { registrationId: lead.id } });
      expect(await modulesOf(biz.id)).toEqual(expected);
    });

    it('staff-run provisioning keeps the wizard default (reports and costs)', async () => {
      const lead = await createLead({ planKey: 'counter' });
      const res = await pPost(`/internal/registrations/${lead.id}/provision`, { allowUnpaid: true });
      expect(res.status).toBe(200);
      const biz = await prisma.business.findFirstOrThrow({ where: { id: res.body.businessId } });
      expect(await modulesOf(biz.id)).toEqual(['catalog', 'checkout', 'costs', 'reports', 'restaurant']);
    });
  });
});
