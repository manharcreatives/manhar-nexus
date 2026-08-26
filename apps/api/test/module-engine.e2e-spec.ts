import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';
import { RequireModule } from '../src/modules/module-gating.guard';
import { Get, Controller } from '@nestjs/common';
import { RequirePermission } from '../src/iam/principal';

/**
 * A minimal controller wired with @RequireModule so the E2E test can actually
 * exercise the ModuleGatingGuard via a real HTTP request (not just unit-inspect
 * the guard's logic). The path prefix is unusual to avoid collisions.
 */
@Controller('_test_module_gate')
class TestGateController {
  @Get()
  @RequirePermission('core.modules.view') // any business owner has this via *
  @RequireModule('restaurant')
  ping() {
    return { ok: true };
  }
}

jest.setTimeout(60_000);

/**
 * Phase 5 — Module Engine E2E suite.
 * Tests: full lifecycle matrix, dependency enforcement, gating guard, isolation.
 */
describe('Module Engine — Phase 5 (e2e)', () => {
  let app: INestApplication;
  let platformToken: string;
  let bizId: string;
  let ownerToken: string;

  const RUN = Date.now().toString(36);
  const http = (): ReturnType<INestApplication['getHttpServer']> => app.getHttpServer();

  async function pPost(path: string, body: object = {}): Promise<request.Response> {
    return request(http()).post(path).set('authorization', `Bearer ${platformToken}`).send(body);
  }
  async function aPost(tok: string, path: string, body: object = {}): Promise<request.Response> {
    return request(http()).post(path).set('authorization', `Bearer ${tok}`).send(body);
  }
  async function aGet(tok: string, path: string): Promise<request.Response> {
    return request(http()).get(path).set('authorization', `Bearer ${tok}`);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      // TestGateController is added so the suite can fire real HTTP requests at
      // a @RequireModule-decorated route and verify that ModuleGatingGuard
      // actually blocks (403 MODULE_DISABLED) when the module is not ACTIVE.
      controllers: [TestGateController],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    applyHttpDefaults(app);
    await app.init();

    // Login as platform admin.
    const loginRes = await request(http())
      .post('/auth/login')
      .send({
        email: process.env.PLATFORM_BOOTSTRAP_EMAIL ?? 'platform@manhar.local',
        password: process.env.PLATFORM_BOOTSTRAP_PASSWORD ?? 'ChangeMe!Dev12345',
      })
      .expect(200);
    platformToken = loginRes.body.accessToken as string;

    // Create a business + provision an owner.
    const bizRes = await pPost('/internal/businesses', {
      name: `Mod Engine Co ${RUN}`,
      businessTypeKey: 'restaurant',
    });
    expect(bizRes.status).toBe(201);
    bizId = bizRes.body.id as string;

    const email = `owner-me-${RUN}@test.local`;
    await pPost(`/internal/businesses/${bizId}/provision`, {
      email,
      displayName: 'Owner',
      password: 'TestPass!123',
    }).then((r) => expect(r.status).toBe(201));

    const ownerLogin = await request(http())
      .post('/auth/login')
      .send({ email, password: 'TestPass!123' })
      .expect(200);
    ownerToken = ownerLogin.body.accessToken as string;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // ── Module catalog ─────────────────────────────────────────────────────────

  describe('Module catalog', () => {
    it('GET /admin/modules returns all modules with AVAILABLE status initially', async () => {
      const res = await aGet(ownerToken, '/admin/modules');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      // All should be AVAILABLE before any activation.
      expect(res.body.every((m: { status: string }) => m.status === 'AVAILABLE')).toBe(true);
      // Restaurant module should be present.
      expect(res.body.some((m: { key: string }) => m.key === 'restaurant')).toBe(true);
    });

    it('GET /admin/modules/:key returns a specific module', async () => {
      const res = await aGet(ownerToken, '/admin/modules/restaurant');
      expect(res.status).toBe(200);
      expect(res.body.key).toBe('restaurant');
      expect(res.body.status).toBe('AVAILABLE');
      expect(Array.isArray(res.body.setupSteps)).toBe(true);
    });

    it('GET /admin/modules/:key returns 404 for unknown module', async () => {
      const res = await aGet(ownerToken, '/admin/modules/totally-unknown-module');
      expect(res.status).toBe(404);
    });

    it('platform GET /internal/businesses/:id/modules returns the same catalog', async () => {
      const res = await request(http())
        .get(`/internal/businesses/${bizId}/modules`)
        .set('authorization', `Bearer ${platformToken}`);
      expect(res.status).toBe(200);
      expect(res.body.some((m: { key: string }) => m.key === 'restaurant')).toBe(true);
    });
  });

  // ── Lifecycle: AVAILABLE → PENDING_SETUP → ACTIVE ─────────────────────────

  describe('Module lifecycle (AVAILABLE → PENDING_SETUP → ACTIVE)', () => {
    it('activate restaurant moves it to PENDING_SETUP', async () => {
      const res = await aPost(ownerToken, '/admin/modules/restaurant/activate');
      expect(res.status).toBe(201);
      expect(res.body.key).toBe('restaurant');
      expect(res.body.status).toBe('PENDING_SETUP');
      expect(res.body.activatedAt).not.toBeNull();
    });

    it('activate again returns 409 CONFLICT', async () => {
      const res = await aPost(ownerToken, '/admin/modules/restaurant/activate');
      expect(res.status).toBe(409);
    });

    it('list shows restaurant as PENDING_SETUP', async () => {
      const res = await aGet(ownerToken, '/admin/modules');
      const restaurant = res.body.find((m: { key: string }) => m.key === 'restaurant');
      expect(restaurant.status).toBe('PENDING_SETUP');
    });

    it('complete-setup moves restaurant to ACTIVE', async () => {
      const res = await aPost(ownerToken, '/admin/modules/restaurant/complete-setup');
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.setupCompletedAt).not.toBeNull();
    });

    it('complete-setup on ACTIVE returns 400 (wrong status)', async () => {
      const res = await aPost(ownerToken, '/admin/modules/restaurant/complete-setup');
      expect(res.status).toBe(400);
    });
  });

  // ── Dependency enforcement ─────────────────────────────────────────────────

  describe('Dependency enforcement', () => {
    it('cannot activate catalog when restaurant is ACTIVE (catalog depends on restaurant — should succeed)', async () => {
      // catalog depends on restaurant. Restaurant is ACTIVE now.
      const res = await aPost(ownerToken, '/admin/modules/catalog/activate');
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PENDING_SETUP');
      await aPost(ownerToken, '/admin/modules/catalog/complete-setup').then((r) =>
        expect(r.status).toBe(201),
      );
    });

    it('cannot activate checkout before catalog is ACTIVE', async () => {
      // Checkout depends on catalog. But a DIFFERENT business has no catalog.
      const biz2Res = await pPost('/internal/businesses', {
        name: `Dep Test Co ${RUN}`,
        businessTypeKey: 'restaurant',
      });
      const biz2Id = biz2Res.body.id as string;
      const email2 = `owner-dep-${RUN}@test.local`;
      await pPost(`/internal/businesses/${biz2Id}/provision`, {
        email: email2,
        displayName: 'Owner 2',
        password: 'TestPass!123',
      }).then((r) => expect(r.status).toBe(201));
      const tok2 = (
        await request(http())
          .post('/auth/login')
          .send({ email: email2, password: 'TestPass!123' })
          .expect(200)
      ).body.accessToken as string;

      // Checkout depends on catalog which depends on restaurant — neither active.
      const res = await aPost(tok2, '/admin/modules/checkout/activate');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION');
    });

    it('cannot disable restaurant while catalog depends on it', async () => {
      // Both restaurant and catalog are ACTIVE for bizId.
      const res = await aPost(ownerToken, '/admin/modules/restaurant/disable');
      expect(res.status).toBe(400);
    });

    it('can disable catalog (no dependents active)', async () => {
      const res = await aPost(ownerToken, '/admin/modules/catalog/disable');
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('DISABLED');
    });

    it('can now disable restaurant (catalog is disabled)', async () => {
      const res = await aPost(ownerToken, '/admin/modules/restaurant/disable');
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('DISABLED');
    });
  });

  // ── Disable / Resume (DISABLE ≠ DELETE) ───────────────────────────────────

  describe('DISABLE ≠ DELETE: resume restores config', () => {
    let biz3Id: string;
    let tok3: string;

    beforeAll(async () => {
      const biz3Res = await pPost('/internal/businesses', {
        name: `Resume Co ${RUN}`,
        businessTypeKey: 'restaurant',
      });
      biz3Id = biz3Res.body.id as string;
      const email3 = `owner-resume-${RUN}@test.local`;
      await pPost(`/internal/businesses/${biz3Id}/provision`, {
        email: email3,
        displayName: 'Owner 3',
        password: 'TestPass!123',
      }).then((r) => expect(r.status).toBe(201));
      tok3 = (
        await request(http())
          .post('/auth/login')
          .send({ email: email3, password: 'TestPass!123' })
          .expect(200)
      ).body.accessToken as string;
    });

    it('activate → complete-setup → ACTIVE', async () => {
      await aPost(tok3, '/admin/modules/restaurant/activate').then((r) => expect(r.status).toBe(201));
      await aPost(tok3, '/admin/modules/restaurant/complete-setup').then((r) =>
        expect(r.status).toBe(201),
      );
    });

    it('disable → DISABLED (data preserved)', async () => {
      const res = await aPost(tok3, '/admin/modules/restaurant/disable');
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('DISABLED');
    });

    it('resume DISABLED → ACTIVE (setup already completed, so goes straight to ACTIVE)', async () => {
      const res = await aPost(tok3, '/admin/modules/restaurant/resume');
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ACTIVE');
      // setupCompletedAt is preserved.
      expect(res.body.setupCompletedAt).not.toBeNull();
    });

    it('disable on already-DISABLED returns 400', async () => {
      await aPost(tok3, '/admin/modules/restaurant/disable').then((r) => expect(r.status).toBe(201));
      const res = await aPost(tok3, '/admin/modules/restaurant/disable');
      expect(res.status).toBe(400);
    });

    it('resume on AVAILABLE returns 404 (no activation row)', async () => {
      const res = await aPost(tok3, '/admin/modules/reports/resume');
      expect(res.status).toBe(404);
    });
  });

  // ── Platform: Suspend / Unsuspend ─────────────────────────────────────────

  describe('Platform suspend / unsuspend', () => {
    let biz4Id: string;
    let tok4: string;

    beforeAll(async () => {
      const biz4Res = await pPost('/internal/businesses', {
        name: `Suspend Co ${RUN}`,
        businessTypeKey: 'restaurant',
      });
      biz4Id = biz4Res.body.id as string;
      const email4 = `owner-susp-${RUN}@test.local`;
      await pPost(`/internal/businesses/${biz4Id}/provision`, {
        email: email4,
        displayName: 'Owner 4',
        password: 'TestPass!123',
      }).then((r) => expect(r.status).toBe(201));
      tok4 = (
        await request(http())
          .post('/auth/login')
          .send({ email: email4, password: 'TestPass!123' })
          .expect(200)
      ).body.accessToken as string;
      // Activate restaurant.
      await aPost(tok4, '/admin/modules/restaurant/activate').then((r) => expect(r.status).toBe(201));
      await aPost(tok4, '/admin/modules/restaurant/complete-setup').then((r) =>
        expect(r.status).toBe(201),
      );
    });

    it('platform can suspend an ACTIVE module', async () => {
      const res = await pPost(
        `/internal/businesses/${biz4Id}/modules/restaurant/suspend`,
      );
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('SUSPENDED');
    });

    it('business owner cannot resume a SUSPENDED module', async () => {
      // resume() only works from DISABLED. SUSPENDED can only be lifted by platform.
      const res = await aPost(tok4, '/admin/modules/restaurant/resume');
      expect(res.status).toBe(400);
    });

    it('platform can unsuspend → back to ACTIVE (setup was done)', async () => {
      const res = await pPost(
        `/internal/businesses/${biz4Id}/modules/restaurant/unsuspend`,
      );
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ACTIVE');
    });
  });

  // ── Module gating guard ────────────────────────────────────────────────────

  describe('Module gating guard (@RequireModule)', () => {
    let biz5Id: string;
    let tok5: string;

    beforeAll(async () => {
      const biz5Res = await pPost('/internal/businesses', {
        name: `Gating Co ${RUN}`,
        businessTypeKey: 'restaurant',
      });
      biz5Id = biz5Res.body.id as string;
      const email5 = `owner-gate-${RUN}@test.local`;
      await pPost(`/internal/businesses/${biz5Id}/provision`, {
        email: email5,
        displayName: 'Owner 5',
        password: 'TestPass!123',
      }).then((r) => expect(r.status).toBe(201));
      tok5 = (
        await request(http())
          .post('/auth/login')
          .send({ email: email5, password: 'TestPass!123' })
          .expect(200)
      ).body.accessToken as string;
    });

    it('GET /_test_module_gate returns 403 MODULE_DISABLED when restaurant not active', async () => {
      // restaurant is AVAILABLE (no activation row) for biz5.
      // The ModuleGatingGuard must intercept this and throw ModuleDisabledError.
      const res = await aGet(tok5, '/_test_module_gate');
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('MODULE_DISABLED');
    });

    it('GET /_test_module_gate returns 403 MODULE_DISABLED when restaurant is PENDING_SETUP', async () => {
      await aPost(tok5, '/admin/modules/restaurant/activate').then((r) => expect(r.status).toBe(201));
      // Still in PENDING_SETUP — guard should block.
      const res = await aGet(tok5, '/_test_module_gate');
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('MODULE_DISABLED');
    });

    it('GET /_test_module_gate returns 200 once restaurant is ACTIVE', async () => {
      await aPost(tok5, '/admin/modules/restaurant/complete-setup').then((r) =>
        expect(r.status).toBe(201),
      );
      const res = await aGet(tok5, '/_test_module_gate');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('GET /_test_module_gate returns 403 MODULE_DISABLED after module is disabled', async () => {
      await aPost(tok5, '/admin/modules/restaurant/disable').then((r) => expect(r.status).toBe(201));
      const res = await aGet(tok5, '/_test_module_gate');
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('MODULE_DISABLED');
    });

    it('PLATFORM admin bypasses module gate on the same route', async () => {
      // Platform realm short-circuits the guard; platform admin is not blocked
      // even though restaurant is DISABLED for biz5.
      const res = await aGet(platformToken, '/_test_module_gate');
      expect(res.status).toBe(200);
    });
  });

  // ── Cross-business isolation ───────────────────────────────────────────────

  describe('Cross-business isolation', () => {
    it('business owner cannot see or manage another business modules via admin routes', async () => {
      // /admin/modules always scopes to the principal's own businessId.
      // There's no way for a business user to specify another business's modules.
      const biz6Res = await pPost('/internal/businesses', {
        name: `Iso Co ${RUN}`,
        businessTypeKey: 'restaurant',
      });
      const biz6Id = biz6Res.body.id as string;
      const email6 = `owner-iso-${RUN}@test.local`;
      await pPost(`/internal/businesses/${biz6Id}/provision`, {
        email: email6,
        displayName: 'Owner 6',
        password: 'TestPass!123',
      }).then((r) => expect(r.status).toBe(201));
      const tok6 = (
        await request(http())
          .post('/auth/login')
          .send({ email: email6, password: 'TestPass!123' })
          .expect(200)
      ).body.accessToken as string;

      // Activate restaurant for biz6.
      await aPost(tok6, '/admin/modules/restaurant/activate').then((r) => expect(r.status).toBe(201));

      // ownerToken (bizId) cannot see biz6's modules via /admin/modules (it scopes to own biz).
      const ourModules = await aGet(ownerToken, '/admin/modules');
      // We can check restaurant is not PENDING_SETUP for bizId (because we disabled it earlier).
      const ourRestaurant = ourModules.body.find((m: { key: string }) => m.key === 'restaurant');
      expect(ourRestaurant.status).toBe('DISABLED'); // disabled from earlier test

      // biz6's modules are separate:
      const theirModules = await aGet(tok6, '/admin/modules');
      const theirRestaurant = theirModules.body.find((m: { key: string }) => m.key === 'restaurant');
      expect(theirRestaurant.status).toBe('PENDING_SETUP');
    });
  });
});
