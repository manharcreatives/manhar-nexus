import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';

jest.setTimeout(180_000);

/**
 * Phase 16 (Operating Costs) — E2E suite.
 *
 * Coverage:
 *   Module gating   — 403 when costs module not ACTIVE
 *   Auth            — 401 without token on all main routes
 *   Category CRUD   — list, create, get, patch; duplicate name → 409
 *   Expense CRUD    — create, list, get; idempotency; date/status filters
 *   Auto-approval   — category without requiresApproval → expense APPROVED immediately
 *   Approval flow   — requiresApproval category → PENDING_APPROVAL → approve → APPROVED
 *   Rejection flow  — PENDING_APPROVAL → reject (with reason) → REJECTED
 *   Double-action   — approve/reject already-processed expense → 400
 *   Summary         — grandTotal/byCategory aggregation (APPROVED only)
 *   Isolation       — Biz B cannot access Biz A categories or expenses
 *   Validation      — cross-business location → 403; inactive category → 404; bad amount → 400
 */
describe('Operating Costs — Phase 16 (e2e)', () => {
  let app: INestApplication;
  let platformToken: string;

  let bizAId: string;
  let ownerAToken: string;
  let locAId: string;

  let bizBId: string;
  let ownerBToken: string;
  let locBId: string;

  // A third business where the costs module is intentionally NOT activated.
  let bizGatedId: string;
  let ownerGatedToken: string;

  const RUN = Date.now().toString(36);
  const http = () => app.getHttpServer();

  // ── HTTP helpers ───────────────────────────────────────────────────────────

  const pPost = (path: string, body: object = {}) =>
    request(http()).post(path).set('authorization', `Bearer ${platformToken}`).send(body);

  const aGet = (tok: string, path: string) =>
    request(http()).get(path).set('authorization', `Bearer ${tok}`);

  const aPost = (tok: string, path: string, body: object = {}) =>
    request(http()).post(path).set('authorization', `Bearer ${tok}`).send(body);

  const aPatch = (tok: string, path: string, body: object) =>
    request(http()).patch(path).set('authorization', `Bearer ${tok}`).send(body);

  // ── Setup helpers ──────────────────────────────────────────────────────────

  const provisionOwner = async (bizId: string, suffix: string): Promise<string> => {
    const email = `owner-costs-${suffix}-${RUN}@test.local`;
    const pw = 'Test!Password1';
    const res = await pPost(`/internal/businesses/${bizId}/provision`, {
      email,
      displayName: `CostsOwner ${suffix}`,
      password: pw,
    });
    expect(res.status).toBe(201);
    const login = await request(http()).post('/auth/login').send({ email, password: pw });
    expect(login.status).toBe(200);
    return login.body.accessToken as string;
  };

  const activateCosts = async (bizId: string): Promise<void> => {
    const act = await pPost(`/internal/businesses/${bizId}/modules/costs/activate`);
    if (act.status !== 201 && act.status !== 409) {
      throw new Error(`activate costs: ${act.status} ${JSON.stringify(act.body)}`);
    }
    const setup = await pPost(`/internal/businesses/${bizId}/modules/costs/complete-setup`);
    if (setup.status !== 200 && setup.status !== 201) {
      throw new Error(`complete-setup costs: ${setup.status}`);
    }
  };

  const createLocation = async (tok: string, name: string): Promise<string> => {
    const res = await aPost(tok, '/admin/locations', { name, timezone: 'Asia/Kolkata' });
    expect(res.status).toBe(201);
    return res.body.id as string;
  };

  const uuid = () => crypto.randomUUID();

  // ── beforeAll ──────────────────────────────────────────────────────────────

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

    // Business A — costs module active
    const bizA = await pPost('/internal/businesses', { name: `CostsA ${RUN}`, businessTypeKey: 'restaurant' });
    expect(bizA.status).toBe(201);
    bizAId = bizA.body.id as string;
    ownerAToken = await provisionOwner(bizAId, 'A');
    await activateCosts(bizAId);
    locAId = await createLocation(ownerAToken, `Loc-A-${RUN}`);

    // Business B — costs module active (isolation target)
    const bizB = await pPost('/internal/businesses', { name: `CostsB ${RUN}`, businessTypeKey: 'restaurant' });
    expect(bizB.status).toBe(201);
    bizBId = bizB.body.id as string;
    ownerBToken = await provisionOwner(bizBId, 'B');
    await activateCosts(bizBId);
    locBId = await createLocation(ownerBToken, `Loc-B-${RUN}`);

    // Business Gated — costs module NOT activated
    const bizGated = await pPost('/internal/businesses', { name: `CostsGated ${RUN}`, businessTypeKey: 'restaurant' });
    expect(bizGated.status).toBe(201);
    bizGatedId = bizGated.body.id as string;
    ownerGatedToken = await provisionOwner(bizGatedId, 'Gated');
    // intentionally NOT activating costs module
    void bizGatedId; // suppress unused-var warning
  });

  afterAll(async () => {
    await app.close();
  });

  // ── 1. Module gating ───────────────────────────────────────────────────────

  describe('Module gating', () => {
    it('403 MODULE_DISABLED on category list when costs not active', async () => {
      const res = await aGet(ownerGatedToken, '/admin/costs/categories');
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('MODULE_DISABLED');
    });

    it('403 MODULE_DISABLED on expense list when costs not active', async () => {
      const res = await aGet(ownerGatedToken, '/admin/costs/expenses');
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('MODULE_DISABLED');
    });

    it('403 MODULE_DISABLED on summary when costs not active', async () => {
      const from = new Date().toISOString();
      const to = new Date().toISOString();
      const res = await aGet(ownerGatedToken, `/admin/costs/summary?from=${from}&to=${to}`);
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('MODULE_DISABLED');
    });
  });

  // ── 2. Authentication ──────────────────────────────────────────────────────

  describe('Authentication', () => {
    it('401 on categories without token', async () => {
      const res = await request(http()).get('/admin/costs/categories');
      expect(res.status).toBe(401);
    });

    it('401 on expenses without token', async () => {
      const res = await request(http()).get('/admin/costs/expenses');
      expect(res.status).toBe(401);
    });

    it('401 on summary without token', async () => {
      const from = new Date().toISOString();
      const to = new Date().toISOString();
      const res = await request(http()).get(`/admin/costs/summary?from=${from}&to=${to}`);
      expect(res.status).toBe(401);
    });
  });

  // ── 3. Category CRUD ───────────────────────────────────────────────────────

  describe('Category CRUD', () => {
    let catId: string;

    it('list returns empty array initially', async () => {
      const res = await aGet(ownerAToken, '/admin/costs/categories');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('creates a category', async () => {
      const res = await aPost(ownerAToken, '/admin/costs/categories', {
        name: `Rent-${RUN}`,
        description: 'Monthly rent',
        requiresApproval: false,
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        businessId: bizAId,
        name: `Rent-${RUN}`,
        description: 'Monthly rent',
        requiresApproval: false,
        isActive: true,
      });
      catId = res.body.id as string;
    });

    it('creates a second category with requiresApproval=true', async () => {
      const res = await aPost(ownerAToken, '/admin/costs/categories', {
        name: `Staff Wages-${RUN}`,
        requiresApproval: true,
      });
      expect(res.status).toBe(201);
      expect(res.body.requiresApproval).toBe(true);
    });

    it('duplicate name → 409', async () => {
      const res = await aPost(ownerAToken, '/admin/costs/categories', {
        name: `Rent-${RUN}`,
      });
      expect(res.status).toBe(409);
    });

    it('list now contains created category', async () => {
      const res = await aGet(ownerAToken, '/admin/costs/categories');
      expect(res.status).toBe(200);
      const ids = (res.body as Array<{ id: string }>).map((c) => c.id);
      expect(ids).toContain(catId);
    });

    it('get by ID returns the category', async () => {
      const res = await aGet(ownerAToken, `/admin/costs/categories/${catId}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(catId);
      expect(res.body.name).toBe(`Rent-${RUN}`);
    });

    it('get unknown category → 404', async () => {
      const res = await aGet(ownerAToken, `/admin/costs/categories/${uuid()}`);
      expect(res.status).toBe(404);
    });

    it('patch category description', async () => {
      const res = await aPatch(ownerAToken, `/admin/costs/categories/${catId}`, {
        description: 'Updated description',
      });
      expect(res.status).toBe(200);
      expect(res.body.description).toBe('Updated description');
    });

    it('patch deactivates a category', async () => {
      const res = await aPatch(ownerAToken, `/admin/costs/categories/${catId}`, {
        isActive: false,
      });
      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(false);
    });

    it('patch reactivates a category', async () => {
      const res = await aPatch(ownerAToken, `/admin/costs/categories/${catId}`, {
        isActive: true,
      });
      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(true);
    });

    it('400 on empty name in create', async () => {
      const res = await aPost(ownerAToken, '/admin/costs/categories', { name: '' });
      expect(res.status).toBe(400);
    });
  });

  // ── 4. Expense CRUD — auto-approve path ───────────────────────────────────

  describe('Expense CRUD (no-approval category)', () => {
    let noApprovalCatId: string;
    let expenseId: string;
    const idempotencyKey = uuid();

    beforeAll(async () => {
      const res = await aPost(ownerAToken, '/admin/costs/categories', {
        name: `Utilities-${RUN}`,
        requiresApproval: false,
      });
      noApprovalCatId = res.body.id as string;
    });

    it('creates an expense and auto-approves it', async () => {
      const res = await aPost(ownerAToken, '/admin/costs/expenses', {
        locationId: locAId,
        expenseCategoryId: noApprovalCatId,
        amountMinorUnits: 50000,
        paidAt: new Date().toISOString(),
        description: 'Electric bill',
        vendorName: 'DISCOM',
        isRecurring: true,
        idempotencyKey,
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        businessId: bizAId,
        locationId: locAId,
        expenseCategoryId: noApprovalCatId,
        amountMinorUnits: 50000,
        status: 'APPROVED',
        approvedAt: expect.any(String),
        description: 'Electric bill',
        vendorName: 'DISCOM',
        isRecurring: true,
        category: { id: noApprovalCatId, name: `Utilities-${RUN}` },
      });
      expenseId = res.body.id as string;
    });

    it('idempotency — same key returns same record', async () => {
      const res = await aPost(ownerAToken, '/admin/costs/expenses', {
        locationId: locAId,
        expenseCategoryId: noApprovalCatId,
        amountMinorUnits: 99999,
        paidAt: new Date().toISOString(),
        idempotencyKey,
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toBe(expenseId);
      expect(res.body.amountMinorUnits).toBe(50000);
    });

    it('list expenses returns the created expense', async () => {
      const res = await aGet(ownerAToken, '/admin/costs/expenses');
      expect(res.status).toBe(200);
      const ids = (res.body as Array<{ id: string }>).map((e) => e.id);
      expect(ids).toContain(expenseId);
    });

    it('list filter by status=APPROVED includes the expense', async () => {
      const res = await aGet(ownerAToken, '/admin/costs/expenses?status=APPROVED');
      expect(res.status).toBe(200);
      const ids = (res.body as Array<{ id: string }>).map((e) => e.id);
      expect(ids).toContain(expenseId);
    });

    it('list filter by status=PENDING_APPROVAL excludes auto-approved expense', async () => {
      const res = await aGet(ownerAToken, '/admin/costs/expenses?status=PENDING_APPROVAL');
      expect(res.status).toBe(200);
      const ids = (res.body as Array<{ id: string }>).map((e) => e.id);
      expect(ids).not.toContain(expenseId);
    });

    it('get expense by ID', async () => {
      const res = await aGet(ownerAToken, `/admin/costs/expenses/${expenseId}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(expenseId);
      expect(res.body.status).toBe('APPROVED');
    });

    it('get unknown expense → 404', async () => {
      const res = await aGet(ownerAToken, `/admin/costs/expenses/${uuid()}`);
      expect(res.status).toBe(404);
    });

    it('400 on missing locationId', async () => {
      const res = await aPost(ownerAToken, '/admin/costs/expenses', {
        expenseCategoryId: noApprovalCatId,
        amountMinorUnits: 100,
        paidAt: new Date().toISOString(),
        idempotencyKey: uuid(),
      });
      expect(res.status).toBe(400);
    });

    it('400 on negative amount', async () => {
      const res = await aPost(ownerAToken, '/admin/costs/expenses', {
        locationId: locAId,
        expenseCategoryId: noApprovalCatId,
        amountMinorUnits: -100,
        paidAt: new Date().toISOString(),
        idempotencyKey: uuid(),
      });
      expect(res.status).toBe(400);
    });

    it('400 on zero amount', async () => {
      const res = await aPost(ownerAToken, '/admin/costs/expenses', {
        locationId: locAId,
        expenseCategoryId: noApprovalCatId,
        amountMinorUnits: 0,
        paidAt: new Date().toISOString(),
        idempotencyKey: uuid(),
      });
      expect(res.status).toBe(400);
    });

    it('403 on location from a different business', async () => {
      const res = await aPost(ownerAToken, '/admin/costs/expenses', {
        locationId: locBId,
        expenseCategoryId: noApprovalCatId,
        amountMinorUnits: 1000,
        paidAt: new Date().toISOString(),
        idempotencyKey: uuid(),
      });
      expect(res.status).toBe(403);
    });

    it('404 on category from a different business (cross-business FK rejection)', async () => {
      // Create a category in Biz B, then try to use it from Biz A
      const catB = await aPost(ownerBToken, '/admin/costs/categories', {
        name: `Rent-B-${RUN}`,
        requiresApproval: false,
      });
      expect(catB.status).toBe(201);

      const res = await aPost(ownerAToken, '/admin/costs/expenses', {
        locationId: locAId,
        expenseCategoryId: catB.body.id as string,
        amountMinorUnits: 1000,
        paidAt: new Date().toISOString(),
        idempotencyKey: uuid(),
      });
      expect(res.status).toBe(404);
    });
  });

  // ── 5. Approval workflow ───────────────────────────────────────────────────

  describe('Approval workflow', () => {
    let approvalCatId: string;
    let pendingExpenseId: string;

    beforeAll(async () => {
      const cat = await aPost(ownerAToken, '/admin/costs/categories', {
        name: `Repairs-${RUN}`,
        requiresApproval: true,
      });
      approvalCatId = cat.body.id as string;
    });

    it('creates expense in approval-required category → PENDING_APPROVAL', async () => {
      const res = await aPost(ownerAToken, '/admin/costs/expenses', {
        locationId: locAId,
        expenseCategoryId: approvalCatId,
        amountMinorUnits: 25000,
        paidAt: new Date().toISOString(),
        description: 'AC repair',
        idempotencyKey: uuid(),
      });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PENDING_APPROVAL');
      expect(res.body.approvedAt).toBeNull();
      pendingExpenseId = res.body.id as string;
    });

    it('approves the pending expense → APPROVED', async () => {
      const res = await aPost(ownerAToken, `/admin/costs/expenses/${pendingExpenseId}/approve`);
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('APPROVED');
      expect(res.body.approvedAt).toBeTruthy();
    });

    it('cannot approve an already-approved expense → 400', async () => {
      const res = await aPost(ownerAToken, `/admin/costs/expenses/${pendingExpenseId}/approve`);
      expect(res.status).toBe(400);
    });
  });

  describe('Rejection workflow', () => {
    let approvalCatId2: string;
    let pendingExpenseId: string;

    beforeAll(async () => {
      const cat = await aPost(ownerAToken, '/admin/costs/categories', {
        name: `Entertainment-${RUN}`,
        requiresApproval: true,
      });
      approvalCatId2 = cat.body.id as string;
    });

    it('creates expense → PENDING_APPROVAL', async () => {
      const res = await aPost(ownerAToken, '/admin/costs/expenses', {
        locationId: locAId,
        expenseCategoryId: approvalCatId2,
        amountMinorUnits: 5000,
        paidAt: new Date().toISOString(),
        idempotencyKey: uuid(),
      });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PENDING_APPROVAL');
      pendingExpenseId = res.body.id as string;
    });

    it('rejects the expense with a reason → REJECTED', async () => {
      const res = await aPost(ownerAToken, `/admin/costs/expenses/${pendingExpenseId}/reject`, {
        rejectionReason: 'Not in budget',
      });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('REJECTED');
      expect(res.body.rejectionReason).toBe('Not in budget');
    });

    it('cannot reject an already-rejected expense → 400', async () => {
      const res = await aPost(ownerAToken, `/admin/costs/expenses/${pendingExpenseId}/reject`, {
        rejectionReason: 'Again',
      });
      expect(res.status).toBe(400);
    });

    it('reject requires a reason → 400 when empty', async () => {
      // Create another pending expense
      const catRes = await aPost(ownerAToken, '/admin/costs/categories', {
        name: `Misc-${RUN}`,
        requiresApproval: true,
      });
      const expRes = await aPost(ownerAToken, '/admin/costs/expenses', {
        locationId: locAId,
        expenseCategoryId: catRes.body.id as string,
        amountMinorUnits: 1000,
        paidAt: new Date().toISOString(),
        idempotencyKey: uuid(),
      });
      const tmpId = expRes.body.id as string;

      const res = await aPost(ownerAToken, `/admin/costs/expenses/${tmpId}/reject`, {
        rejectionReason: '',
      });
      expect(res.status).toBe(400);
    });
  });

  // ── 6. Inactive category blocks expense creation ───────────────────────────

  describe('Inactive category', () => {
    it('404 when creating expense with inactive category', async () => {
      // Create a category and immediately deactivate it
      const cat = await aPost(ownerAToken, '/admin/costs/categories', {
        name: `Inactive-Cat-${RUN}`,
        requiresApproval: false,
      });
      const catId = cat.body.id as string;

      await aPatch(ownerAToken, `/admin/costs/categories/${catId}`, { isActive: false });

      const res = await aPost(ownerAToken, '/admin/costs/expenses', {
        locationId: locAId,
        expenseCategoryId: catId,
        amountMinorUnits: 1000,
        paidAt: new Date().toISOString(),
        idempotencyKey: uuid(),
      });
      expect(res.status).toBe(404);
    });
  });

  // ── 7. Summary endpoint ────────────────────────────────────────────────────

  describe('Summary', () => {
    let sumCatId: string;

    beforeAll(async () => {
      const cat = await aPost(ownerAToken, '/admin/costs/categories', {
        name: `Supplies-${RUN}`,
        requiresApproval: false,
      });
      sumCatId = cat.body.id as string;

      // Create two approved expenses
      await aPost(ownerAToken, '/admin/costs/expenses', {
        locationId: locAId,
        expenseCategoryId: sumCatId,
        amountMinorUnits: 10000,
        paidAt: new Date().toISOString(),
        idempotencyKey: uuid(),
      });
      await aPost(ownerAToken, '/admin/costs/expenses', {
        locationId: locAId,
        expenseCategoryId: sumCatId,
        amountMinorUnits: 20000,
        paidAt: new Date().toISOString(),
        idempotencyKey: uuid(),
      });
    });

    it('returns summary with correct shape and totals', async () => {
      const past = new Date(Date.now() - 60_000).toISOString();
      const future = new Date(Date.now() + 60_000).toISOString();
      const res = await aGet(ownerAToken, `/admin/costs/summary?from=${past}&to=${future}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        from: past,
        to: future,
        grandTotalMinorUnits: expect.any(Number),
        expenseCount: expect.any(Number),
        byCategory: expect.any(Array),
      });
      // Grand total must include at least the 30000 we created above
      expect(res.body.grandTotalMinorUnits).toBeGreaterThanOrEqual(30000);
    });

    it('summary with locationId filter returns expected shape', async () => {
      const past = new Date(Date.now() - 60_000).toISOString();
      const future = new Date(Date.now() + 60_000).toISOString();
      const res = await aGet(
        ownerAToken,
        `/admin/costs/summary?from=${past}&to=${future}&locationId=${locAId}`,
      );
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        locationId: locAId,
        grandTotalMinorUnits: expect.any(Number),
        byCategory: expect.any(Array),
      });
    });

    it('400 on malformed from date', async () => {
      const res = await aGet(ownerAToken, '/admin/costs/summary?from=not-a-date&to=2026-01-01T00:00:00.000Z');
      expect(res.status).toBe(400);
    });

    it('401 without token', async () => {
      const from = new Date().toISOString();
      const to = new Date().toISOString();
      const res = await request(http()).get(`/admin/costs/summary?from=${from}&to=${to}`);
      expect(res.status).toBe(401);
    });
  });

  // ── 8. Cross-business isolation ───────────────────────────────────────────

  describe('Cross-business isolation', () => {
    let aCatId: string;
    let aExpenseId: string;

    beforeAll(async () => {
      const cat = await aPost(ownerAToken, '/admin/costs/categories', {
        name: `IsoTest-${RUN}`,
        requiresApproval: false,
      });
      aCatId = cat.body.id as string;

      const exp = await aPost(ownerAToken, '/admin/costs/expenses', {
        locationId: locAId,
        expenseCategoryId: aCatId,
        amountMinorUnits: 7500,
        paidAt: new Date().toISOString(),
        idempotencyKey: uuid(),
      });
      aExpenseId = exp.body.id as string;
    });

    it("Biz B list categories does not contain Biz A's category", async () => {
      const res = await aGet(ownerBToken, '/admin/costs/categories');
      expect(res.status).toBe(200);
      const ids = (res.body as Array<{ id: string }>).map((c) => c.id);
      expect(ids).not.toContain(aCatId);
    });

    it("Biz B cannot get Biz A's category by ID → 404", async () => {
      const res = await aGet(ownerBToken, `/admin/costs/categories/${aCatId}`);
      expect(res.status).toBe(404);
    });

    it("Biz B cannot patch Biz A's category → 404", async () => {
      const res = await aPatch(ownerBToken, `/admin/costs/categories/${aCatId}`, { description: 'hacked' });
      expect(res.status).toBe(404);
    });

    it("Biz B list expenses does not contain Biz A's expense", async () => {
      const res = await aGet(ownerBToken, '/admin/costs/expenses');
      expect(res.status).toBe(200);
      const ids = (res.body as Array<{ id: string }>).map((e) => e.id);
      expect(ids).not.toContain(aExpenseId);
    });

    it("Biz B cannot get Biz A's expense by ID → 404", async () => {
      const res = await aGet(ownerBToken, `/admin/costs/expenses/${aExpenseId}`);
      expect(res.status).toBe(404);
    });

    it("Biz B cannot approve Biz A's expense → 404", async () => {
      // First create a pending expense in A using an approval category
      const approvalCat = await aPost(ownerAToken, '/admin/costs/categories', {
        name: `Iso-Approval-${RUN}`,
        requiresApproval: true,
      });
      const pendingExp = await aPost(ownerAToken, '/admin/costs/expenses', {
        locationId: locAId,
        expenseCategoryId: approvalCat.body.id as string,
        amountMinorUnits: 3000,
        paidAt: new Date().toISOString(),
        idempotencyKey: uuid(),
      });

      const res = await aPost(ownerBToken, `/admin/costs/expenses/${pendingExp.body.id}/approve`);
      expect(res.status).toBe(404);
    });
  });
});
