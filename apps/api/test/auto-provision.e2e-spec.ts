import { createHash } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';
import { PrismaService } from '../src/prisma/prisma.service';
import { AutoProvisionService } from '../src/provisioning/auto-provision.service';
import { BillingRecordService, paidUntilFor } from '../src/provisioning/billing-record.service';
import { ClaimService } from '../src/provisioning/claim.service';
import { CONSENT_VERSIONS } from '../src/registration/registration.dto';
import { generateReferenceCode } from '../src/registration/registration.util';

/**
 * Payment -> account, with no human in the loop: gates, no duplicates, the owner's one-time set-password link, the cron
 * and what the admin sees. Real stack and database; Cashfree is never involved (payments are rows, as a webhook leaves them).
 */
describe('Auto-provisioning after payment (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auto: AutoProvisionService;
  let billing: BillingRecordService;
  let platformToken: string;

  const RUN = Date.now().toString(36);
  const http = () => app.getHttpServer();
  let seq = 0;
  const sha = (v: string) => createHash('sha256').update(v).digest('hex');

  const pGet = (path: string) => request(http()).get(path).set('authorization', `Bearer ${platformToken}`);
  const pPost = (path: string, b: object = {}) => request(http()).post(path).set('authorization', `Bearer ${platformToken}`).send(b);
  const login = (email: string, password: string) => request(http()).post('/auth/login').send({ email, password });

  type PaymentOver = { status?: string; paidAmountPaise?: number | null; amountPaise?: number; planKey?: string | null; source?: string; payerSecret?: string; paidAt?: Date };

  async function createLead(over: { status?: 'NEW' | 'SPAM' | 'QUALIFIED'; planKey?: string; cycle?: string; payment?: PaymentOver | null } = {}) {
    seq += 1;
    const lead = await prisma.registrationRequest.create({
      data: {
        referenceCode: generateReferenceCode(),
        status: over.status ?? 'NEW',
        restaurantName: `Auto Cafe ${RUN}-${seq}`,
        contactName: 'Asha Patel',
        email: `auto${seq}-${RUN}@example.test`,
        phone: '+919714571522',
        city: 'Visnagar',
        businessKind: 'cafe',
        outlets: 1,
        planKey: over.planKey ?? 'floor',
        billingCycle: over.cycle ?? 'yearly',
        consentVersion: CONSENT_VERSIONS[0],
        consentAt: new Date(),
      },
    });
    if (over.payment !== null) {
      const p = over.payment ?? {};
      await prisma.registrationPayment.create({
        data: {
          registrationId: lead.id,
          linkId: `${lead.referenceCode}-${RUN}${seq}`,
          linkUrl: 'https://payments-test.cashfree.com/links/e2e',
          amountPaise: p.amountPaise ?? 1_149_320,
          purpose: 'e2e',
          status: p.status ?? 'PAID',
          paidAmountPaise: p.paidAmountPaise === undefined ? (p.amountPaise ?? 1_149_320) : p.paidAmountPaise,
          paidAt: p.paidAt ?? new Date('2026-12-01T10:00:00Z'),
          createdBy: 'e2e',
          planKey: p.planKey === undefined ? (over.planKey ?? 'floor') : p.planKey,
          billingCycle: over.cycle ?? 'yearly',
          source: p.source ?? 'CUSTOMER',
          ...(p.payerSecret ? { payerSecretHash: sha(p.payerSecret) } : {}),
        },
      });
    }
    return lead;
  }

  const businessOf = (registrationId: string) => prisma.business.findUnique({ where: { registrationId } });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    applyHttpDefaults(app);
    await app.init();
    prisma = app.get(PrismaService);
    auto = app.get(AutoProvisionService);
    billing = app.get(BillingRecordService);
    const res = await login('platform@manhar.local', 'ChangeMe!Dev12345');
    expect(res.status).toBe(200);
    platformToken = res.body.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('the gates: only a fully paid fixed-price plan is created without a person', () => {
    it('creates the account, fills the client record and issues NO password', async () => {
      const lead = await createLead();
      expect(await auto.autoProvision(lead.id)).toBe('created');

      const biz = await businessOf(lead.id);
      expect(biz).toMatchObject({ planKey: 'floor', billingCycle: 'yearly', billingSource: 'LINK', commercialStatus: 'ACTIVE' });
      expect(biz?.paidUntil?.toISOString()).toBe(paidUntilFor(new Date('2026-12-01T10:00:00Z'), 'yearly').toISOString());
      expect((await prisma.registrationRequest.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe('CONVERTED');

      const owner = await prisma.user.findFirstOrThrow({ where: { businessId: biz!.id } });
      expect(owner.email).toBe(lead.email);
      expect(owner.mustChangePassword).toBe(true);
      // The status view of the job never carries credentials for an automatic run.
      const view = await pGet(`/internal/registrations/${lead.id}/provision`);
      expect(view.body.status).toBe('DONE');
      expect(JSON.stringify(view.body)).not.toContain('password');
      // Marked as automatic in the activity history.
      const created = await prisma.auditEvent.findFirst({ where: { businessId: biz!.id, action: 'business.created' } });
      expect(created?.actorLabel).toBe('auto-provision');
      expect(created?.metadata).toMatchObject({ autoProvisioned: true });
    });

    it('does nothing for an amount mismatch, a typed amount, an unpaid link, a pilot or a spam request', async () => {
      const cases: Awaited<ReturnType<typeof createLead>>[] = [
        await createLead({ payment: { status: 'AMOUNT_MISMATCH', paidAmountPaise: 100 } }),
        await createLead({ payment: { paidAmountPaise: 100 } }), // paid less than the amount
        await createLead({ payment: { planKey: null } }), // typed (override) amount
        await createLead({ planKey: 'many-doors', payment: { planKey: null } }),
        await createLead({ payment: { status: 'CREATED', paidAmountPaise: null } }),
        await createLead({ payment: null }), // no payment at all (free pilot is staff-only)
        await createLead({ status: 'SPAM' }),
      ];
      for (const lead of cases) {
        expect(await auto.autoProvision(lead.id)).toBe('skipped');
        expect(await businessOf(lead.id)).toBeNull();
        expect(await prisma.registrationProvisioning.findUnique({ where: { registrationId: lead.id } })).toBeNull();
      }
    });

    it('never throws, even for an unknown registration', async () => {
      await expect(auto.autoProvision('00000000-0000-4000-8000-000000000000')).resolves.toBe('skipped');
    });

    it('two simultaneous runs make exactly one business (webhook retry + Check payment + double click)', async () => {
      const lead = await createLead();
      const results = await Promise.all([auto.autoProvision(lead.id), auto.autoProvision(lead.id), auto.autoProvision(lead.id)]);
      expect(results.filter((r) => r === 'created')).toHaveLength(1);
      expect(await prisma.business.count({ where: { registrationId: lead.id } })).toBe(1);
      expect(await prisma.user.count({ where: { businessId: (await businessOf(lead.id))!.id } })).toBe(1);
      // Running again after it is done changes nothing.
      expect(await auto.autoProvision(lead.id)).toBe('skipped');
      expect(await prisma.business.count({ where: { registrationId: lead.id } })).toBe(1);
    });

    it("an owner email that already has an account stops the job with a clear message for staff, nothing else is created twice", async () => {
      const lead = await createLead();
      const taken = await createLead();
      await auto.autoProvision(taken.id);
      await prisma.registrationRequest.update({ where: { id: lead.id }, data: { email: taken.email } });
      expect(await auto.autoProvision(lead.id)).toBe('failed');
      const job = await prisma.registrationProvisioning.findUniqueOrThrow({ where: { registrationId: lead.id } });
      expect(job).toMatchObject({ status: 'FAILED', currentStep: 'owner' });
      expect(job.lastError).toContain('already has an account');
      // It is on the admin attention list, and the cron does not retry a refusal in a loop.
      const attention = await pGet('/internal/provisioning/attention');
      expect(attention.status).toBe(200);
      expect(attention.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ registrationId: lead.id, reason: 'PROVISIONING_FAILED' })]));
      const tick = await auto.runPending(10);
      expect(tick.outcomes.failed).toBe(0);
      expect((await prisma.registrationProvisioning.findUniqueOrThrow({ where: { registrationId: lead.id } })).status).toBe('FAILED');
    });
  });

  describe('the cron finishes what a late webhook or a crash left behind', () => {
    it('resumes a crashed (stale) run and picks up a paid request nobody started', async () => {
      const crashed = await createLead();
      await prisma.registrationProvisioning.create({
        data: {
          registrationId: crashed.id,
          status: 'RUNNING',
          completedSteps: [],
          lockedAt: new Date(Date.now() - 10 * 60_000),
          startedBy: 'auto-provision',
          input: { name: crashed.restaurantName, locationName: 'Main Location', ownerName: crashed.contactName, ownerEmail: crashed.email, commercialStatus: 'ACTIVE', modules: ['restaurant', 'catalog', 'checkout'], auto: true },
        },
      });
      const unstarted = await createLead();
      const tick = await auto.runPending(10);
      expect(tick.attempted).toBeGreaterThanOrEqual(2);
      expect(await businessOf(crashed.id)).not.toBeNull();
      expect(await businessOf(unstarted.id)).not.toBeNull();
      expect((await prisma.registrationProvisioning.findUniqueOrThrow({ where: { registrationId: crashed.id } })).status).toBe('DONE');
    });

    it('is a protected route: off without CRON_SECRET, 401 for a wrong secret, works with the right one', async () => {
      const previous = process.env.CRON_SECRET;
      delete process.env.CRON_SECRET;
      expect((await request(http()).get('/internal/cron/provision')).status).toBe(503);
      process.env.CRON_SECRET = 'e2e-cron-secret-value';
      try {
        expect((await request(http()).get('/internal/cron/provision')).status).toBe(401);
        expect((await request(http()).get('/internal/cron/provision').set('authorization', 'Bearer nope')).status).toBe(401);
        expect((await request(http()).get('/internal/cron/provision').set('authorization', `Bearer ${platformToken}`)).status).toBe(401);
        const ok = await request(http()).get('/internal/cron/provision').set('authorization', 'Bearer e2e-cron-secret-value');
        expect(ok.status).toBe(200);
        expect(ok.body).toHaveProperty('attempted');
      } finally {
        if (previous === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = previous;
      }
    });
  });

  describe("the owner's one-time set-password link", () => {
    const SECRET = 'payer-secret-for-e2e-0123456789abcdef';
    // The seeded leads have the mobile +919714571522, so the proof digits are 1522.
    const PHONE4 = '1522';
    const issue = (referenceCode: string, phoneLast4: string, payerSecret: string) => request(http()).post('/public/claim/issue').send({ referenceCode, phoneLast4, payerSecret });
    const redeem = (token: string, password: string) => request(http()).post('/public/claim/redeem').send({ token, password });

    it('hands the link only to the payer, sets the password once, and the link dies', async () => {
      const lead = await createLead({ payment: { payerSecret: SECRET } });
      const res = await issue(lead.referenceCode, PHONE4, SECRET);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready'); // the request itself triggered the provisioning it was waiting for
      expect(typeof res.body.token).toBe('string');
      expect(Date.parse(res.body.expiresAt as string) - Date.now()).toBeGreaterThan(71 * 3_600_000);

      // Only a hash is stored.
      const rows = await prisma.credentialToken.findMany({ where: { registrationId: lead.id } });
      expect(rows).toHaveLength(1);
      expect(rows[0]?.tokenHash).toBe(sha(res.body.token as string));
      expect(JSON.stringify(rows)).not.toContain(res.body.token as string);

      // A short password is refused and does not burn the link.
      expect((await redeem(res.body.token as string, 'short')).status).toBe(400);

      const pw = 'My-Own-Password-9!';
      const ok = await redeem(res.body.token as string, pw);
      expect(ok.status).toBe(200);
      expect(ok.body).toMatchObject({ email: lead.email, businessName: lead.restaurantName });
      expect(JSON.stringify(ok.body)).not.toContain(pw);

      const signedIn = await login(lead.email, pw);
      expect(signedIn.status).toBe(200);
      expect(signedIn.body.mustChangePassword ?? false).toBe(false);

      // Replay: the same link never works twice.
      expect((await redeem(res.body.token as string, 'Another-Password-1!')).status).toBe(404);
      // And once the owner has signed in, the payer can no longer fetch a link for the live account.
      await prisma.user.updateMany({ where: { email: lead.email }, data: { lastLoginAt: new Date() } });
      expect((await issue(lead.referenceCode, PHONE4, SECRET)).status).toBe(404);
    });

    it('answers "pending" before the payment is complete, and the identical 404 for every wrong proof', async () => {
      const unpaid = await createLead({ payment: { status: 'CREATED', paidAmountPaise: null, payerSecret: SECRET } });
      const pending = await issue(unpaid.referenceCode, PHONE4, SECRET);
      expect(pending.status).toBe(200);
      expect(pending.body).toEqual({ status: 'pending' });
      expect(await businessOf(unpaid.id)).toBeNull();

      const paid = await createLead({ payment: { payerSecret: SECRET } });
      const wrong = [
        await issue(paid.referenceCode, PHONE4, 'a-different-secret-0123456789abcdef'),
        await issue(paid.referenceCode, '0000', SECRET),
        await issue('NX-ZZZZZZ', PHONE4, SECRET),
      ];
      for (const r of wrong) expect(r.status).toBe(404);
      expect(new Set(wrong.map((r) => JSON.stringify(r.body.error ?? r.body))).size).toBe(1);
      // Nothing was created or leaked by the failed attempts.
      expect(await businessOf(paid.id)).toBeNull();
    });

    it('a payment without a secret (staff link) can never release a link to the public page', async () => {
      const lead = await createLead({ payment: { source: 'STAFF' } });
      expect((await issue(lead.referenceCode, PHONE4, SECRET)).status).toBe(404);
    });

    it('stops answering for a code after five wrong guesses, even with the right secret', async () => {
      const lead = await createLead({ payment: { payerSecret: SECRET } });
      for (let i = 0; i < 5; i++) expect((await issue(lead.referenceCode, PHONE4, `wrong-secret-number-${i}-0123456789`)).status).toBe(404);
      expect((await issue(lead.referenceCode, PHONE4, SECRET)).status).toBe(404);
    });

    it('the payer secret alone is not enough: the last 4 digits of the registered mobile must match, and email is not accepted', async () => {
      const lead = await createLead({ payment: { payerSecret: SECRET } });
      expect((await issue(lead.referenceCode, '0000', SECRET)).status).toBe(404);
      expect(await businessOf(lead.id)).toBeNull();
      const withEmail = await request(http()).post('/public/claim/issue').send({ referenceCode: lead.referenceCode, email: lead.email, payerSecret: SECRET });
      expect(withEmail.status).toBe(400);
      expect((await request(http()).post('/public/claim/issue').send({ referenceCode: lead.referenceCode, phoneLast4: '152', payerSecret: SECRET })).status).toBe(400);
      expect((await issue(lead.referenceCode, PHONE4, SECRET)).body.status).toBe('ready');
    });

    it('answers "manual" (not "pending") when money arrived but a person must finish it: typed amount, wrong amount, failed job', async () => {
      const typed = await createLead({ payment: { payerSecret: SECRET, planKey: null } });
      expect((await issue(typed.referenceCode, PHONE4, SECRET)).body).toEqual({ status: 'manual' });
      const mismatch = await createLead({ payment: { payerSecret: SECRET, paidAmountPaise: 100 } });
      expect((await issue(mismatch.referenceCode, PHONE4, SECRET)).body).toEqual({ status: 'manual' });
      expect(await businessOf(typed.id)).toBeNull();
      expect(await businessOf(mismatch.id)).toBeNull();

      // A job that failed for a clear reason (the owner's email already has an account elsewhere) is manual too.
      const taken = await createLead({ payment: { payerSecret: SECRET } });
      const other = await createLead({ payment: { payerSecret: SECRET } });
      await auto.autoProvision(other.id);
      await prisma.registrationRequest.update({ where: { id: taken.id }, data: { email: other.email } });
      const res = await issue(taken.referenceCode, PHONE4, SECRET);
      expect(res.body).toEqual({ status: 'manual' });
    });

    it('wrong guesses are counted per code and caller, so one bad caller does not use up the code for everyone', async () => {
      const lead = await createLead({ payment: { payerSecret: SECRET } });
      const svc = app.get(ClaimService);
      const body = { referenceCode: lead.referenceCode, phoneLast4: PHONE4 };
      for (let i = 0; i < 5; i++) await svc.issueForPayer({ ...body, payerSecret: `wrong-secret-number-${i}-0123456789` }, '203.0.113.9').catch(() => undefined);
      await expect(svc.issueForPayer({ ...body, payerSecret: SECRET }, '203.0.113.9')).rejects.toThrow();
      const fine = await svc.issueForPayer({ ...body, payerSecret: SECRET }, '198.51.100.7');
      expect(fine.status).toBe('ready');
    });

    it('an unused link stops working once the owner has signed in (a staff reset must not be undone by an old link)', async () => {
      const lead = await createLead({ payment: { payerSecret: SECRET } });
      const token = (await issue(lead.referenceCode, PHONE4, SECRET)).body.token as string;
      await prisma.user.updateMany({ where: { email: lead.email }, data: { lastLoginAt: new Date() } });
      expect((await redeem(token, 'Late-Password-1!')).status).toBe(404);
    });

    it('a newer link revokes the older one; an expired link is refused', async () => {
      const lead = await createLead({ payment: { payerSecret: SECRET } });
      const first = (await issue(lead.referenceCode, PHONE4, SECRET)).body.token as string;
      const second = await pPost(`/internal/registrations/${lead.id}/claim-link`);
      expect(second.status).toBe(200);
      expect(typeof second.body.token).toBe('string');
      expect((await redeem(first, 'Password-For-First-1!')).status).toBe(404);

      await prisma.credentialToken.updateMany({ where: { tokenHash: sha(second.body.token as string) }, data: { expiresAt: new Date(Date.now() - 1000) } });
      expect((await redeem(second.body.token as string, 'Password-For-Second-1!')).status).toBe(404);
    });

    it('two simultaneous redeems of the same link: exactly one wins', async () => {
      const lead = await createLead({ payment: { payerSecret: SECRET } });
      const token = (await issue(lead.referenceCode, PHONE4, SECRET)).body.token as string;
      const results = await Promise.all([redeem(token, 'Winner-Password-1!'), redeem(token, 'Loser-Password-2!')]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 404]);
    });

    it('staff cannot mint a link before the account exists, or after the owner signed in; it needs the permission', async () => {
      const early = await createLead();
      expect((await pPost(`/internal/registrations/${early.id}/claim-link`)).status).toBe(409);
      expect((await request(http()).post(`/internal/registrations/${early.id}/claim-link`)).status).toBe(401);

      await auto.autoProvision(early.id);
      expect((await pPost(`/internal/registrations/${early.id}/claim-link`)).status).toBe(200);
      await prisma.user.updateMany({ where: { email: early.email }, data: { lastLoginAt: new Date() } });
      expect((await pPost(`/internal/registrations/${early.id}/claim-link`)).status).toBe(409);
    });
  });

  describe('what the admin sees', () => {
    it('lists plan, cycle, paid-until, how they pay and the registration on the client', async () => {
      const lead = await createLead({ planKey: 'counter', cycle: 'monthly', payment: { amountPaise: 70_682, source: 'AUTOPAY' } });
      await auto.autoProvision(lead.id);
      const biz = (await businessOf(lead.id))!;
      const list = await pGet('/internal/commercial/clients?take=100');
      expect(list.status).toBe(200);
      const row = (list.body as { id: string }[]).find((c) => c.id === biz.id);
      expect(row).toMatchObject({ planKey: 'counter', billingCycle: 'monthly', billingSource: 'AUTOPAY', registrationId: lead.id });
      expect(typeof (row as unknown as { paidUntil: string }).paidUntil).toBe('string');
      const one = await pGet(`/internal/commercial/clients/${biz.id}`);
      expect(one.body).toMatchObject({ planKey: 'counter', billingSource: 'AUTOPAY' });
    });

    it('extending paid-until is idempotent and never moves backwards (an AutoPay debit retried)', async () => {
      const lead = await createLead({ planKey: 'counter', cycle: 'monthly', payment: { amountPaise: 70_682, source: 'AUTOPAY', paidAt: new Date('2026-12-01T10:00:00Z') } });
      await auto.autoProvision(lead.id);
      const before = (await businessOf(lead.id))!.paidUntil!;
      const next = new Date('2027-01-01T10:00:00Z');
      await billing.extendPaidUntil(lead.id, next, 'monthly');
      await billing.extendPaidUntil(lead.id, next, 'monthly');
      const after = (await businessOf(lead.id))!.paidUntil!;
      expect(after.getTime()).toBeGreaterThan(before.getTime());
      expect(after.toISOString()).toBe(paidUntilFor(next, 'monthly').toISOString());
      await billing.extendPaidUntil(lead.id, new Date('2026-12-05T10:00:00Z'), 'monthly'); // an older event
      expect((await businessOf(lead.id))!.paidUntil!.toISOString()).toBe(after.toISOString());
      await expect(billing.extendPaidUntil('00000000-0000-4000-8000-000000000000', next, 'monthly')).resolves.toBeUndefined();
    });

    it('flags a paid request that stayed manual (Many Doors / typed amount) and an amount mismatch for attention', async () => {
      const manual = await createLead({ planKey: 'many-doors', payment: { planKey: null } });
      const mismatch = await createLead({ payment: { status: 'AMOUNT_MISMATCH', paidAmountPaise: 5 } });
      const res = await pGet('/internal/provisioning/attention');
      expect(res.body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ registrationId: manual.id, reason: 'PAID_NOT_CREATED' }),
          expect.objectContaining({ registrationId: mismatch.id, reason: 'AMOUNT_MISMATCH' }),
        ]),
      );
      expect((await request(http()).get('/internal/provisioning/attention')).status).toBe(401);
    });

    it('flags money on a request marked spam or rejected, and on a converted request with no restaurant behind it', async () => {
      const spam = await createLead({ status: 'SPAM' });
      const converted = await createLead();
      await prisma.registrationRequest.update({ where: { id: converted.id }, data: { status: 'CONVERTED', businessId: null } });
      const res = await pGet('/internal/provisioning/attention');
      expect(res.body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ registrationId: spam.id, reason: 'PAID_ON_CLOSED_REQUEST' }),
          expect.objectContaining({ registrationId: converted.id, reason: 'PAID_ON_CLOSED_REQUEST' }),
        ]),
      );
    });
  });

  describe('paidUntilFor', () => {
    it('adds a month or a year, clamped to the end of a shorter month', () => {
      expect(paidUntilFor(new Date('2026-12-01T10:00:00Z'), 'yearly').toISOString()).toBe('2027-12-01T10:00:00.000Z');
      expect(paidUntilFor(new Date('2026-12-01T10:00:00Z'), 'monthly').toISOString()).toBe('2027-01-01T10:00:00.000Z');
      expect(paidUntilFor(new Date('2027-01-31T10:00:00Z'), 'monthly').toISOString()).toBe('2027-02-28T10:00:00.000Z');
    });
  });
});
