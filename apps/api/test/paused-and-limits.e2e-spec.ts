import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';

const PW = 'Passw0rd!23';
const RUN = Date.now().toString(36);
const PAUSED = 'This account is paused. Please contact Manhar support.';

/**
 * A paused client (business suspended, or commercially SUSPENDED / CHURNED) is locked out immediately, platform staff
 * are never affected, and oversized request bodies answer 413 instead of a 500.
 */
describe('Paused clients and request limits (e2e)', () => {
  let app: INestApplication;
  const http = () => app.getHttpServer();
  let platformToken: string;

  const login = (email: string, password: string) => request(http()).post('/auth/login').send({ email, password });
  const as = (token: string) => ({
    get: (url: string) => request(http()).get(url).set('authorization', `Bearer ${token}`),
    patch: (url: string, body: object) => request(http()).patch(url).set('authorization', `Bearer ${token}`).send(body),
    post: (url: string, body: object) => request(http()).post(url).set('authorization', `Bearer ${token}`).send(body),
  });

  async function newClient(name: string): Promise<{ businessId: string; ownerEmail: string; ownerToken: string }> {
    const biz = await as(platformToken).post('/internal/businesses', { name: `${name} ${RUN}`, businessTypeKey: 'restaurant' });
    expect(biz.status).toBe(201);
    const businessId = biz.body.id as string;
    const ownerEmail = `${name.toLowerCase().replace(/\W/g, '')}.${RUN}@test.local`;
    const user = await as(platformToken).post(`/internal/businesses/${businessId}/users`, {
      email: ownerEmail,
      password: PW,
      displayName: name,
      roleKeys: ['owner'],
    });
    expect(user.status).toBe(201);
    const res = await login(ownerEmail, PW);
    expect(res.status).toBe(200);
    return { businessId, ownerEmail, ownerToken: res.body.accessToken as string };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    applyHttpDefaults(app);
    await app.init();
    const res = await login(process.env.PLATFORM_BOOTSTRAP_EMAIL ?? 'platform@manhar.local', process.env.PLATFORM_BOOTSTRAP_PASSWORD ?? 'ChangeMe!Dev12345');
    expect(res.status).toBe(200);
    platformToken = res.body.accessToken as string;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  for (const commercialStatus of ['SUSPENDED', 'CHURNED'] as const) {
    it(`commercialStatus ${commercialStatus}: the live token and a new login are refused, platform staff are not, reactivating restores access`, async () => {
      const c = await newClient(`Pause ${commercialStatus}`);
      expect((await as(c.ownerToken).get('/admin/roles')).status).toBe(200);

      const set = await as(platformToken).patch(`/internal/commercial/clients/${c.businessId}`, { commercialStatus });
      expect(set.status).toBe(200);

      const live = await as(c.ownerToken).get('/admin/roles');
      expect(live.status).toBe(403);
      expect(live.body.error.message).toBe(PAUSED);
      expect(live.body.error.details).toMatchObject({ reason: 'ACCOUNT_PAUSED' });

      const again = await login(c.ownerEmail, PW);
      expect(again.status).toBe(403);
      expect(again.body.error.message).toBe(PAUSED);

      // Platform staff have no business, so nothing pauses them (and they can still read the paused client).
      expect((await as(platformToken).get(`/internal/commercial/clients/${c.businessId}`)).status).toBe(200);

      await as(platformToken).patch(`/internal/commercial/clients/${c.businessId}`, { commercialStatus: 'ACTIVE' }).expect(200);
      expect((await as(c.ownerToken).get('/admin/roles')).status).toBe(200);
      expect((await login(c.ownerEmail, PW)).status).toBe(200);
    });
  }

  it('Business.status SUSPENDED: refused at once, sessions are ended, and ACTIVE brings the client back (new login needed)', async () => {
    const c = await newClient('Pause Business');
    const set = await as(platformToken).patch(`/internal/businesses/${c.businessId}`, { status: 'SUSPENDED' });
    expect(set.status).toBe(200);

    const live = await as(c.ownerToken).get('/admin/roles');
    expect([401, 403]).toContain(live.status); // session revoked, token version bumped
    const attempt = await login(c.ownerEmail, PW);
    expect(attempt.status).toBe(403);
    expect(attempt.body.error.message).toBe(PAUSED);

    await as(platformToken).patch(`/internal/businesses/${c.businessId}`, { status: 'ACTIVE' }).expect(200);
    expect((await login(c.ownerEmail, PW)).status).toBe(200);
  });

  it('a wrong password on a paused client still gets the generic message (no disclosure)', async () => {
    const c = await newClient('Pause Wrong');
    await as(platformToken).patch(`/internal/commercial/clients/${c.businessId}`, { commercialStatus: 'SUSPENDED' }).expect(200);
    const res = await login(c.ownerEmail, 'not-the-password-1');
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain('paused');
  });

  describe('oversized bodies', () => {
    it('a 3 MB JSON body on a public endpoint answers 413 with a generic body, never a 500 or a stack', async () => {
      const big = JSON.stringify({ message: 'x'.repeat(3 * 1024 * 1024) });
      const res = await request(http()).post('/public/registrations').set('content-type', 'application/json').send(big);
      expect(res.status).toBe(413);
      expect(res.body.error).toEqual({ code: 'PAYLOAD_TOO_LARGE', message: 'The request is too large.' });
      expect(JSON.stringify(res.body)).not.toMatch(/PayloadTooLarge|stack|at \w+/);
    });

    it('unparseable JSON answers 400, not 500', async () => {
      const res = await request(http()).post('/public/registrations').set('content-type', 'application/json').send('{"a":');
      expect(res.status).toBe(400);
    });
  });
});
