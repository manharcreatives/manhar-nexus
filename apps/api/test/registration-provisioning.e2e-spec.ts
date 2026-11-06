import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';
import { PrismaService } from '../src/prisma/prisma.service';
import { CONSENT_VERSIONS } from '../src/registration/registration.dto';
import { generateReferenceCode } from '../src/registration/registration.util';

/**
 * "Create the restaurant account" as one resumable server-side job: the real stack and database, no stubs.
 */
describe('Registration provisioning (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let platformToken: string;
  let businessToken: string;

  const RUN = Date.now().toString(36);
  const http = () => app.getHttpServer();
  let seq = 0;

  const pPost = (path: string, b: object) => request(http()).post(path).set('authorization', `Bearer ${platformToken}`).send(b);
  const pGet = (path: string) => request(http()).get(path).set('authorization', `Bearer ${platformToken}`);

  async function createLead(over: { status?: 'NEW' | 'SPAM' | 'QUALIFIED'; email?: string; paid?: boolean } = {}) {
    const lead = await prisma.registrationRequest.create({
      data: {
        referenceCode: generateReferenceCode(),
        status: over.status ?? 'NEW',
        restaurantName: `Prov Cafe ${RUN}-${++seq}`,
        contactName: 'Asha Patel',
        email: over.email ?? `prov${seq}-${RUN}@example.test`,
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
    if (over.paid !== false) {
      await prisma.registrationPayment.create({
        data: {
          registrationId: lead.id,
          linkId: `${lead.referenceCode}-${RUN}${seq}`,
          linkUrl: 'https://payments-test.cashfree.com/links/e2e',
          amountPaise: 100,
          purpose: 'e2e',
          status: 'PAID',
          paidAmountPaise: 100,
          createdBy: 'e2e',
        },
      });
    }
    return lead;
  }

  const url = (id: string) => `/internal/registrations/${id}/provision`;
  const login = (email: string, password: string) => request(http()).post('/auth/login').send({ email, password });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    applyHttpDefaults(app);
    await app.init();
    prisma = app.get(PrismaService);

    const res = await login('platform@manhar.local', 'ChangeMe!Dev12345');
    expect(res.status).toBe(200);
    platformToken = res.body.accessToken as string;

    const biz = await pPost('/internal/businesses', { name: `ProvTestBiz ${RUN}`, businessTypeKey: 'restaurant' });
    const email = `prov-owner-${RUN}@test.local`;
    const pw = 'TestProv!Pass123';
    expect((await pPost(`/internal/businesses/${biz.body.id as string}/provision`, { email, displayName: 'Prov Owner', password: pw })).status).toBe(201);
    businessToken = (await login(email, pw)).body.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it('is platform-only', async () => {
    const lead = await createLead();
    expect((await request(http()).post(url(lead.id)).send({})).status).toBe(401);
    expect((await request(http()).post(url(lead.id)).set('authorization', `Bearer ${businessToken}`).send({})).status).toBe(403);
  });

  it('refuses an unpaid request unless staff confirm a free pilot, and creates nothing', async () => {
    const lead = await createLead({ paid: false });
    const res = await pPost(url(lead.id), {});
    expect(res.status).toBe(409);
    expect(res.body.error.details.needsPayment).toBe(true);
    expect(await prisma.registrationProvisioning.count({ where: { registrationId: lead.id } })).toBe(0);
    expect((await pGet(url(lead.id))).status).toBe(404);
  });

  it('refuses spam and unknown fields', async () => {
    const spam = await createLead({ status: 'SPAM' });
    expect((await pPost(url(spam.id), {})).status).toBe(400);
    const lead = await createLead();
    expect((await pPost(url(lead.id), { password: 'my-own-password' })).status).toBe(400);
    expect((await pPost(url(lead.id), { ownerEmail: 'nope' })).status).toBe(400);
  });

  it('creates business, location, owner, modules and onboarding in one call, converts the request last, and returns the password once', async () => {
    const lead = await createLead();
    const res = await pPost(url(lead.id), {});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('DONE');
    expect((res.body.steps as { state: string }[]).every((s) => s.state === 'done')).toBe(true);
    expect((res.body.steps as { id: string }[]).map((s) => s.id)).toEqual([
      'business', 'location', 'owner', 'module:restaurant', 'module:catalog', 'module:checkout', 'module:reports', 'module:costs', 'commercial', 'onboarding', 'finalize',
    ]);
    const { email, password } = res.body.credentials as { email: string; password: string };
    expect(email).toBe(lead.email);
    expect(password.length).toBeGreaterThanOrEqual(12);

    const businessId = res.body.businessId as string;
    const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
    expect(business.name).toBe(lead.restaurantName);
    expect(business.commercialStatus).toBe('ACTIVE');
    expect(await prisma.location.count({ where: { businessId } })).toBe(1);
    const activations = await prisma.moduleActivation.findMany({ where: { businessId } });
    expect(activations.map((a) => a.moduleKey).sort()).toEqual(['catalog', 'checkout', 'costs', 'reports', 'restaurant']);
    expect(activations.every((a) => a.status === 'ACTIVE')).toBe(true);
    expect(await prisma.onboardingProgress.count({ where: { businessId } })).toBe(1);
    const owner = await prisma.user.findFirstOrThrow({ where: { businessId } });
    expect(owner.mustChangePassword).toBe(true);
    expect(owner.passwordHash).not.toContain(password);
    const converted = await prisma.registrationRequest.findUniqueOrThrow({ where: { id: lead.id } });
    expect(converted).toMatchObject({ status: 'CONVERTED', businessId });

    // The owner can sign in with exactly what was returned.
    expect((await login(email, password)).status).toBe(200);

    // Nothing stores or re-shows the password: status and a repeat both answer DONE without credentials.
    const status = await pGet(url(lead.id));
    expect(status.body.status).toBe('DONE');
    expect(JSON.stringify(status.body)).not.toContain(password);
    const job = await prisma.registrationProvisioning.findUniqueOrThrow({ where: { registrationId: lead.id } });
    expect(JSON.stringify(job)).not.toContain(password);
    const again = await pPost(url(lead.id), {});
    expect(again.status).toBe(200);
    expect(again.body.credentials).toBeUndefined();
    expect(await prisma.business.count({ where: { name: lead.restaurantName } })).toBe(1);
  });

  it('a failed step stops, says which, and a retry resumes there without duplicating anything', async () => {
    // The owner email already has an account somewhere: the owner step fails after business and location exist.
    const taken = await prisma.user.findFirstOrThrow({ where: { email: `prov-owner-${RUN}@test.local` } });
    const lead = await createLead();
    const failed = await pPost(url(lead.id), { ownerEmail: taken.email });
    expect(failed.status).toBe(200);
    expect(failed.body).toMatchObject({ status: 'FAILED', failedStep: 'owner' });
    expect(failed.body.error).toContain('already has an account');
    expect(failed.body.credentials).toBeUndefined();
    const states = Object.fromEntries((failed.body.steps as { id: string; state: string }[]).map((s) => [s.id, s.state]));
    expect(states).toMatchObject({ business: 'done', location: 'done', owner: 'failed', 'module:restaurant': 'pending' });

    // Half done, and the request is NOT converted yet.
    const businessId = failed.body.businessId as string;
    expect(await prisma.location.count({ where: { businessId } })).toBe(1);
    expect((await prisma.registrationRequest.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe('NEW');

    // Fix the email and retry: same business, finishes.
    const ok = await pPost(url(lead.id), { ownerEmail: `fixed-${RUN}@example.test` });
    expect(ok.body.status).toBe('DONE');
    expect(ok.body.businessId).toBe(businessId);
    expect(ok.body.credentials.email).toBe(`fixed-${RUN}@example.test`);
    expect(await prisma.business.count({ where: { name: lead.restaurantName } })).toBe(1);
    expect(await prisma.location.count({ where: { businessId } })).toBe(1);
    expect(await prisma.moduleActivation.count({ where: { businessId } })).toBe(5);
    expect((await prisma.registrationRequest.findUniqueOrThrow({ where: { id: lead.id } })).businessId).toBe(businessId);
  });

  it('resumes after a crash that left the claim behind (stale lock), and refuses while another run is live', async () => {
    const lead = await createLead();
    const failed = await pPost(url(lead.id), { ownerEmail: `prov-owner-${RUN}@test.local` });
    expect(failed.body.status).toBe('FAILED');
    // Simulate a run that is live right now: a fresh lock blocks a second click.
    await prisma.registrationProvisioning.update({ where: { registrationId: lead.id }, data: { status: 'RUNNING', lockedAt: new Date() } });
    expect((await pPost(url(lead.id), { ownerEmail: `crash-${RUN}@example.test` })).status).toBe(409);
    // The same run, crashed two minutes ago: taken over.
    await prisma.registrationProvisioning.update({ where: { registrationId: lead.id }, data: { lockedAt: new Date(Date.now() - 5 * 60_000) } });
    const ok = await pPost(url(lead.id), { ownerEmail: `crash-${RUN}@example.test` });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('DONE');
  });

  it('two simultaneous clicks make one restaurant and hand out at most one password', async () => {
    const lead = await createLead();
    const [a, b] = await Promise.all([pPost(url(lead.id), {}), pPost(url(lead.id), {})]);
    expect([a.status, b.status].every((s) => s === 200 || s === 409)).toBe(true);
    expect([a, b].some((r) => r.status === 200 && r.body.credentials)).toBe(true);
    expect([a, b].filter((r) => r.body.credentials).length).toBe(1);
    expect(await prisma.business.count({ where: { name: lead.restaurantName } })).toBe(1);
  });

  it('a free pilot is created as a Trial, and a lost password can be re-issued until the owner signs in', async () => {
    const lead = await createLead({ paid: false });
    const res = await pPost(url(lead.id), { allowUnpaid: true, extraModules: [] });
    expect(res.body.status).toBe('DONE');
    expect((res.body.steps as { id: string }[]).some((s) => s.id === 'module:reports')).toBe(false);
    const businessId = res.body.businessId as string;
    expect((await prisma.business.findUniqueOrThrow({ where: { id: businessId } })).commercialStatus).toBe('TRIAL');

    const first = res.body.credentials as { email: string; password: string };
    const re = await pPost(url(lead.id), { reissuePassword: true });
    expect(re.status).toBe(200);
    const second = re.body.credentials as { email: string; password: string };
    expect(second.password).not.toBe(first.password);
    expect((await login(first.email, first.password)).status).toBe(401);
    expect((await login(second.email, second.password)).status).toBe(200);
    // Now the owner has signed in: no more silent re-issue.
    expect((await pPost(url(lead.id), { reissuePassword: true })).status).toBe(409);
  });
});
