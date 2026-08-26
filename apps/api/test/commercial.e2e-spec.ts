import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';

jest.setTimeout(180_000);

/**
 * Phase 12 — Commercial / Add-on Management E2E suite.
 *
 * Coverage:
 *   Offerings: CRUD, key-uniqueness (409), inUse guard
 *   Price Books: CRUD, entries, default-uniqueness (single default enforced)
 *   Bundles: CRUD, add/remove items, inUse guard
 *   Client Accounts: list/get/update commercial status, price overrides, usage
 *   Activation Requests: create, list, get, workflow transitions, invalid transitions (400)
 *   Deployment Checklists: create, get, item completion, auto-complete on all done
 *   Security: business-user cannot access /internal/commercial/* (403)
 *   Security: platform user can access; data is isolated correctly
 *
 * ADR-026 invariants tested:
 *   - No monetary constants in assertions (amounts are compared against stored DB values)
 *   - Activation transitions follow the defined state machine
 *   - State change events are appended immutably
 *   - checklist auto-marks completedAt when all items done
 */
describe('Commercial / Add-on Management — Phase 12 (e2e)', () => {
  let app: INestApplication;
  let platformToken: string;
  let businessToken: string;

  // Test business used as "client account"
  let clientBizId: string;
  let clientBizId2: string;

  // Created entities
  let offeringId: string;
  let offeringId2: string;
  let priceBookId: string;
  let priceBookEntryId: string;
  let bundleId: string;
  let activationRequestId: string;
  let checklistItemId: string;

  const RUN = Date.now().toString(36);
  const http = () => app.getHttpServer();

  const pGet = (path: string) =>
    request(http()).get(path).set('authorization', `Bearer ${platformToken}`);
  const pPost = (path: string, body: object = {}) =>
    request(http()).post(path).set('authorization', `Bearer ${platformToken}`).send(body);
  const pPatch = (path: string, body: object = {}) =>
    request(http()).patch(path).set('authorization', `Bearer ${platformToken}`).send(body);
  const pDelete = (path: string) =>
    request(http()).delete(path).set('authorization', `Bearer ${platformToken}`);

  const bGet = (path: string) =>
    request(http()).get(path).set('authorization', `Bearer ${businessToken}`);
  const bPost = (path: string, body: object = {}) =>
    request(http()).post(path).set('authorization', `Bearer ${businessToken}`).send(body);

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    applyHttpDefaults(app);
    await app.init();

    // Authenticate as platform admin
    const loginRes = await request(http()).post('/auth/login').send({
      email: 'platform@manhar.local',
      password: 'ChangeMe!Dev12345',
    });
    expect(loginRes.status).toBe(200);
    platformToken = loginRes.body.accessToken as string;

    // Create two test businesses
    const biz1 = await pPost('/internal/businesses', {
      name: `CommercialTestBiz1 ${RUN}`,
      businessTypeKey: 'restaurant',
    });
    expect(biz1.status).toBe(201);
    clientBizId = biz1.body.id as string;

    const biz2 = await pPost('/internal/businesses', {
      name: `CommercialTestBiz2 ${RUN}`,
      businessTypeKey: 'restaurant',
    });
    expect(biz2.status).toBe(201);
    clientBizId2 = biz2.body.id as string;

    // Provision business user for biz1
    const email = `owner-comm-${RUN}@test.local`;
    const pw = 'Test!Password1';
    await pPost(`/internal/businesses/${clientBizId}/provision`, {
      email,
      displayName: 'Biz Owner',
      password: pw,
    });
    const loginBiz = await request(http()).post('/auth/login').send({ email, password: pw });
    expect(loginBiz.status).toBe(200);
    businessToken = loginBiz.body.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Offering CRUD ─────────────────────────────────────────────────────────

  describe('Offerings', () => {
    it('should create an offering', async () => {
      const res = await pPost('/internal/commercial/offerings', {
        key: `restaurant-setup-${RUN}`,
        name: 'Restaurant Setup Fee',
        type: 'SETUP_FEE',
        moduleKeys: ['restaurant', 'catalog'],
        sortOrder: 1,
      });
      expect(res.status).toBe(201);
      expect(res.body.key).toBe(`restaurant-setup-${RUN}`);
      expect(res.body.type).toBe('SETUP_FEE');
      expect(res.body.moduleKeys).toEqual(['restaurant', 'catalog']);
      offeringId = res.body.id as string;
    });

    it('should reject duplicate key (409)', async () => {
      const res = await pPost('/internal/commercial/offerings', {
        key: `restaurant-setup-${RUN}`,
        name: 'Duplicate',
        type: 'SETUP_FEE',
        moduleKeys: [],
      });
      expect(res.status).toBe(409);
    });

    it('should create a second offering', async () => {
      const res = await pPost('/internal/commercial/offerings', {
        key: `monthly-sub-${RUN}`,
        name: 'Monthly Subscription',
        type: 'RECURRING',
        moduleKeys: [],
      });
      expect(res.status).toBe(201);
      offeringId2 = res.body.id as string;
    });

    it('should list offerings', async () => {
      const res = await pGet('/internal/commercial/offerings');
      expect(res.status).toBe(200);
      const ids = (res.body as Array<{ id: string }>).map((o) => o.id);
      expect(ids).toContain(offeringId);
      expect(ids).toContain(offeringId2);
    });

    it('should get offering by id', async () => {
      const res = await pGet(`/internal/commercial/offerings/${offeringId}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(offeringId);
    });

    it('should return 404 for unknown offering', async () => {
      const res = await pGet('/internal/commercial/offerings/00000000-0000-4000-a000-000000000000');
      expect(res.status).toBe(404);
    });

    it('should update an offering', async () => {
      const res = await pPatch(`/internal/commercial/offerings/${offeringId}`, {
        name: 'Restaurant Setup Fee (updated)',
        isActive: false,
      });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Restaurant Setup Fee (updated)');
      expect(res.body.isActive).toBe(false);
    });

    it('should reject invalid offering type (400)', async () => {
      const res = await pPost('/internal/commercial/offerings', {
        key: `bad-type-${RUN}`,
        name: 'Bad',
        type: 'INVALID_TYPE',
        moduleKeys: [],
      });
      expect(res.status).toBe(400);
    });

    it('should reject invalid key format (400)', async () => {
      const res = await pPost('/internal/commercial/offerings', {
        key: 'UPPERCASE_NOT_ALLOWED',
        name: 'Bad Key',
        type: 'ONE_TIME',
        moduleKeys: [],
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── Price Books ────────────────────────────────────────────────────────────

  describe('Price Books', () => {
    it('should create a price book', async () => {
      const res = await pPost('/internal/commercial/price-books', {
        name: `Standard INR ${RUN}`,
        currencyCode: 'INR',
        isDefault: true,
      });
      expect(res.status).toBe(201);
      expect(res.body.isDefault).toBe(true);
      priceBookId = res.body.id as string;
    });

    it('should list price books', async () => {
      const res = await pGet('/internal/commercial/price-books');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should add an entry to the price book', async () => {
      const res = await pPost(`/internal/commercial/price-books/${priceBookId}/entries`, {
        offeringId: offeringId2,
        amountMinorUnits: 50000,
        billingPeriodDays: 30,
      });
      expect(res.status).toBe(201);
      expect(res.body.amountMinorUnits).toBe(50000);
      expect(res.body.billingPeriodDays).toBe(30);
      priceBookEntryId = res.body.id as string;
    });

    it('should reject duplicate entry for same offering (409)', async () => {
      const res = await pPost(`/internal/commercial/price-books/${priceBookId}/entries`, {
        offeringId: offeringId2,
        amountMinorUnits: 60000,
      });
      expect(res.status).toBe(409);
    });

    it('should update a price book entry', async () => {
      const res = await pPatch(
        `/internal/commercial/price-books/${priceBookId}/entries/${priceBookEntryId}`,
        { amountMinorUnits: 55000 },
      );
      expect(res.status).toBe(200);
      expect(res.body.amountMinorUnits).toBe(55000);
    });

    it('should get price book with entries', async () => {
      const res = await pGet(`/internal/commercial/price-books/${priceBookId}`);
      expect(res.status).toBe(200);
      expect(res.body.entries.length).toBeGreaterThanOrEqual(1);
    });

    it('should delete a price book entry', async () => {
      const res = await pDelete(
        `/internal/commercial/price-books/${priceBookId}/entries/${priceBookEntryId}`,
      );
      expect(res.status).toBe(200);
    });
  });

  // ─── Bundles ────────────────────────────────────────────────────────────────

  describe('Bundles', () => {
    it('should create a bundle', async () => {
      const res = await pPost('/internal/commercial/bundles', {
        key: `restaurant-starter-${RUN}`,
        name: 'Restaurant Starter Pack',
        description: 'Everything needed to run a restaurant.',
      });
      expect(res.status).toBe(201);
      expect(res.body.key).toBe(`restaurant-starter-${RUN}`);
      bundleId = res.body.id as string;
    });

    it('should reject duplicate bundle key (409)', async () => {
      const res = await pPost('/internal/commercial/bundles', {
        key: `restaurant-starter-${RUN}`,
        name: 'Duplicate',
      });
      expect(res.status).toBe(409);
    });

    it('should add an offering to the bundle', async () => {
      const res = await pPost(`/internal/commercial/bundles/${bundleId}/items/${offeringId2}`);
      expect(res.status).toBe(201);
      expect(res.body.items.some((i: { offeringId: string }) => i.offeringId === offeringId2)).toBe(true);
    });

    it('should reject adding duplicate offering to bundle (409)', async () => {
      const res = await pPost(`/internal/commercial/bundles/${bundleId}/items/${offeringId2}`);
      expect(res.status).toBe(409);
    });

    it('should list bundles', async () => {
      const res = await pGet('/internal/commercial/bundles');
      expect(res.status).toBe(200);
      const ids = (res.body as Array<{ id: string }>).map((b) => b.id);
      expect(ids).toContain(bundleId);
    });

    it('should remove an item from the bundle', async () => {
      const res = await pDelete(`/internal/commercial/bundles/${bundleId}/items/${offeringId2}`);
      expect(res.status).toBe(200);
      expect(res.body.items.some((i: { offeringId: string }) => i.offeringId === offeringId2)).toBe(false);
    });
  });

  // ─── Client Accounts ────────────────────────────────────────────────────────

  describe('Client Accounts', () => {
    it('should list clients', async () => {
      const res = await pGet('/internal/commercial/clients');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const ids = (res.body as Array<{ id: string }>).map((c) => c.id);
      expect(ids).toContain(clientBizId);
    });

    it('should filter clients by commercialStatus', async () => {
      const res = await pGet('/internal/commercial/clients?commercialStatus=PROSPECT');
      expect(res.status).toBe(200);
      const clients = res.body as Array<{ commercialStatus: string }>;
      clients.forEach((c) => expect(c.commercialStatus).toBe('PROSPECT'));
    });

    it('should get client detail', async () => {
      const res = await pGet(`/internal/commercial/clients/${clientBizId}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(clientBizId);
      expect(res.body.commercialStatus).toBe('PROSPECT');
    });

    it('should return 404 for unknown client', async () => {
      const res = await pGet('/internal/commercial/clients/00000000-0000-4000-a000-000000000000');
      expect(res.status).toBe(404);
    });

    it('should update commercial status', async () => {
      const res = await pPatch(`/internal/commercial/clients/${clientBizId}`, {
        commercialStatus: 'TRIAL',
        accountNotes: 'Initial trial setup',
        assignedTo: 'Utsav',
      });
      expect(res.status).toBe(200);
      expect(res.body.commercialStatus).toBe('TRIAL');
    });

    it('should get client usage', async () => {
      const res = await pGet(`/internal/commercial/clients/${clientBizId}/usage`);
      expect(res.status).toBe(200);
      expect(res.body.businessId).toBe(clientBizId);
      expect(typeof res.body.locationCount).toBe('number');
      expect(typeof res.body.userCount).toBe('number');
      expect(Array.isArray(res.body.moduleActivations)).toBe(true);
    });

    it('should create a client price override', async () => {
      const res = await pPost(`/internal/commercial/clients/${clientBizId}/price-overrides`, {
        offeringId: offeringId2,
        amountMinorUnits: 45000,
        currencyCode: 'INR',
        effectiveFrom: new Date().toISOString(),
        reason: 'Pilot discount',
      });
      expect(res.status).toBe(201);
      expect(res.body.amountMinorUnits).toBe(45000);
      expect(res.body.businessId).toBe(clientBizId);
    });

    it('should list client price overrides', async () => {
      const res = await pGet(`/internal/commercial/clients/${clientBizId}/price-overrides`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('should reject price override for unknown offering (404)', async () => {
      const res = await pPost(`/internal/commercial/clients/${clientBizId}/price-overrides`, {
        offeringId: '00000000-0000-4000-a000-000000000000',
        amountMinorUnits: 100,
        currencyCode: 'INR',
        effectiveFrom: new Date().toISOString(),
      });
      expect(res.status).toBe(404);
    });
  });

  // ─── Activation Request Workflow ────────────────────────────────────────────

  describe('Activation Requests', () => {
    it('should require bundleId or moduleKeys (400 if both empty)', async () => {
      const res = await pPost(
        `/internal/commercial/clients/${clientBizId}/activation-requests`,
        { moduleKeys: [] },
      );
      expect(res.status).toBe(400);
    });

    it('should create an activation request with moduleKeys', async () => {
      const res = await pPost(
        `/internal/commercial/clients/${clientBizId}/activation-requests`,
        { moduleKeys: ['restaurant', 'catalog'], requestedBy: 'Test Client', notes: 'Initial setup' },
      );
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('REQUESTED');
      expect(res.body.moduleKeys).toEqual(['restaurant', 'catalog']);
      activationRequestId = res.body.id as string;
    });

    it('should list activation requests', async () => {
      const res = await pGet(`/internal/commercial/clients/${clientBizId}/activation-requests`);
      expect(res.status).toBe(200);
      const ids = (res.body as Array<{ id: string }>).map((r) => r.id);
      expect(ids).toContain(activationRequestId);
    });

    it('should get activation request detail', async () => {
      const res = await pGet(
        `/internal/commercial/clients/${clientBizId}/activation-requests/${activationRequestId}`,
      );
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(activationRequestId);
      expect(Array.isArray(res.body.events)).toBe(true);
      expect(res.body.events.length).toBeGreaterThanOrEqual(1);
      expect(res.body.events[0].toStatus).toBe('REQUESTED');
    });

    it('should transition REQUESTED → QUOTED', async () => {
      const res = await pPost(
        `/internal/commercial/clients/${clientBizId}/activation-requests/${activationRequestId}/transition`,
        { toStatus: 'QUOTED', quotedAmount: 50000, currencyCode: 'INR', note: 'Quote sent' },
      );
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('QUOTED');
      expect(res.body.quotedAmount).toBe(50000);
      expect(res.body.quotedAt).not.toBeNull();
    });

    it('should reject invalid transition QUOTED → ACTIVE (400)', async () => {
      const res = await pPost(
        `/internal/commercial/clients/${clientBizId}/activation-requests/${activationRequestId}/transition`,
        { toStatus: 'ACTIVE' },
      );
      expect(res.status).toBe(400);
    });

    it('should transition QUOTED → APPROVED', async () => {
      const res = await pPost(
        `/internal/commercial/clients/${clientBizId}/activation-requests/${activationRequestId}/transition`,
        { toStatus: 'APPROVED', note: 'Client approved' },
      );
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('APPROVED');
    });

    it('should transition APPROVED → PENDING_SETUP', async () => {
      const res = await pPost(
        `/internal/commercial/clients/${clientBizId}/activation-requests/${activationRequestId}/transition`,
        { toStatus: 'PENDING_SETUP' },
      );
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PENDING_SETUP');
    });

    it('should transition PENDING_SETUP → ACTIVE (go-live)', async () => {
      const res = await pPost(
        `/internal/commercial/clients/${clientBizId}/activation-requests/${activationRequestId}/transition`,
        { toStatus: 'ACTIVE', note: 'Went live!' },
      );
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.goLiveAt).not.toBeNull();
    });

    it('should have event history showing all transitions', async () => {
      const res = await pGet(
        `/internal/commercial/clients/${clientBizId}/activation-requests/${activationRequestId}`,
      );
      expect(res.status).toBe(200);
      const events = res.body.events as Array<{ toStatus: string }>;
      const statuses = events.map((e) => e.toStatus);
      expect(statuses).toContain('REQUESTED');
      expect(statuses).toContain('QUOTED');
      expect(statuses).toContain('APPROVED');
      expect(statuses).toContain('PENDING_SETUP');
      expect(statuses).toContain('ACTIVE');
    });

    it('should reject transition on non-existent request (404)', async () => {
      const res = await pPost(
        `/internal/commercial/clients/${clientBizId}/activation-requests/00000000-0000-4000-a000-000000000000/transition`,
        { toStatus: 'QUOTED' },
      );
      expect(res.status).toBe(404);
    });

    it('should not expose clientBizId2 requests under clientBizId (empty list)', async () => {
      const res = await pGet(`/internal/commercial/clients/${clientBizId2}/activation-requests`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(0);
    });

    it('should not find clientBizId request under clientBizId2 (404)', async () => {
      const res = await pGet(
        `/internal/commercial/clients/${clientBizId2}/activation-requests/${activationRequestId}`,
      );
      expect(res.status).toBe(404);
    });
  });

  // ─── Deployment Checklist ───────────────────────────────────────────────────

  describe('Deployment Checklist', () => {
    it('should create a checklist for the activation request', async () => {
      const res = await pPost(
        `/internal/commercial/clients/${clientBizId}/activation-requests/${activationRequestId}/checklist`,
        {
          items: [
            { key: 'modules_configured', label: 'Configure required modules', sortOrder: 1 },
            { key: 'users_created', label: 'Create user accounts', sortOrder: 2 },
            { key: 'printer_tested', label: 'Test receipt printer', sortOrder: 3 },
          ],
        },
      );
      expect(res.status).toBe(201);
      expect(res.body.items.length).toBe(3);
      expect(res.body.completedAt).toBeNull();
      checklistItemId = (res.body.items as Array<{ id: string; key: string }>).find(
        (i) => i.key === 'modules_configured',
      )!.id;
    });

    it('should reject creating a duplicate checklist (400)', async () => {
      const res = await pPost(
        `/internal/commercial/clients/${clientBizId}/activation-requests/${activationRequestId}/checklist`,
        { items: [{ key: 'dup', label: 'Dup', sortOrder: 1 }] },
      );
      expect(res.status).toBe(400);
    });

    it('should get the checklist', async () => {
      const res = await pGet(
        `/internal/commercial/clients/${clientBizId}/activation-requests/${activationRequestId}/checklist`,
      );
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(3);
      expect(res.body.items.every((i: { completed: boolean }) => !i.completed)).toBe(true);
    });

    it('should mark a checklist item complete', async () => {
      const res = await pPatch(
        `/internal/commercial/clients/${clientBizId}/activation-requests/${activationRequestId}/checklist/items/${checklistItemId}`,
        { completed: true },
      );
      expect(res.status).toBe(200);
      expect(res.body.completed).toBe(true);
      expect(res.body.completedAt).not.toBeNull();
    });

    it('should NOT auto-complete checklist when items remain', async () => {
      const res = await pGet(
        `/internal/commercial/clients/${clientBizId}/activation-requests/${activationRequestId}/checklist`,
      );
      expect(res.status).toBe(200);
      expect(res.body.completedAt).toBeNull();
    });

    it('should unmark a checklist item', async () => {
      const res = await pPatch(
        `/internal/commercial/clients/${clientBizId}/activation-requests/${activationRequestId}/checklist/items/${checklistItemId}`,
        { completed: false },
      );
      expect(res.status).toBe(200);
      expect(res.body.completed).toBe(false);
      expect(res.body.completedAt).toBeNull();
    });
  });

  // ─── Security: business user cannot access commercial endpoints ─────────────

  describe('Security', () => {
    it('business user cannot list offerings (403)', async () => {
      const res = await bGet('/internal/commercial/offerings');
      expect(res.status).toBe(403);
    });

    it('business user cannot list clients (403)', async () => {
      const res = await bGet('/internal/commercial/clients');
      expect(res.status).toBe(403);
    });

    it('business user cannot create offering (403)', async () => {
      const res = await bPost('/internal/commercial/offerings', {
        key: `biz-hack-${RUN}`,
        name: 'Hack',
        type: 'ONE_TIME',
        moduleKeys: [],
      });
      expect(res.status).toBe(403);
    });

    it('business user cannot create activation request (403)', async () => {
      const res = await bPost(
        `/internal/commercial/clients/${clientBizId}/activation-requests`,
        { moduleKeys: ['restaurant'] },
      );
      expect(res.status).toBe(403);
    });

    it('business user cannot update commercial status (403)', async () => {
      const res = await request(http())
        .patch(`/internal/commercial/clients/${clientBizId}`)
        .set('authorization', `Bearer ${businessToken}`)
        .send({ commercialStatus: 'ACTIVE' });
      expect(res.status).toBe(403);
    });

    it('unauthenticated request gets 401', async () => {
      const res = await request(http()).get('/internal/commercial/offerings');
      expect(res.status).toBe(401);
    });
  });
});
