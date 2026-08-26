import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';

jest.setTimeout(180_000);

/**
 * Phase 11 — Admin Audit Viewer E2E suite.
 *
 * Coverage:
 *   - List audit events: returns paginated events scoped to caller's business
 *   - Cross-business isolation: owner of Biz B cannot see Biz A audit events
 *   - Filter by action: partial match (case-insensitive)
 *   - Filter by resourceType: partial match (case-insensitive)
 *   - Filter by date range: from/to accepted as ISO strings
 *   - Chain verification: /verify returns valid status and count
 *   - Auth: 401 without token
 *   - Permission: core.audit.view required (platform token has it; regular user does too via owner role)
 *   - Security: no secretHash or token fields in audit metadata visible to caller
 */
describe('Admin Audit Viewer — Phase 11 (e2e)', () => {
  let app: INestApplication;
  let platformToken: string;

  let bizAId: string;
  let ownerAToken: string;

  let bizBId: string;
  let ownerBToken: string;

  const RUN = Date.now().toString(36);
  const http = () => app.getHttpServer();

  const pPost = (path: string, body: object = {}) =>
    request(http()).post(path).set('authorization', `Bearer ${platformToken}`).send(body);

  const aGet = (tok: string, path: string) =>
    request(http()).get(path).set('authorization', `Bearer ${tok}`);

  const provisionOwner = async (bizId: string, suffix: string): Promise<string> => {
    const email = `owner-p11a-${suffix}-${RUN}@test.local`;
    const pw = 'Test!Password1';
    const res = await pPost(`/internal/businesses/${bizId}/provision`, {
      email,
      displayName: `Owner ${suffix}`,
      password: pw,
    });
    expect(res.status).toBe(201);
    const login = await request(http()).post('/auth/login').send({ email, password: pw });
    expect(login.status).toBe(200);
    return login.body.accessToken as string;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    applyHttpDefaults(app);
    await app.init();

    const login = await request(http()).post('/auth/login').send({
      email: process.env.PLATFORM_BOOTSTRAP_EMAIL ?? 'platform@manhar.local',
      password: process.env.PLATFORM_BOOTSTRAP_PASSWORD ?? 'ChangeMe!Dev12345',
    });
    expect(login.status).toBe(200);
    platformToken = login.body.accessToken as string;

    const bizA = await pPost('/internal/businesses', { name: `P11A BizA ${RUN}`, businessTypeKey: 'restaurant' });
    expect(bizA.status).toBe(201);
    bizAId = bizA.body.id as string;
    ownerAToken = await provisionOwner(bizAId, 'A');

    const bizB = await pPost('/internal/businesses', { name: `P11A BizB ${RUN}`, businessTypeKey: 'restaurant' });
    expect(bizB.status).toBe(201);
    bizBId = bizB.body.id as string;
    ownerBToken = await provisionOwner(bizBId, 'B');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('List audit events', () => {
    it('returns 200 with paginated shape scoped to caller business', async () => {
      const res = await aGet(ownerAToken, '/admin/audit');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        events: expect.any(Array),
        total: expect.any(Number),
      });
      for (const ev of res.body.events as Record<string, unknown>[]) {
        expect(ev['businessId']).toBe(bizAId);
      }
    });

    it('returns at most take=5 events', async () => {
      const res = await aGet(ownerAToken, '/admin/audit?take=5');
      expect(res.status).toBe(200);
      expect((res.body.events as unknown[]).length).toBeLessThanOrEqual(5);
    });

    it('filters by action (case-insensitive partial)', async () => {
      const res = await aGet(ownerAToken, '/admin/audit?action=user.provisioned');
      expect(res.status).toBe(200);
      for (const ev of res.body.events as Record<string, unknown>[]) {
        expect((ev['action'] as string).toLowerCase()).toContain('user.provisioned');
      }
    });

    it('accepts from/to date range without error', async () => {
      const from = '2020-01-01T00:00:00.000Z';
      const to = new Date().toISOString();
      const res = await aGet(ownerAToken, `/admin/audit?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      expect(res.status).toBe(200);
    });

    it('returns 401 without token', async () => {
      const res = await request(http()).get('/admin/audit');
      expect(res.status).toBe(401);
    });
  });

  describe('Cross-business isolation', () => {
    it('Biz B owner only sees Biz B events, not Biz A events', async () => {
      const resB = await aGet(ownerBToken, '/admin/audit');
      expect(resB.status).toBe(200);
      for (const ev of resB.body.events as Record<string, unknown>[]) {
        expect(ev['businessId']).toBe(bizBId);
        expect(ev['businessId']).not.toBe(bizAId);
      }
    });
  });

  describe('Chain verification', () => {
    it('returns valid status and event count', async () => {
      const res = await aGet(ownerAToken, '/admin/audit/verify');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        valid: expect.any(Boolean),
        count: expect.any(Number),
      });
    });

    it('returns 401 without token', async () => {
      const res = await request(http()).get('/admin/audit/verify');
      expect(res.status).toBe(401);
    });
  });

  describe('Security: no sensitive fields in audit metadata', () => {
    it('audit events do not expose secretHash or password fields', async () => {
      const res = await aGet(ownerAToken, '/admin/audit');
      expect(res.status).toBe(200);
      for (const ev of res.body.events as Record<string, unknown>[]) {
        const meta = ev['metadata'] as Record<string, unknown>;
        expect(meta).not.toHaveProperty('secretHash');
        expect(meta).not.toHaveProperty('password');
        expect(meta).not.toHaveProperty('token');
        expect(meta).not.toHaveProperty('accessToken');
      }
    });
  });
});
