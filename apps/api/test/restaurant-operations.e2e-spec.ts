import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';

jest.setTimeout(120_000);

/**
 * Phase 8 — Restaurant Operations E2E suite.
 *
 * Coverage:
 *   - Production areas: CRUD, location scoping, cross-tenant isolation
 *   - Guest sessions: open, update, close, void, table state transitions
 *   - Service requests: full state machine DRAFT→SENT→ACCEPTED→PREPARING→READY→SERVED
 *   - Idempotency: duplicate idempotencyKey returns existing request (no error)
 *   - Optimistic concurrency: version conflict returns 409 VERSION_CONFLICT
 *   - Line cancel: individual line cancel; auto-cancel request when all lines cancelled
 *   - Booking → seat: seatBooking creates session + marks booking SEATED
 *   - Module gating: routes return 403 MODULE_DISABLED when module not ACTIVE
 *   - Cross-business isolation: Biz B cannot read Biz A's sessions/orders (404)
 *   - businessId always from JWT, never from URL
 */
describe('Restaurant Operations — Phase 8 (e2e)', () => {
  let app: INestApplication;
  let platformToken: string;

  // Business A — primary test tenant
  let bizAId: string;
  let ownerAToken: string;
  let locAId: string;

  // Business B — isolation tests
  let bizBId: string;
  let ownerBToken: string;
  let locBId: string;

  // Catalog fixtures for Biz A
  let catalogItemId: string;
  let variantId: string;
  let modOptionId: string;

  // Dining fixtures for Biz A
  let diningAreaId: string;
  let tableId: string;

  // Staff fixture for Biz A
  let staffId: string;

  // Guest fixture for Biz A
  let guestId: string;

  const RUN = Date.now().toString(36);

  // Shared session id across describe blocks (via global to survive jest scoping)
  let sharedSessionId: string;

  const http = () => app.getHttpServer();

  const pPost = (path: string, body: object = {}) =>
    request(http()).post(path).set('authorization', `Bearer ${platformToken}`).send(body);

  const aGet = (tok: string, path: string) =>
    request(http()).get(path).set('authorization', `Bearer ${tok}`);

  const aPost = (tok: string, path: string, body: object = {}) =>
    request(http()).post(path).set('authorization', `Bearer ${tok}`).send(body);

  const aPatch = (tok: string, path: string, body: object) =>
    request(http()).patch(path).set('authorization', `Bearer ${tok}`).send(body);

  const aDelete = (tok: string, path: string) =>
    request(http()).delete(path).set('authorization', `Bearer ${tok}`);

  const provisionOwner = async (bizId: string, suffix: string): Promise<string> => {
    const email = `owner-p8-${suffix}-${RUN}@test.local`;
    const pw = 'Test!Password1';
    const provRes = await pPost(`/internal/businesses/${bizId}/provision`, {
      email,
      displayName: `Owner ${suffix}`,
      password: pw,
    });
    expect(provRes.status).toBe(201);
    const loginRes = await request(http()).post('/auth/login').send({ email, password: pw });
    expect(loginRes.status).toBe(200);
    return loginRes.body.accessToken as string;
  };

  const mkLoc = async (bizId: string, suffix = ''): Promise<string> => {
    const res = await pPost(`/internal/businesses/${bizId}/locations`, {
      name: `Loc${suffix} ${RUN}`.trim(),
      timezone: 'Asia/Kolkata',
    });
    expect(res.status).toBe(201);
    return res.body.id as string;
  };

  const activateModule = async (bizId: string, moduleKey: string): Promise<void> => {
    const activateRes = await pPost(`/internal/businesses/${bizId}/modules/${moduleKey}/activate`);
    if (activateRes.status !== 201 && activateRes.status !== 409) {
      throw new Error(`activate ${moduleKey} failed: ${activateRes.status}`);
    }
    const setupRes = await pPost(`/internal/businesses/${bizId}/modules/${moduleKey}/complete-setup`);
    if (setupRes.status !== 200 && setupRes.status !== 201) {
      throw new Error(`complete-setup ${moduleKey} failed: ${setupRes.status} ${JSON.stringify(setupRes.body)}`);
    }
  };

  const mkTable = async (areaId: string, locId: string, code: string): Promise<string> => {
    const res = await aPost(ownerAToken, '/admin/dining/tables', {
      diningAreaId: areaId,
      locationId: locId,
      code,
      capacity: 4,
      isActive: true,
    });
    expect(res.status).toBe(201);
    return res.body.id as string;
  };

  const freshKey = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    applyHttpDefaults(app);
    await app.init();

    const loginRes = await request(http()).post('/auth/login').send({
      email: process.env.PLATFORM_BOOTSTRAP_EMAIL ?? 'platform@manhar.local',
      password: process.env.PLATFORM_BOOTSTRAP_PASSWORD ?? 'ChangeMe!Dev12345',
    });
    expect(loginRes.status).toBe(200);
    platformToken = loginRes.body.accessToken as string;

    // ── Business A setup ─────────────────────────────────────────────────────────
    const bizARes = await pPost('/internal/businesses', {
      name: `P8 BizA ${RUN}`,
      businessTypeKey: 'restaurant',
    });
    expect(bizARes.status).toBe(201);
    bizAId = bizARes.body.id as string;
    ownerAToken = await provisionOwner(bizAId, 'A');
    locAId = await mkLoc(bizAId, 'A');
    await activateModule(bizAId, 'restaurant');
    await activateModule(bizAId, 'catalog');

    // ── Business B setup (isolation) ─────────────────────────────────────────────
    const bizBRes = await pPost('/internal/businesses', {
      name: `P8 BizB ${RUN}`,
      businessTypeKey: 'restaurant',
    });
    expect(bizBRes.status).toBe(201);
    bizBId = bizBRes.body.id as string;
    ownerBToken = await provisionOwner(bizBId, 'B');
    locBId = await mkLoc(bizBId, 'B');
    await activateModule(bizBId, 'restaurant');
    await activateModule(bizBId, 'catalog');

    // ── Catalog fixtures for Biz A ───────────────────────────────────────────────
    const taxRes = await aPost(ownerAToken, '/admin/catalog/tax-categories', {
      name: `GST ${RUN}`, rate: 0.05, isDefault: true, isActive: true,
    });
    expect(taxRes.status).toBe(201);
    const taxCatId = taxRes.body.id as string;

    const catRes = await aPost(ownerAToken, '/admin/catalog/categories', {
      name: `Main ${RUN}`, isActive: true, sortOrder: 0,
    });
    expect(catRes.status).toBe(201);
    const categoryId = catRes.body.id as string;

    const itemRes = await aPost(ownerAToken, '/admin/catalog/items', {
      categoryId,
      taxCategoryId: taxCatId,
      name: `Burger ${RUN}`,
      basePriceMinorUnits: 25000,
      isActive: true,
      isAvailable: true,
      sortOrder: 0,
    });
    expect(itemRes.status).toBe(201);
    catalogItemId = itemRes.body.id as string;

    const varRes = await aPost(ownerAToken, `/admin/catalog/items/${catalogItemId}/variants`, {
      name: 'Large',
      priceAdjMinorUnits: 5000,
      isAvailable: true,
      sortOrder: 0,
    });
    expect(varRes.status).toBe(201);
    variantId = varRes.body.id as string;

    const mgRes = await aPost(ownerAToken, '/admin/catalog/modifier-groups', {
      name: `Extras ${RUN}`,
      selectionType: 'MULTIPLE',
      isRequired: false,
      minSelections: 0,
      isActive: true,
      sortOrder: 0,
    });
    expect(mgRes.status).toBe(201);
    const modGroupId = mgRes.body.id as string;

    const moRes = await aPost(ownerAToken, `/admin/catalog/modifier-groups/${modGroupId}/options`, {
      name: 'Extra Cheese',
      priceAdjMinorUnits: 2000,
      isDefault: false,
      isAvailable: true,
      sortOrder: 0,
    });
    expect(moRes.status).toBe(201);
    modOptionId = moRes.body.id as string;

    // Add-ons are offered per item: the server only accepts options from groups
    // linked to the ordered item, so link the group as a real menu would.
    const linkRes = await aPost(ownerAToken, `/admin/catalog/items/${catalogItemId}/modifier-groups`, {
      modifierGroupId: modGroupId,
      sortOrder: 0,
    });
    expect(linkRes.status).toBe(201);

    // ── Dining fixtures for Biz A ────────────────────────────────────────────────
    const areaRes = await aPost(ownerAToken, '/admin/dining/areas', {
      locationId: locAId,
      name: `Hall ${RUN}`,
      isActive: true,
      sortOrder: 0,
    });
    expect(areaRes.status).toBe(201);
    diningAreaId = areaRes.body.id as string;

    tableId = await mkTable(diningAreaId, locAId, `T1-${RUN}`);

    // ── Staff fixture for Biz A ──────────────────────────────────────────────────
    const staffRes = await aPost(ownerAToken, '/admin/staff', {
      displayName: `Waiter ${RUN}`,
      roleTag: 'waiter',
      isActive: true,
    });
    expect(staffRes.status).toBe(201);
    staffId = staffRes.body.id as string;

    // ── Guest fixture for Biz A ──────────────────────────────────────────────────
    const guestRes = await aPost(ownerAToken, '/admin/guests', {
      displayName: `Guest ${RUN}`,
    });
    expect(guestRes.status).toBe(201);
    guestId = guestRes.body.id as string;
  });

  afterAll(async () => {
    await app.close();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Production Areas
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Production Areas', () => {
    let prodAreaId: string;

    it('creates a production area', async () => {
      const res = await aPost(ownerAToken, '/admin/catalog/production-areas', {
        locationId: locAId,
        name: `Grill ${RUN}`,
        isActive: true,
        sortOrder: 0,
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toMatch(/Grill/);
      expect(res.body.locationId).toBe(locAId);
      prodAreaId = res.body.id as string;
    });

    it('lists production areas', async () => {
      const res = await aGet(ownerAToken, '/admin/catalog/production-areas');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((a: { id: string }) => a.id === prodAreaId)).toBe(true);
    });

    it('filters by locationId', async () => {
      const res = await aGet(ownerAToken, `/admin/catalog/production-areas?locationId=${locAId}`);
      expect(res.status).toBe(200);
      expect(res.body.every((a: { locationId: string }) => a.locationId === locAId)).toBe(true);
    });

    it('updates a production area', async () => {
      const res = await aPatch(ownerAToken, `/admin/catalog/production-areas/${prodAreaId}`, {
        name: `Grill Updated ${RUN}`,
      });
      expect(res.status).toBe(200);
      expect(res.body.name).toMatch(/Updated/);
    });

    it('rejects production area from a foreign location', async () => {
      const res = await aPost(ownerAToken, '/admin/catalog/production-areas', {
        locationId: locBId,
        name: `Foreign ${RUN}`,
        isActive: true,
        sortOrder: 0,
      });
      expect(res.status).toBe(404);
    });

    it('cross-tenant: Biz B cannot read Biz A production area', async () => {
      const res = await aGet(ownerBToken, `/admin/catalog/production-areas/${prodAreaId}`);
      expect(res.status).toBe(404);
    });

    it('deletes a production area', async () => {
      const toDelete = await aPost(ownerAToken, '/admin/catalog/production-areas', {
        locationId: locAId,
        name: `ToDelete ${RUN}`,
        isActive: true,
        sortOrder: 99,
      });
      expect(toDelete.status).toBe(201);
      const delRes = await aDelete(ownerAToken, `/admin/catalog/production-areas/${toDelete.body.id}`);
      expect(delRes.status).toBe(204);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Guest Sessions — lifecycle
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Guest Sessions — lifecycle', () => {
    it('opens a session (table AVAILABLE → OCCUPIED)', async () => {
      const res = await aPost(ownerAToken, '/admin/sessions', {
        locationId: locAId,
        diningTableId: tableId,
        partySize: 2,
        guestId,
        assignedStaffId: staffId,
        notes: 'Window seat preferred',
      });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('OPEN');
      expect(res.body.diningTableId).toBe(tableId);
      sharedSessionId = res.body.id as string;
    });

    it('table is OCCUPIED — second open attempt returns 409', async () => {
      const t2 = await mkTable(diningAreaId, locAId, `T-busy-${RUN}`);

      const s1 = await aPost(ownerAToken, '/admin/sessions', {
        locationId: locAId,
        diningTableId: t2,
        partySize: 1,
      });
      expect(s1.status).toBe(201);

      const s2 = await aPost(ownerAToken, '/admin/sessions', {
        locationId: locAId,
        diningTableId: t2,
        partySize: 1,
      });
      expect(s2.status).toBe(409);

      // Void to clean up (no orders yet)
      await aPost(ownerAToken, `/admin/sessions/${s1.body.id}/void`, { reason: 'cleanup' });
    });

    it('lists sessions', async () => {
      const res = await aGet(ownerAToken, '/admin/sessions');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((s: { id: string }) => s.id === sharedSessionId)).toBe(true);
    });

    it('fetches a session by id', async () => {
      const res = await aGet(ownerAToken, `/admin/sessions/${sharedSessionId}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(sharedSessionId);
    });

    it('updates session partySize', async () => {
      const res = await aPatch(ownerAToken, `/admin/sessions/${sharedSessionId}`, {
        partySize: 3,
        notes: 'Updated notes',
      });
      expect(res.status).toBe(200);
      expect(res.body.partySize).toBe(3);
    });

    it('cross-tenant: Biz B cannot read Biz A session', async () => {
      const res = await aGet(ownerBToken, `/admin/sessions/${sharedSessionId}`);
      expect(res.status).toBe(404);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Service Requests — full state machine
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Service Requests — state machine', () => {
    let requestId: string;
    let lineId: string;

    it('creates a DRAFT request with line + variant + modifier', async () => {
      const res = await aPost(ownerAToken, '/admin/orders', {
        sessionId: sharedSessionId,
        idempotencyKey: freshKey(),
        notes: 'No onions',
        lines: [
          {
            catalogItemId,
            variantId,
            quantity: 1,
            kitchenNote: 'Extra crispy',
            modifiers: [{ modifierOptionId: modOptionId }],
          },
        ],
      });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('DRAFT');
      expect(res.body.lines).toHaveLength(1);
      requestId = res.body.id as string;
      lineId = res.body.lines[0].id as string;
    });

    it('snapshots item name and price at draft time', async () => {
      const res = await aGet(ownerAToken, `/admin/orders/${requestId}`);
      expect(res.status).toBe(200);
      const line = res.body.lines[0];
      expect(line.itemNameSnapshot).toMatch(/Burger/);
      expect(line.variantNameSnapshot).toBe('Large');
      expect(line.unitPriceMinorUnits).toBe(25000 + 5000 + 2000);
      expect(line.modifiers).toHaveLength(1);
      expect(line.modifiers[0].optionNameSnapshot).toBe('Extra Cheese');
    });

    it('idempotency: duplicate idempotencyKey returns same request', async () => {
      const key = freshKey();
      const r1 = await aPost(ownerAToken, '/admin/orders', {
        sessionId: sharedSessionId,
        idempotencyKey: key,
        lines: [{ catalogItemId, quantity: 1, modifiers: [] }],
      });
      expect(r1.status).toBe(201);

      const r2 = await aPost(ownerAToken, '/admin/orders', {
        sessionId: sharedSessionId,
        idempotencyKey: key,
        lines: [{ catalogItemId, quantity: 99, modifiers: [] }],
      });
      expect(r2.status).toBe(201);
      expect(r2.body.id).toBe(r1.body.id);
    });

    it('adds a second line to the DRAFT', async () => {
      const res = await aPost(ownerAToken, `/admin/orders/${requestId}/lines`, {
        lines: [{ catalogItemId, quantity: 2, notes: 'Extra sauce', modifiers: [] }],
      });
      expect(res.status).toBe(201);
      expect(res.body.lines).toHaveLength(2);
    });

    it('updates a line quantity', async () => {
      const res = await request(http())
        .patch(`/admin/orders/${requestId}/lines/${lineId}`)
        .set('authorization', `Bearer ${ownerAToken}`)
        .send({ quantity: 3 });
      expect(res.status).toBe(200);
      const updated = res.body.lines.find((l: { id: string; quantity: number }) => l.id === lineId);
      expect(updated.quantity).toBe(3);
    });

    it('rejects removing the last active line', async () => {
      const single = await aPost(ownerAToken, '/admin/orders', {
        sessionId: sharedSessionId,
        idempotencyKey: freshKey(),
        lines: [{ catalogItemId, quantity: 1, modifiers: [] }],
      });
      expect(single.status).toBe(201);
      const singleLineId = single.body.lines[0].id as string;

      const delRes = await aDelete(ownerAToken, `/admin/orders/${single.body.id}/lines/${singleLineId}`);
      expect(delRes.status).toBe(400);
      expect(delRes.body.error.code).toBe('VALIDATION');
    });

    it('version conflict returns 409 VERSION_CONFLICT', async () => {
      const res = await request(http())
        .patch(`/admin/orders/${requestId}/lines/${lineId}`)
        .set('authorization', `Bearer ${ownerAToken}`)
        .send({ quantity: 5, expectedVersion: 0 });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('VERSION_CONFLICT');
    });

    it('sends DRAFT → SENT (allocates requestNumber)', async () => {
      const res = await aPost(ownerAToken, `/admin/orders/${requestId}/send`, {});
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('SENT');
      expect(res.body.requestNumber).toBeTruthy();
      expect(res.body.sentAt).toBeTruthy();
    });

    it('cannot send a SENT request again', async () => {
      const res = await aPost(ownerAToken, `/admin/orders/${requestId}/send`, {});
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION');
    });

    it('lists SENT request in kitchen queue', async () => {
      const res = await aGet(ownerAToken, '/admin/kitchen');
      expect(res.status).toBe(200);
      expect(res.body.some((r: { id: string }) => r.id === requestId)).toBe(true);
    });

    it('kitchen accepts: SENT → ACCEPTED', async () => {
      const res = await aPost(ownerAToken, `/admin/kitchen/${requestId}/accept`, {});
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ACCEPTED');
    });

    it('kitchen starts preparation: ACCEPTED → PREPARING', async () => {
      const res = await aPost(ownerAToken, `/admin/kitchen/${requestId}/prepare`, {});
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PREPARING');
    });

    it('kitchen marks ready: PREPARING → READY', async () => {
      const res = await aPost(ownerAToken, `/admin/kitchen/${requestId}/ready`, {});
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('READY');
    });

    it('staff marks served: READY → SERVED', async () => {
      const res = await aPost(ownerAToken, `/admin/orders/${requestId}/serve`, {});
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('SERVED');
    });

    it('cross-tenant: Biz B cannot read Biz A order', async () => {
      const res = await aGet(ownerBToken, `/admin/orders/${requestId}`);
      expect(res.status).toBe(404);
    });

    it('cross-tenant: Biz B kitchen queue does not include Biz A requests', async () => {
      const res = await aGet(ownerBToken, '/admin/kitchen');
      expect(res.status).toBe(200);
      expect(res.body.some((r: { id: string }) => r.id === requestId)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Order cancellation
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Order cancellation', () => {
    it('cancels a DRAFT request', async () => {
      const draft = await aPost(ownerAToken, '/admin/orders', {
        sessionId: sharedSessionId,
        idempotencyKey: freshKey(),
        lines: [{ catalogItemId, quantity: 1, modifiers: [] }],
      });
      expect(draft.status).toBe(201);

      const res = await aPost(ownerAToken, `/admin/orders/${draft.body.id}/cancel`, {
        reason: 'Customer changed mind',
      });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('CANCELLED');
      expect(res.body.cancelReason).toBe('Customer changed mind');
    });

    it('auto-cancels request when last line is cancelled', async () => {
      const draft = await aPost(ownerAToken, '/admin/orders', {
        sessionId: sharedSessionId,
        idempotencyKey: freshKey(),
        lines: [{ catalogItemId, quantity: 1, modifiers: [] }],
      });
      expect(draft.status).toBe(201);
      const ordId = draft.body.id as string;
      const lnId = draft.body.lines[0].id as string;

      await aPost(ownerAToken, `/admin/orders/${ordId}/send`, {});

      const res = await aPost(ownerAToken, `/admin/orders/${ordId}/lines/${lnId}/cancel`, {
        reason: 'Out of stock',
      });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('CANCELLED');
    });

    it('cannot cancel a SERVED request', async () => {
      const t = await mkTable(diningAreaId, locAId, `T-cancel-${RUN}`);
      const sess = await aPost(ownerAToken, '/admin/sessions', {
        locationId: locAId,
        diningTableId: t,
        partySize: 1,
      });
      expect(sess.status).toBe(201);

      const ord = await aPost(ownerAToken, '/admin/orders', {
        sessionId: sess.body.id,
        idempotencyKey: freshKey(),
        lines: [{ catalogItemId, quantity: 1, modifiers: [] }],
      });
      expect(ord.status).toBe(201);
      const ordId = ord.body.id as string;

      await aPost(ownerAToken, `/admin/orders/${ordId}/send`, {});
      await aPost(ownerAToken, `/admin/kitchen/${ordId}/accept`, {});
      await aPost(ownerAToken, `/admin/kitchen/${ordId}/prepare`, {});
      await aPost(ownerAToken, `/admin/kitchen/${ordId}/ready`, {});
      await aPost(ownerAToken, `/admin/orders/${ordId}/serve`, {});

      const cancelRes = await aPost(ownerAToken, `/admin/orders/${ordId}/cancel`, {
        reason: 'Too late',
      });
      expect(cancelRes.status).toBe(400);
      expect(cancelRes.body.error.code).toBe('VALIDATION');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Session close and table reset
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Session close and table reset', () => {
    it('closes the session (table → CLEANING)', async () => {
      const res = await aPost(ownerAToken, `/admin/sessions/${sharedSessionId}/close`, {
        notes: 'All served',
      });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('CLOSED');
    });

    it('cannot close an already CLOSED session', async () => {
      const res = await aPost(ownerAToken, `/admin/sessions/${sharedSessionId}/close`, {});
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION');
    });

    it('resets table: CLEANING → AVAILABLE', async () => {
      const res = await aPost(ownerAToken, `/admin/dining/tables/${tableId}/reset`, {});
      expect(res.status).toBe(204);
    });

    it('can open a new session on the reset table', async () => {
      const res = await aPost(ownerAToken, '/admin/sessions', {
        locationId: locAId,
        diningTableId: tableId,
        partySize: 2,
      });
      expect(res.status).toBe(201);
      await aPost(ownerAToken, `/admin/sessions/${res.body.id}/void`, { reason: 'cleanup' });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Session void
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Session void', () => {
    it('voids a session with no confirmed requests (table → AVAILABLE)', async () => {
      const t = await mkTable(diningAreaId, locAId, `T-void-${RUN}`);
      const sess = await aPost(ownerAToken, '/admin/sessions', {
        locationId: locAId,
        diningTableId: t,
        partySize: 1,
      });
      expect(sess.status).toBe(201);

      const res = await aPost(ownerAToken, `/admin/sessions/${sess.body.id}/void`, {
        reason: 'Wrong table',
      });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('VOID');
    });

    it('cannot void a session with a SENT request', async () => {
      const t = await mkTable(diningAreaId, locAId, `T-voidno-${RUN}`);
      const sess = await aPost(ownerAToken, '/admin/sessions', {
        locationId: locAId,
        diningTableId: t,
        partySize: 1,
      });
      expect(sess.status).toBe(201);

      const ord = await aPost(ownerAToken, '/admin/orders', {
        sessionId: sess.body.id,
        idempotencyKey: freshKey(),
        lines: [{ catalogItemId, quantity: 1, modifiers: [] }],
      });
      expect(ord.status).toBe(201);
      await aPost(ownerAToken, `/admin/orders/${ord.body.id}/send`, {});

      const res = await aPost(ownerAToken, `/admin/sessions/${sess.body.id}/void`, {
        reason: 'Should fail',
      });
      expect(res.status).toBe(409);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Booking seat flow
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Booking seat flow', () => {
    it('seats a booking: creates session + marks booking SEATED', async () => {
      const t = await mkTable(diningAreaId, locAId, `T-bk-${RUN}`);

      const booking = await aPost(ownerAToken, '/admin/bookings', {
        locationId: locAId,
        guestId,
        partySize: 2,
        scheduledAt: new Date(Date.now() + 3_600_000).toISOString(),
        notes: 'Anniversary dinner',
      });
      expect(booking.status).toBe(201);
      const bookingId = booking.body.id as string;

      const res = await aPost(ownerAToken, `/admin/sessions/bookings/${bookingId}/seat`, {
        diningTableId: t,
        assignedStaffId: staffId,
      });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('OPEN');
      expect(res.body.bookingId).toBe(bookingId);

      const bkRes = await aGet(ownerAToken, `/admin/bookings/${bookingId}`);
      expect(bkRes.status).toBe(200);
      expect(bkRes.body.status).toBe('SEATED');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Kitchen queue filters
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Kitchen queue', () => {
    it('lists kitchen queue showing only active statuses', async () => {
      const res = await aGet(ownerAToken, '/admin/kitchen');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const kitchenStatuses = new Set(['SENT', 'ACCEPTED', 'PREPARING', 'READY']);
      expect(res.body.every((r: { status: string }) => kitchenStatuses.has(r.status))).toBe(true);
    });

    it('filters kitchen queue by locationId', async () => {
      const res = await aGet(ownerAToken, `/admin/kitchen?locationId=${locAId}`);
      expect(res.status).toBe(200);
      expect(res.body.every((r: { locationId: string }) => r.locationId === locAId)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Module gating
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Module gating', () => {
    let noModToken: string;

    beforeAll(async () => {
      const noModBiz = await pPost('/internal/businesses', {
        name: `P8 NoMod ${RUN}`,
        businessTypeKey: 'restaurant',
      });
      expect(noModBiz.status).toBe(201);
      noModToken = await provisionOwner(noModBiz.body.id as string, 'NoMod');
    });

    it('sessions returns 403 MODULE_DISABLED when restaurant not active', async () => {
      const res = await aGet(noModToken, '/admin/sessions');
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('MODULE_DISABLED');
    });

    it('orders returns 403 MODULE_DISABLED when restaurant not active', async () => {
      const res = await aGet(noModToken, '/admin/orders');
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('MODULE_DISABLED');
    });

    it('kitchen returns 403 MODULE_DISABLED when restaurant not active', async () => {
      const res = await aGet(noModToken, '/admin/kitchen');
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('MODULE_DISABLED');
    });

    it('production areas returns 403 MODULE_DISABLED when restaurant not active', async () => {
      const res = await aGet(noModToken, '/admin/catalog/production-areas');
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('MODULE_DISABLED');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Validation edge cases
  // ─────────────────────────────────────────────────────────────────────────────

  describe('Validation', () => {
    it('rejects session open with inactive table', async () => {
      const inactiveTbl = await aPost(ownerAToken, '/admin/dining/tables', {
        diningAreaId,
        locationId: locAId,
        code: `INACTIVE-${RUN}`,
        capacity: 2,
        isActive: false,
      });
      expect(inactiveTbl.status).toBe(201);

      const res = await aPost(ownerAToken, '/admin/sessions', {
        locationId: locAId,
        diningTableId: inactiveTbl.body.id,
        partySize: 1,
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION');
    });

    it('rejects order line with inactive catalog item', async () => {
      const catRes = await aPost(ownerAToken, '/admin/catalog/categories', {
        name: `Cat inactive ${RUN}`, isActive: true, sortOrder: 99,
      });
      expect(catRes.status).toBe(201);

      const inactiveItem = await aPost(ownerAToken, '/admin/catalog/items', {
        categoryId: catRes.body.id,
        name: `Inactive Item ${RUN}`,
        basePriceMinorUnits: 1000,
        isActive: false,
        isAvailable: true,
        sortOrder: 0,
      });
      expect(inactiveItem.status).toBe(201);

      const res = await aPost(ownerAToken, '/admin/orders', {
        sessionId: sharedSessionId,
        idempotencyKey: freshKey(),
        lines: [{ catalogItemId: inactiveItem.body.id, quantity: 1, modifiers: [] }],
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION');
    });

    it('rejects session open with table from different location', async () => {
      const loc2 = await mkLoc(bizAId, 'L2');
      const area2 = await aPost(ownerAToken, '/admin/dining/areas', {
        locationId: loc2,
        name: `Area2 ${RUN}`,
        isActive: true,
        sortOrder: 0,
      });
      expect(area2.status).toBe(201);
      const tbl2 = await aPost(ownerAToken, '/admin/dining/tables', {
        diningAreaId: area2.body.id,
        locationId: loc2,
        code: `TL2-${RUN}`,
        capacity: 2,
        isActive: true,
      });
      expect(tbl2.status).toBe(201);

      const res = await aPost(ownerAToken, '/admin/sessions', {
        locationId: locAId,       // locAId ≠ loc2
        diningTableId: tbl2.body.id,
        partySize: 1,
      });
      expect(res.status).toBe(404);
    });

    it('rejects order on a CLOSED session', async () => {
      const res = await aPost(ownerAToken, '/admin/orders', {
        sessionId: sharedSessionId, // already CLOSED
        idempotencyKey: freshKey(),
        lines: [{ catalogItemId, quantity: 1, modifiers: [] }],
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION');
    });
  });
});
