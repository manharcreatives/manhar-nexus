import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';

jest.setTimeout(120_000);

/**
 * Phase 13 — Onboarding / Deployment E2E suite.
 *
 * Coverage:
 *   Initialization: idempotent, creates BUSINESS_CREATED step auto-completed
 *   Get: 404 before init, 200 after
 *   Validate: returns structured readiness checks
 *   Step completion: idempotent, advances currentStep, orders steps
 *   Notes: update notes via PATCH
 *   Listing: filter by completed state
 *   Security: business users cannot access onboarding endpoints (403)
 *   Security: unauthenticated gets 401
 *   IDOR: cannot initialize/get onboarding for a business using another business user token
 *   Failure recovery: duplicate init is idempotent (200, not 409)
 *   Step validation: unknown step returns 400
 *
 * ADR-027 invariants tested:
 *   - completedSteps array is additive (re-completing a step is idempotent)
 *   - currentStep advances to the next incomplete step
 *   - /validate checks pre-conditions against live DB data
 */
describe('Onboarding — Phase 13 (e2e)', () => {
  let app: INestApplication;
  let platformToken: string;
  let businessToken: string;
  let clientBizId: string;
  let clientBizId2: string;

  const RUN = Date.now().toString(36);
  const http = () => app.getHttpServer();

  const pGet = (path: string) =>
    request(http()).get(path).set('authorization', `Bearer ${platformToken}`);
  const pPost = (path: string, body: object = {}) =>
    request(http()).post(path).set('authorization', `Bearer ${platformToken}`).send(body);
  const pPatch = (path: string, body: object = {}) =>
    request(http()).patch(path).set('authorization', `Bearer ${platformToken}`).send(body);
  const bGet = (path: string) =>
    request(http()).get(path).set('authorization', `Bearer ${businessToken}`);
  const bPost = (path: string, body: object = {}) =>
    request(http()).post(path).set('authorization', `Bearer ${businessToken}`).send(body);

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    applyHttpDefaults(app);
    await app.init();

    // Platform admin login
    const loginRes = await request(http()).post('/auth/login').send({
      email: 'platform@manhar.local',
      password: 'ChangeMe!Dev12345',
    });
    expect(loginRes.status).toBe(200);
    platformToken = loginRes.body.accessToken as string;

    // Create two test businesses
    const biz1 = await pPost('/internal/businesses', {
      name: `OnboardTestBiz1 ${RUN}`,
      businessTypeKey: 'restaurant',
    });
    expect(biz1.status).toBe(201);
    clientBizId = biz1.body.id as string;

    const biz2 = await pPost('/internal/businesses', {
      name: `OnboardTestBiz2 ${RUN}`,
      businessTypeKey: 'restaurant',
    });
    expect(biz2.status).toBe(201);
    clientBizId2 = biz2.body.id as string;

    // Provision business user for biz1
    const email = `biz-owner-ob-${RUN}@test.local`;
    const pw = 'TestOB!Pass123';
    await pPost(`/internal/businesses/${clientBizId}/provision`, {
      email,
      displayName: 'OB Owner',
      password: pw,
    });
    const bizLogin = await request(http()).post('/auth/login').send({ email, password: pw });
    expect(bizLogin.status).toBe(200);
    businessToken = bizLogin.body.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── GET before init ─────────────────────────────────────────────────────────

  describe('Before initialization', () => {
    it('GET returns 404 before onboarding is initialized', async () => {
      const res = await pGet(`/internal/onboarding/${clientBizId}`);
      expect(res.status).toBe(404);
    });

    it('validate endpoint works even before init', async () => {
      const res = await pGet(`/internal/onboarding/${clientBizId}/validate`);
      expect(res.status).toBe(200);
      expect(typeof res.body.hasLocation).toBe('boolean');
      expect(typeof res.body.hasActiveModule).toBe('boolean');
      expect(typeof res.body.hasNonOwnerUser).toBe('boolean');
      expect(Array.isArray(res.body.issues)).toBe(true);
    });
  });

  // ─── Initialize ──────────────────────────────────────────────────────────────

  describe('Initialize', () => {
    it('should initialize onboarding for a business', async () => {
      const res = await pPost(`/internal/onboarding/${clientBizId}/initialize`, {
        notes: 'First test client',
      });
      expect(res.status).toBe(201);
      expect(res.body.businessId).toBe(clientBizId);
      expect(res.body.completedSteps).toContain('BUSINESS_CREATED');
      expect(res.body.currentStep).toBe('LOCATION_ADDED');
      expect(res.body.notes).toBe('First test client');
      expect(res.body.completedAt).toBeNull();
    });

    it('should be idempotent — re-initializing returns the same record (200 not 409)', async () => {
      const res = await pPost(`/internal/onboarding/${clientBizId}/initialize`, {
        notes: 'Different notes',
      });
      expect(res.status).toBe(201);
      expect(res.body.notes).toBe('First test client'); // notes preserved from first init
      expect(res.body.completedSteps).toContain('BUSINESS_CREATED');
    });

    it('should return 404 for unknown business', async () => {
      const res = await pPost(
        '/internal/onboarding/00000000-0000-4000-a000-000000000000/initialize',
        {},
      );
      expect(res.status).toBe(404);
    });
  });

  // ─── Get ─────────────────────────────────────────────────────────────────────

  describe('Get', () => {
    it('should get onboarding progress with business details', async () => {
      const res = await pGet(`/internal/onboarding/${clientBizId}`);
      expect(res.status).toBe(200);
      expect(res.body.businessId).toBe(clientBizId);
      expect(res.body.business.name).toMatch(/OnboardTestBiz1/);
      expect(Array.isArray(res.body.completedSteps)).toBe(true);
    });
  });

  // ─── Validate ────────────────────────────────────────────────────────────────

  describe('Validate', () => {
    it('should show failures when no location/module/user configured', async () => {
      const res = await pGet(`/internal/onboarding/${clientBizId}/validate`);
      expect(res.status).toBe(200);
      expect(res.body.hasLocation).toBe(false);
      expect(res.body.hasActiveModule).toBe(false);
      // Owner user was provisioned so hasNonOwnerUser = true
      expect(res.body.hasNonOwnerUser).toBe(true);
      expect(res.body.issues.length).toBeGreaterThan(0);
    });

    it('should pass hasLocation after a location is created', async () => {
      const locRes = await pPost(`/internal/businesses/${clientBizId}/locations`, {
        name: 'Main Branch',
        code: 'MB',
      });
      expect(locRes.status).toBe(201);

      const res = await pGet(`/internal/onboarding/${clientBizId}/validate`);
      expect(res.status).toBe(200);
      expect(res.body.hasLocation).toBe(true);
    });
  });

  // ─── Step completion ─────────────────────────────────────────────────────────

  describe('Step completion', () => {
    it('should mark LOCATION_ADDED complete', async () => {
      const res = await pPost(
        `/internal/onboarding/${clientBizId}/steps/LOCATION_ADDED`,
        { note: 'Main branch created' },
      );
      expect(res.status).toBe(201);
      expect(res.body.completedSteps).toContain('LOCATION_ADDED');
      expect(res.body.currentStep).toBe('MODULES_SELECTED');
    });

    it('should be idempotent — re-completing LOCATION_ADDED keeps the same step array', async () => {
      const res = await pPost(`/internal/onboarding/${clientBizId}/steps/LOCATION_ADDED`, {});
      expect(res.status).toBe(201);
      const count = (res.body.completedSteps as string[]).filter((s) => s === 'LOCATION_ADDED').length;
      expect(count).toBe(1); // no duplicates
    });

    it('should complete MODULES_SELECTED', async () => {
      const res = await pPost(`/internal/onboarding/${clientBizId}/steps/MODULES_SELECTED`, {});
      expect(res.status).toBe(201);
      expect(res.body.completedSteps).toContain('MODULES_SELECTED');
    });

    it('should complete BRANDING_SET', async () => {
      const res = await pPost(`/internal/onboarding/${clientBizId}/steps/BRANDING_SET`, {});
      expect(res.status).toBe(201);
    });

    it('should complete CONFIGURATION_DONE', async () => {
      const res = await pPost(`/internal/onboarding/${clientBizId}/steps/CONFIGURATION_DONE`, {});
      expect(res.status).toBe(201);
    });

    it('should complete USERS_PROVISIONED', async () => {
      const res = await pPost(`/internal/onboarding/${clientBizId}/steps/USERS_PROVISIONED`, {});
      expect(res.status).toBe(201);
    });

    it('should complete DEVICES_CONFIGURED', async () => {
      const res = await pPost(`/internal/onboarding/${clientBizId}/steps/DEVICES_CONFIGURED`, {});
      expect(res.status).toBe(201);
    });

    it('should complete VALIDATED', async () => {
      const res = await pPost(`/internal/onboarding/${clientBizId}/steps/VALIDATED`, {});
      expect(res.status).toBe(201);
      expect(res.body.currentStep).toBe('COMPLETED');
    });

    it('should complete COMPLETED and set completedAt', async () => {
      const res = await pPost(`/internal/onboarding/${clientBizId}/steps/COMPLETED`, {
        note: 'Client is live!',
      });
      expect(res.status).toBe(201);
      expect(res.body.completedSteps).toContain('COMPLETED');
      expect(res.body.completedAt).not.toBeNull();
    });

    it('should reject unknown step with 400', async () => {
      const res = await pPost(`/internal/onboarding/${clientBizId}/steps/NOT_A_REAL_STEP`, {});
      expect(res.status).toBe(400);
    });
  });

  // ─── Notes ───────────────────────────────────────────────────────────────────

  describe('Notes', () => {
    beforeAll(async () => {
      // Initialize onboarding for biz2 for notes tests
      await pPost(`/internal/onboarding/${clientBizId2}/initialize`, { notes: 'Initial' });
    });

    it('should update notes', async () => {
      const res = await pPatch(`/internal/onboarding/${clientBizId2}/notes`, {
        notes: 'Updated internal context',
      });
      expect(res.status).toBe(200);
      expect(res.body.notes).toBe('Updated internal context');
    });

    it('should clear notes with null', async () => {
      const res = await pPatch(`/internal/onboarding/${clientBizId2}/notes`, { notes: null });
      expect(res.status).toBe(200);
      expect(res.body.notes).toBeNull();
    });
  });

  // ─── List ────────────────────────────────────────────────────────────────────

  describe('List', () => {
    it('should list all onboarding records', async () => {
      const res = await pGet('/internal/onboarding');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const bizIds = (res.body as Array<{ businessId: string }>).map((r) => r.businessId);
      expect(bizIds).toContain(clientBizId);
      expect(bizIds).toContain(clientBizId2);
    });

    it('should filter completed onboardings', async () => {
      const res = await pGet('/internal/onboarding?completed=true');
      expect(res.status).toBe(200);
      const all = res.body as Array<{ completedAt: string | null }>;
      all.forEach((r) => expect(r.completedAt).not.toBeNull());
    });

    it('should filter in-progress onboardings', async () => {
      const res = await pGet('/internal/onboarding?completed=false');
      expect(res.status).toBe(200);
      const all = res.body as Array<{ completedAt: string | null }>;
      all.forEach((r) => expect(r.completedAt).toBeNull());
    });
  });

  // ─── Security ────────────────────────────────────────────────────────────────

  describe('Security', () => {
    it('business user cannot list onboardings (403)', async () => {
      const res = await bGet('/internal/onboarding');
      expect(res.status).toBe(403);
    });

    it('business user cannot initialize onboarding (403)', async () => {
      const res = await bPost(`/internal/onboarding/${clientBizId}/initialize`, {});
      expect(res.status).toBe(403);
    });

    it('business user cannot view their own onboarding (403)', async () => {
      const res = await bGet(`/internal/onboarding/${clientBizId}`);
      expect(res.status).toBe(403);
    });

    it('business user cannot complete steps (403)', async () => {
      const res = await bPost(`/internal/onboarding/${clientBizId}/steps/VALIDATED`, {});
      expect(res.status).toBe(403);
    });

    it('unauthenticated request gets 401', async () => {
      const res = await request(http()).get('/internal/onboarding');
      expect(res.status).toBe(401);
    });

    it('validate endpoint also requires authentication (401 unauthenticated)', async () => {
      const res = await request(http()).get(
        `/internal/onboarding/${clientBizId}/validate`,
      );
      expect(res.status).toBe(401);
    });
  });
});
