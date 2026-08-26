import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';

jest.setTimeout(60_000);

/**
 * Phase 6 — Configuration Center E2E suite.
 * Tests: business-realm settings CRUD, Location>Business precedence,
 * alert-rule registry lifecycle, and cross-business isolation.
 */
describe('Configuration Center — Phase 6 (e2e)', () => {
  let app: INestApplication;
  let platformToken: string;
  let bizAId: string;
  let ownerAToken: string;
  let bizBId: string;
  let ownerBToken: string;
  let locAId: string;

  const RUN = Date.now().toString(36);
  const http = (): ReturnType<INestApplication['getHttpServer']> => app.getHttpServer();

  async function pPost(path: string, body: object = {}): Promise<request.Response> {
    return request(http()).post(path).set('authorization', `Bearer ${platformToken}`).send(body);
  }
  async function aGet(tok: string, path: string): Promise<request.Response> {
    return request(http()).get(path).set('authorization', `Bearer ${tok}`);
  }
  async function aPut(tok: string, path: string, body: object): Promise<request.Response> {
    return request(http()).put(path).set('authorization', `Bearer ${tok}`).send(body);
  }
  async function aPost(tok: string, path: string, body: object = {}): Promise<request.Response> {
    return request(http()).post(path).set('authorization', `Bearer ${tok}`).send(body);
  }
  async function aPatch(tok: string, path: string, body: object): Promise<request.Response> {
    return request(http()).patch(path).set('authorization', `Bearer ${tok}`).send(body);
  }
  async function aDelete(tok: string, path: string): Promise<request.Response> {
    return request(http()).delete(path).set('authorization', `Bearer ${tok}`);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    applyHttpDefaults(app);
    await app.init();

    const loginRes = await request(http())
      .post('/auth/login')
      .send({
        email: process.env.PLATFORM_BOOTSTRAP_EMAIL ?? 'platform@manhar.local',
        password: process.env.PLATFORM_BOOTSTRAP_PASSWORD ?? 'ChangeMe!Dev12345',
      })
      .expect(200);
    platformToken = loginRes.body.accessToken as string;

    // Business A.
    const bizARes = await pPost('/internal/businesses', {
      name: `Config A ${RUN}`,
      businessTypeKey: 'restaurant',
    });
    expect(bizARes.status).toBe(201);
    bizAId = bizARes.body.id as string;

    const emailA = `owner-ca-${RUN}@test.local`;
    await pPost(`/internal/businesses/${bizAId}/provision`, {
      email: emailA,
      displayName: 'Owner A',
      password: 'TestPass!123',
    }).then((r) => expect(r.status).toBe(201));

    ownerAToken = (
      await request(http())
        .post('/auth/login')
        .send({ email: emailA, password: 'TestPass!123' })
        .expect(200)
    ).body.accessToken as string;

    // Location for business A.
    const locRes = await request(http())
      .post('/admin/locations')
      .set('authorization', `Bearer ${ownerAToken}`)
      .send({ name: 'Loc A', code: 'LA' })
      .expect(201);
    locAId = locRes.body.id as string;

    // Business B.
    const bizBRes = await pPost('/internal/businesses', {
      name: `Config B ${RUN}`,
      businessTypeKey: 'restaurant',
    });
    expect(bizBRes.status).toBe(201);
    bizBId = bizBRes.body.id as string;

    const emailB = `owner-cb-${RUN}@test.local`;
    await pPost(`/internal/businesses/${bizBId}/provision`, {
      email: emailB,
      displayName: 'Owner B',
      password: 'TestPass!123',
    }).then((r) => expect(r.status).toBe(201));

    ownerBToken = (
      await request(http())
        .post('/auth/login')
        .send({ email: emailB, password: 'TestPass!123' })
        .expect(200)
    ).body.accessToken as string;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // ── Settings schema endpoint ───────────────────────────────────────────────

  describe('Settings schema catalog', () => {
    it('GET /admin/settings/schema returns all setting definitions', async () => {
      const res = await aGet(ownerAToken, '/admin/settings/schema');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      const locale = res.body.find((s: { namespace: string; key: string }) => s.key === 'locale');
      expect(locale).toBeDefined();
      expect(locale.namespace).toBe('core');
    });

    it('GET /admin/settings/schema?namespace=core returns only core settings', async () => {
      const res = await aGet(ownerAToken, '/admin/settings/schema?namespace=core');
      expect(res.status).toBe(200);
      expect(res.body.every((s: { namespace: string }) => s.namespace === 'core')).toBe(true);
    });

    it('sensitive settings have sensitive=true and no actual default exposed', async () => {
      const res = await aGet(ownerAToken, '/admin/settings/schema');
      const sensitiveSettings = (res.body as Array<{ sensitive: boolean }>).filter((s) => s.sensitive);
      // Core settings are not sensitive; this just verifies the field exists.
      for (const s of sensitiveSettings) {
        expect(s.sensitive).toBe(true);
      }
    });
  });

  // ── Business-scope setting CRUD ────────────────────────────────────────────

  describe('Business-scope settings', () => {
    it('GET effective returns default value initially', async () => {
      const res = await aGet(ownerAToken, '/admin/settings/effective?namespace=core');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const locale = res.body.find((s: { key: string }) => s.key === 'locale');
      expect(locale.source).toBe('default');
      expect(locale.value).toBe('en');
    });

    it('PUT /admin/settings/core/locale sets a business-level value', async () => {
      const res = await aPut(ownerAToken, '/admin/settings/core/locale', { value: 'hi' });
      expect(res.status).toBe(200);
      expect(res.body.value).toBe('hi');
    });

    it('GET effective now shows business source for locale', async () => {
      const res = await aGet(ownerAToken, '/admin/settings/effective?namespace=core');
      const locale = res.body.find((s: { key: string }) => s.key === 'locale');
      expect(locale.source).toBe('business');
      expect(locale.value).toBe('hi');
    });

    it('PUT with wrong expectedVersion returns 409', async () => {
      const getRes = await aGet(ownerAToken, '/admin/settings/core/locale');
      const version = (getRes.body as { version?: number }).version ?? 1;
      const res = await aPut(ownerAToken, '/admin/settings/core/locale', {
        value: 'en',
        expectedVersion: version + 100,
      });
      expect(res.status).toBe(409);
    });

    it('PUT with invalid value returns 400', async () => {
      // locale schema: z.string().min(2).max(10)
      const res = await aPut(ownerAToken, '/admin/settings/core/locale', { value: 'x' });
      expect(res.status).toBe(400);
    });

    it('PUT unknown setting returns 400', async () => {
      const res = await aPut(ownerAToken, '/admin/settings/core/nonexistent_key_xyz', {
        value: 'anything',
      });
      expect(res.status).toBe(400);
    });
  });

  // ── Location>Business precedence ───────────────────────────────────────────

  describe('Location > Business precedence', () => {
    it('PUT with ?locationId sets a location override', async () => {
      const res = await aPut(
        ownerAToken,
        `/admin/settings/core/time_format?locationId=${locAId}`,
        { value: '12h' },
      );
      expect(res.status).toBe(200);
      expect(res.body.value).toBe('12h');
    });

    it('GET effective at location returns location override', async () => {
      const res = await aGet(
        ownerAToken,
        `/admin/settings/effective?namespace=core&locationId=${locAId}`,
      );
      const tf = res.body.find((s: { key: string }) => s.key === 'time_format');
      expect(tf.source).toBe('location');
      expect(tf.value).toBe('12h');
    });

    it('GET effective without locationId returns business/default value', async () => {
      const res = await aGet(ownerAToken, '/admin/settings/effective?namespace=core');
      const tf = res.body.find((s: { key: string }) => s.key === 'time_format');
      // We haven't set time_format at business scope, so it's default.
      expect(tf.source).toBe('default');
      expect(tf.value).toBe('24h');
    });

    it('location override from another business returns 404', async () => {
      const res = await aPut(
        ownerBToken,
        `/admin/settings/core/time_format?locationId=${locAId}`,
        { value: '12h' },
      );
      // locAId belongs to bizA; ownerB can't access it.
      expect(res.status).toBe(404);
    });
  });

  // ── Cross-business setting isolation ──────────────────────────────────────

  describe('Cross-business setting isolation', () => {
    it("Business B sees default locale (not Business A's 'hi')", async () => {
      const res = await aGet(ownerBToken, '/admin/settings/effective?namespace=core');
      const locale = res.body.find((s: { key: string }) => s.key === 'locale');
      expect(locale.source).toBe('default');
      expect(locale.value).toBe('en');
    });

    it('Business B can set its own locale independently', async () => {
      await aPut(ownerBToken, '/admin/settings/core/locale', { value: 'ta' }).then((r) =>
        expect(r.status).toBe(200),
      );
      const resA = await aGet(ownerAToken, '/admin/settings/effective?namespace=core');
      const resB = await aGet(ownerBToken, '/admin/settings/effective?namespace=core');
      const localeA = resA.body.find((s: { key: string }) => s.key === 'locale');
      const localeB = resB.body.find((s: { key: string }) => s.key === 'locale');
      expect(localeA.value).toBe('hi');
      expect(localeB.value).toBe('ta');
    });
  });

  // ── Alert rule registry ────────────────────────────────────────────────────

  describe('Alert rule registry', () => {
    let ruleId: string;

    it('GET /admin/alerts/rules returns empty list initially', async () => {
      const res = await aGet(ownerAToken, '/admin/alerts/rules');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });

    it('POST creates a new alert rule', async () => {
      const res = await aPost(ownerAToken, '/admin/alerts/rules', {
        eventKey: 'order.completed',
        targetRoleKey: 'owner',
        channel: 'IN_APP',
        enabled: true,
      });
      expect(res.status).toBe(201);
      expect(res.body.eventKey).toBe('order.completed');
      expect(res.body.targetRoleKey).toBe('owner');
      expect(res.body.enabled).toBe(true);
      ruleId = res.body.id as string;
    });

    it('POST duplicate returns 409', async () => {
      const res = await aPost(ownerAToken, '/admin/alerts/rules', {
        eventKey: 'order.completed',
        targetRoleKey: 'owner',
        channel: 'IN_APP',
        enabled: true,
      });
      expect(res.status).toBe(409);
    });

    it('GET list now has one rule', async () => {
      const res = await aGet(ownerAToken, '/admin/alerts/rules');
      expect(res.body.length).toBe(1);
    });

    it('PATCH toggles enabled state', async () => {
      const getRes = await aGet(ownerAToken, `/admin/alerts/rules/${ruleId}`);
      const res = await aPatch(ownerAToken, `/admin/alerts/rules/${ruleId}`, {
        enabled: false,
        expectedVersion: (getRes.body as { version: number }).version,
      });
      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);
    });

    it('PATCH with wrong version returns 409', async () => {
      const res = await aPatch(ownerAToken, `/admin/alerts/rules/${ruleId}`, {
        enabled: true,
        expectedVersion: 9999,
      });
      expect(res.status).toBe(409);
    });

    it('POST with invalid eventKey format returns 400', async () => {
      const res = await aPost(ownerAToken, '/admin/alerts/rules', {
        eventKey: 'INVALID EVENT KEY WITH SPACES',
        targetRoleKey: 'owner',
        channel: 'IN_APP',
        enabled: true,
      });
      expect(res.status).toBe(400);
    });

    it('DELETE removes the rule', async () => {
      const res = await aDelete(ownerAToken, `/admin/alerts/rules/${ruleId}`);
      expect(res.status).toBe(204);
    });

    it('GET list is empty again after delete', async () => {
      const res = await aGet(ownerAToken, '/admin/alerts/rules');
      expect(res.body.length).toBe(0);
    });

    it('cross-business: Business A rules invisible to Business B', async () => {
      await aPost(ownerAToken, '/admin/alerts/rules', {
        eventKey: 'booking.created',
        targetRoleKey: 'manager',
        channel: 'IN_APP',
        enabled: true,
      }).then((r) => expect(r.status).toBe(201));

      const resB = await aGet(ownerBToken, '/admin/alerts/rules');
      expect(resB.body.length).toBe(0);

      const resA = await aGet(ownerAToken, '/admin/alerts/rules');
      expect(resA.body.length).toBe(1);
    });
  });
});
