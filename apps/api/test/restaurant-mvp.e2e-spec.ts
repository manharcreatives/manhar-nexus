import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';

jest.setTimeout(90_000);

/**
 * Phase 7 — Restaurant MVP Foundation E2E suite.
 *
 * Coverage:
 *   - Catalog: tax categories, categories, items, variants, modifier groups + options, item↔group links
 *   - Dining: areas (location-scoped), tables (area-scoped)
 *   - People: staff profiles, guests
 *   - Bookings: CRUD + status transitions
 *   - Module gating: all routes return 403 MODULE_DISABLED when module is not ACTIVE
 *   - Cross-business isolation: Business B cannot read Business A's data (404 on every fetch)
 *   - businessId from JWT not URL (NEVER from route param)
 */
describe('Restaurant MVP — Phase 7 (e2e)', () => {
  let app: INestApplication;
  let platformToken: string;
  let bizAId: string;
  let ownerAToken: string;
  let locAId: string;
  let bizBId: string;
  let ownerBToken: string;
  let bizCId: string;
  let ownerCToken: string;

  const RUN = Date.now().toString(36);

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

  const mkLoc = async (bizId: string): Promise<string> => {
    const res = await pPost(`/internal/businesses/${bizId}/locations`, {
      name: `Loc ${RUN}`,
      timezone: 'Asia/Kolkata',
    });
    expect(res.status).toBe(201);
    return res.body.id as string;
  };

  const mkLoc2 = async (bizId: string, suffix: string): Promise<string> => {
    const res = await pPost(`/internal/businesses/${bizId}/locations`, {
      name: `Loc ${suffix} ${RUN}`,
      timezone: 'Asia/Kolkata',
    });
    expect(res.status).toBe(201);
    return res.body.id as string;
  };

  const activateModule = async (bizId: string, moduleKey: string): Promise<void> => {
    // activate → PENDING_SETUP (idempotent: 409 if already activated)
    const activateRes = await pPost(`/internal/businesses/${bizId}/modules/${moduleKey}/activate`);
    if (activateRes.status !== 201 && activateRes.status !== 409) {
      throw new Error(`activate ${moduleKey} failed: ${activateRes.status}`);
    }
    // complete-setup → ACTIVE (skips wizard step validation — platform endpoint bypasses)
    const setupRes = await pPost(`/internal/businesses/${bizId}/modules/${moduleKey}/complete-setup`);
    if (setupRes.status !== 200 && setupRes.status !== 201) {
      throw new Error(`complete-setup ${moduleKey} failed: ${setupRes.status} ${JSON.stringify(setupRes.body)}`);
    }
  };

  const provisionOwner = async (bizId: string, suffix: string): Promise<string> => {
    const email = `owner-p7-${suffix}-${RUN}@test.local`;
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
      });
    expect(loginRes.status).toBe(200);
    platformToken = loginRes.body.accessToken as string;

    // Business A — restaurant + catalog active
    const bizARes = await pPost('/internal/businesses', {
      name: `P7 Biz A ${RUN}`,
      businessTypeKey: 'restaurant',
    });
    expect(bizARes.status).toBe(201);
    bizAId = bizARes.body.id as string;
    ownerAToken = await provisionOwner(bizAId, 'A');
    locAId = await mkLoc(bizAId);
    await activateModule(bizAId, 'restaurant');
    await activateModule(bizAId, 'catalog');

    // Business B — restaurant + catalog active (isolation tests)
    const bizBRes = await pPost('/internal/businesses', {
      name: `P7 Biz B ${RUN}`,
      businessTypeKey: 'restaurant',
    });
    expect(bizBRes.status).toBe(201);
    bizBId = bizBRes.body.id as string;
    ownerBToken = await provisionOwner(bizBId, 'B');
    await mkLoc(bizBId);
    await activateModule(bizBId, 'restaurant');
    await activateModule(bizBId, 'catalog');

    // Business C — modules NOT activated (module gating tests)
    const bizCRes = await pPost('/internal/businesses', {
      name: `P7 Biz C ${RUN}`,
      businessTypeKey: 'restaurant',
    });
    expect(bizCRes.status).toBe(201);
    bizCId = bizCRes.body.id as string;
    ownerCToken = await provisionOwner(bizCId, 'C');
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Tax Categories ──────────────────────────────────────────────────────────────

  describe('Tax Categories', () => {
    let taxId: string;

    it('POST /admin/catalog/tax-categories → 201 with businessId', async () => {
      const res = await aPost(ownerAToken, '/admin/catalog/tax-categories', {
        name: 'GST 5%',
        rate: 0.05,
        isDefault: true,
      });
      taxId = res.body.id as string; // assign before assertions so later tests don't cascade-fail
      expect(res.status).toBe(201);
      expect(res.body.businessId).toBe(bizAId);
      // rate is serialized as a string (Prisma Decimal → toJSON() → "0.05")
      expect(parseFloat(String(res.body.rate))).toBeCloseTo(0.05);
    });

    it('GET /admin/catalog/tax-categories → only own business', async () => {
      const res = await aGet(ownerAToken, '/admin/catalog/tax-categories');
      expect(res.status).toBe(200);
      expect(res.body.every((t: { businessId: string }) => t.businessId === bizAId)).toBe(true);
    });

    it('PATCH /admin/catalog/tax-categories/:id → updates', async () => {
      const res = await aPatch(ownerAToken, `/admin/catalog/tax-categories/${taxId}`, { name: 'GST 5% v2' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('GST 5% v2');
    });

    it('cross-tenant: B cannot fetch A tax category → 404', async () => {
      expect((await aGet(ownerBToken, `/admin/catalog/tax-categories/${taxId}`)).status).toBe(404);
    });

    it('module gate: C (catalog not active) → 403 MODULE_DISABLED', async () => {
      const res = await aGet(ownerCToken, '/admin/catalog/tax-categories');
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('MODULE_DISABLED');
    });

    it('DELETE /admin/catalog/tax-categories/:id → 204', async () => {
      expect((await aDelete(ownerAToken, `/admin/catalog/tax-categories/${taxId}`)).status).toBe(204);
    });
  });

  // ── Catalog Categories ──────────────────────────────────────────────────────────

  describe('Catalog Categories', () => {
    let catId: string;

    it('POST /admin/catalog/categories → 201', async () => {
      const res = await aPost(ownerAToken, '/admin/catalog/categories', { name: 'Starters', sortOrder: 1 });
      expect(res.status).toBe(201);
      expect(res.body.businessId).toBe(bizAId);
      catId = res.body.id as string;
    });

    it('GET /admin/catalog/categories → list includes created', async () => {
      const res = await aGet(ownerAToken, '/admin/catalog/categories');
      expect(res.status).toBe(200);
      expect(res.body.some((c: { id: string }) => c.id === catId)).toBe(true);
    });

    it('PATCH /admin/catalog/categories/:id → updates name', async () => {
      const res = await aPatch(ownerAToken, `/admin/catalog/categories/${catId}`, { name: 'Starters & Salads' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Starters & Salads');
    });

    it('cross-tenant: B cannot fetch A category → 404', async () => {
      expect((await aGet(ownerBToken, `/admin/catalog/categories/${catId}`)).status).toBe(404);
    });

    it('DELETE /admin/catalog/categories/:id (has no items) → 204', async () => {
      expect((await aDelete(ownerAToken, `/admin/catalog/categories/${catId}`)).status).toBe(204);
    });
  });

  // ── Catalog Items ───────────────────────────────────────────────────────────────

  describe('Catalog Items', () => {
    let catId: string;
    let itemId: string;
    let variantId: string;

    beforeAll(async () => {
      const r = await aPost(ownerAToken, '/admin/catalog/categories', { name: `ItemCat ${RUN}` });
      catId = r.body.id as string;
    });

    it('POST /admin/catalog/items → 201 with businessId', async () => {
      const res = await aPost(ownerAToken, '/admin/catalog/items', {
        categoryId: catId,
        name: 'Paneer Tikka',
        basePriceMinorUnits: 24900,
      });
      expect(res.status).toBe(201);
      expect(res.body.businessId).toBe(bizAId);
      expect(res.body.basePriceMinorUnits).toBe(24900);
      itemId = res.body.id as string;
    });

    it('POST with cross-business categoryId → 400 (ValidationError)', async () => {
      const bCat = await aPost(ownerBToken, '/admin/catalog/categories', { name: 'B Cat' });
      const res = await aPost(ownerAToken, '/admin/catalog/items', {
        categoryId: bCat.body.id,
        name: 'Cross Item',
        basePriceMinorUnits: 100,
      });
      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe('VALIDATION');
    });

    it('GET /admin/catalog/items?categoryId= → filters by category', async () => {
      const res = await aGet(ownerAToken, `/admin/catalog/items?categoryId=${catId}`);
      expect(res.status).toBe(200);
      expect(res.body.some((i: { id: string }) => i.id === itemId)).toBe(true);
    });

    it('cross-tenant: B cannot fetch A item → 404', async () => {
      expect((await aGet(ownerBToken, `/admin/catalog/items/${itemId}`)).status).toBe(404);
    });

    it('cross-tenant: B cannot update A item → 404', async () => {
      expect((await aPatch(ownerBToken, `/admin/catalog/items/${itemId}`, { name: 'Hijack' })).status).toBe(404);
    });

    it('POST variant → 201', async () => {
      const res = await aPost(ownerAToken, `/admin/catalog/items/${itemId}/variants`, {
        name: 'Half',
        priceAdjMinorUnits: -5000,
      });
      expect(res.status).toBe(201);
      expect(res.body.catalogItemId).toBe(itemId);
      variantId = res.body.id as string;
    });

    it('PATCH variant → 200', async () => {
      const res = await aPatch(ownerAToken, `/admin/catalog/items/${itemId}/variants/${variantId}`, {
        name: 'Half Portion',
      });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Half Portion');
    });

    it('cross-tenant: B cannot delete A variant → 404', async () => {
      expect((await aDelete(ownerBToken, `/admin/catalog/items/${itemId}/variants/${variantId}`)).status).toBe(404);
    });

    it('DELETE variant → 204', async () => {
      expect((await aDelete(ownerAToken, `/admin/catalog/items/${itemId}/variants/${variantId}`)).status).toBe(204);
    });

    it('module gate: C (catalog not active) → 403', async () => {
      const res = await aGet(ownerCToken, '/admin/catalog/items');
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('MODULE_DISABLED');
    });

    it('DELETE item → 204', async () => {
      expect((await aDelete(ownerAToken, `/admin/catalog/items/${itemId}`)).status).toBe(204);
    });
  });

  // ── Modifier Groups ─────────────────────────────────────────────────────────────

  describe('Modifier Groups', () => {
    let groupId: string;
    let optionId: string;
    let itemId: string;
    let catId: string;

    beforeAll(async () => {
      const catRes = await aPost(ownerAToken, '/admin/catalog/categories', { name: `MGCat ${RUN}` });
      catId = catRes.body.id as string;
      const itemRes = await aPost(ownerAToken, '/admin/catalog/items', {
        categoryId: catId,
        name: `MG Item ${RUN}`,
        basePriceMinorUnits: 10000,
      });
      itemId = itemRes.body.id as string;
    });

    it('POST /admin/catalog/modifier-groups → 201', async () => {
      const res = await aPost(ownerAToken, '/admin/catalog/modifier-groups', {
        name: 'Spice Level',
        selectionType: 'SINGLE',
        isRequired: true,
      });
      expect(res.status).toBe(201);
      expect(res.body.businessId).toBe(bizAId);
      groupId = res.body.id as string;
    });

    it('POST option → 201', async () => {
      const res = await aPost(ownerAToken, `/admin/catalog/modifier-groups/${groupId}/options`, {
        name: 'Mild',
        isDefault: true,
      });
      expect(res.status).toBe(201);
      optionId = res.body.id as string;
    });

    it('PATCH option → 200', async () => {
      const res = await aPatch(ownerAToken, `/admin/catalog/modifier-groups/${groupId}/options/${optionId}`, {
        name: 'Mild (default)',
      });
      expect(res.status).toBe(200);
    });

    it('cross-tenant: B cannot fetch A modifier group → 404', async () => {
      expect((await aGet(ownerBToken, `/admin/catalog/modifier-groups/${groupId}`)).status).toBe(404);
    });

    it('link modifier group to item → 201', async () => {
      expect((await aPost(ownerAToken, `/admin/catalog/items/${itemId}/modifier-groups`, {
        modifierGroupId: groupId,
        sortOrder: 0,
      })).status).toBe(201);
    });

    it('link same group again → 409 CONFLICT', async () => {
      expect((await aPost(ownerAToken, `/admin/catalog/items/${itemId}/modifier-groups`, {
        modifierGroupId: groupId,
        sortOrder: 0,
      })).status).toBe(409);
    });

    it('cross-tenant: B cannot link A item to A group → 404', async () => {
      expect((await aPost(ownerBToken, `/admin/catalog/items/${itemId}/modifier-groups`, {
        modifierGroupId: groupId,
        sortOrder: 0,
      })).status).toBe(404);
    });

    it('unlink → 204', async () => {
      expect((await aDelete(ownerAToken, `/admin/catalog/items/${itemId}/modifier-groups/${groupId}`)).status).toBe(204);
    });

    it('delete option → 204', async () => {
      expect((await aDelete(ownerAToken, `/admin/catalog/modifier-groups/${groupId}/options/${optionId}`)).status).toBe(204);
    });

    it('delete group → 204', async () => {
      expect((await aDelete(ownerAToken, `/admin/catalog/modifier-groups/${groupId}`)).status).toBe(204);
    });
  });

  // ── Dining Areas ────────────────────────────────────────────────────────────────

  describe('Dining Areas', () => {
    let areaId: string;

    it('POST /admin/dining/areas → 201 with locationId', async () => {
      const res = await aPost(ownerAToken, '/admin/dining/areas', {
        locationId: locAId,
        name: 'Main Hall',
        sortOrder: 1,
      });
      areaId = res.body.id as string; // assign before assertions
      expect(res.status).toBe(201);
      expect(res.body.businessId).toBe(bizAId);
      expect(res.body.locationId).toBe(locAId);
    });

    it('POST with cross-business locationId → 404', async () => {
      const bLoc = await mkLoc2(bizBId, 'CrossB');
      const res = await aPost(ownerAToken, '/admin/dining/areas', {
        locationId: bLoc,
        name: 'Cross Tenant Area',
      });
      expect(res.status).toBe(404);
    });

    it('GET /admin/dining/areas?locationId= → filters', async () => {
      const res = await aGet(ownerAToken, `/admin/dining/areas?locationId=${locAId}`);
      expect(res.status).toBe(200);
      expect(res.body.some((a: { id: string }) => a.id === areaId)).toBe(true);
    });

    it('cross-tenant: B cannot fetch A area → 404', async () => {
      expect((await aGet(ownerBToken, `/admin/dining/areas/${areaId}`)).status).toBe(404);
    });

    it('module gate: C (restaurant not active) → 403 MODULE_DISABLED', async () => {
      const res = await aGet(ownerCToken, '/admin/dining/areas');
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('MODULE_DISABLED');
    });

    it('PATCH /admin/dining/areas/:id → updates', async () => {
      const res = await aPatch(ownerAToken, `/admin/dining/areas/${areaId}`, { name: 'Main Hall Updated' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Main Hall Updated');
    });
  });

  // ── Dining Tables ───────────────────────────────────────────────────────────────

  describe('Dining Tables', () => {
    let areaId: string;
    let tableId: string;

    beforeAll(async () => {
      const r = await aPost(ownerAToken, '/admin/dining/areas', { locationId: locAId, name: `TblArea ${RUN}` });
      areaId = r.body.id as string;
    });

    it('POST /admin/dining/tables → 201 with status AVAILABLE', async () => {
      const res = await aPost(ownerAToken, '/admin/dining/tables', {
        diningAreaId: areaId,
        locationId: locAId,
        code: 'T1',
        capacity: 4,
      });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('AVAILABLE');
      expect(res.body.businessId).toBe(bizAId);
      tableId = res.body.id as string;
    });

    it('POST duplicate code in same area → 409', async () => {
      const res = await aPost(ownerAToken, '/admin/dining/tables', {
        diningAreaId: areaId,
        locationId: locAId,
        code: 'T1',
        capacity: 2,
      });
      expect(res.status).toBe(409);
    });

    it('PATCH → updates status to OCCUPIED', async () => {
      const res = await aPatch(ownerAToken, `/admin/dining/tables/${tableId}`, { status: 'OCCUPIED' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('OCCUPIED');
    });

    it('cross-tenant: B cannot fetch A table → 404', async () => {
      expect((await aGet(ownerBToken, `/admin/dining/tables/${tableId}`)).status).toBe(404);
    });

    it('DELETE → 204', async () => {
      expect((await aDelete(ownerAToken, `/admin/dining/tables/${tableId}`)).status).toBe(204);
    });
  });

  // ── Staff Profiles ──────────────────────────────────────────────────────────────

  describe('Staff Profiles', () => {
    let staffId: string;

    it('POST /admin/staff → 201 with businessId', async () => {
      const res = await aPost(ownerAToken, '/admin/staff', {
        displayName: 'Alice Waiter',
        roleTag: 'waiter',
      });
      expect(res.status).toBe(201);
      expect(res.body.businessId).toBe(bizAId);
      staffId = res.body.id as string;
    });

    it('GET /admin/staff → lists own staff', async () => {
      const res = await aGet(ownerAToken, '/admin/staff');
      expect(res.status).toBe(200);
      expect(res.body.some((s: { id: string }) => s.id === staffId)).toBe(true);
    });

    it('PATCH /admin/staff/:id → updates roleTag', async () => {
      const res = await aPatch(ownerAToken, `/admin/staff/${staffId}`, { roleTag: 'senior_waiter' });
      expect(res.status).toBe(200);
      expect(res.body.roleTag).toBe('senior_waiter');
    });

    it('cross-tenant: B cannot fetch A staff → 404', async () => {
      expect((await aGet(ownerBToken, `/admin/staff/${staffId}`)).status).toBe(404);
    });

    it('cross-tenant: B cannot update A staff → 404', async () => {
      expect((await aPatch(ownerBToken, `/admin/staff/${staffId}`, { roleTag: 'hijack' })).status).toBe(404);
    });

    it('module gate: C (restaurant not active) → 403 MODULE_DISABLED', async () => {
      const res = await aGet(ownerCToken, '/admin/staff');
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('MODULE_DISABLED');
    });

    it('DELETE → 204', async () => {
      expect((await aDelete(ownerAToken, `/admin/staff/${staffId}`)).status).toBe(204);
    });

    it('GET after delete → 404', async () => {
      expect((await aGet(ownerAToken, `/admin/staff/${staffId}`)).status).toBe(404);
    });
  });

  // ── Guests ──────────────────────────────────────────────────────────────────────

  describe('Guests', () => {
    let guestId: string;

    it('POST /admin/guests → 201 with businessId', async () => {
      const res = await aPost(ownerAToken, '/admin/guests', {
        displayName: 'Bob Guest',
        phone: '+91-9876543210',
        tags: ['vip', 'regular'],
      });
      expect(res.status).toBe(201);
      expect(res.body.businessId).toBe(bizAId);
      guestId = res.body.id as string;
    });

    it('GET /admin/guests → lists own guests', async () => {
      const res = await aGet(ownerAToken, '/admin/guests');
      expect(res.status).toBe(200);
      expect(res.body.some((g: { id: string }) => g.id === guestId)).toBe(true);
    });

    it('PATCH /admin/guests/:id → updates tags', async () => {
      const res = await aPatch(ownerAToken, `/admin/guests/${guestId}`, { tags: ['vip', 'loyal'] });
      expect(res.status).toBe(200);
    });

    it('cross-tenant: B cannot fetch A guest → 404', async () => {
      expect((await aGet(ownerBToken, `/admin/guests/${guestId}`)).status).toBe(404);
    });

    it('module gate: C (restaurant not active) → 403 MODULE_DISABLED', async () => {
      const res = await aGet(ownerCToken, '/admin/guests');
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('MODULE_DISABLED');
    });

    it('DELETE → 204', async () => {
      expect((await aDelete(ownerAToken, `/admin/guests/${guestId}`)).status).toBe(204);
    });
  });

  // ── Bookings ────────────────────────────────────────────────────────────────────

  describe('Bookings', () => {
    let bookingId: string;
    let guestId: string;
    let tableId: string;
    let areaId: string;

    beforeAll(async () => {
      const guestRes = await aPost(ownerAToken, '/admin/guests', { displayName: `Booking Guest ${RUN}` });
      guestId = guestRes.body.id as string;
      const areaRes = await aPost(ownerAToken, '/admin/dining/areas', {
        locationId: locAId,
        name: `BkgArea ${RUN}`,
      });
      areaId = areaRes.body.id as string;
      const tableRes = await aPost(ownerAToken, '/admin/dining/tables', {
        diningAreaId: areaId,
        locationId: locAId,
        code: `BT${RUN}`,
        capacity: 4,
      });
      tableId = tableRes.body.id as string;
    });

    it('POST /admin/bookings → 201 with status PENDING', async () => {
      const res = await aPost(ownerAToken, '/admin/bookings', {
        locationId: locAId,
        guestId,
        diningTableId: tableId,
        partySize: 3,
        scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
        notes: 'Window seat',
      });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.businessId).toBe(bizAId);
      expect(res.body.partySize).toBe(3);
      bookingId = res.body.id as string;
    });

    it('POST with cross-business locationId → 404', async () => {
      const bLoc = await mkLoc2(bizBId, 'BkgCross');
      const res = await aPost(ownerAToken, '/admin/bookings', {
        locationId: bLoc,
        partySize: 2,
        scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      });
      expect(res.status).toBe(404);
    });

    it('POST with cross-business guestId → 400 (ValidationError)', async () => {
      const bGuest = await aPost(ownerBToken, '/admin/guests', { displayName: 'B Guest Cross' });
      const res = await aPost(ownerAToken, '/admin/bookings', {
        locationId: locAId,
        guestId: bGuest.body.id,
        partySize: 2,
        scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      });
      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe('VALIDATION');
    });

    it('GET /admin/bookings → lists bookings', async () => {
      const res = await aGet(ownerAToken, '/admin/bookings');
      expect(res.status).toBe(200);
      expect(res.body.some((b: { id: string }) => b.id === bookingId)).toBe(true);
    });

    it('GET /admin/bookings?locationId= → filters', async () => {
      const res = await aGet(ownerAToken, `/admin/bookings?locationId=${locAId}`);
      expect(res.status).toBe(200);
      expect(res.body.every((b: { locationId: string }) => b.locationId === locAId)).toBe(true);
    });

    it('PATCH → CONFIRMED', async () => {
      const res = await aPatch(ownerAToken, `/admin/bookings/${bookingId}`, { status: 'CONFIRMED' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CONFIRMED');
    });

    it('PATCH → CANCELLED', async () => {
      const res = await aPatch(ownerAToken, `/admin/bookings/${bookingId}`, { status: 'CANCELLED' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');
    });

    it('cross-tenant: B cannot fetch A booking → 404', async () => {
      expect((await aGet(ownerBToken, `/admin/bookings/${bookingId}`)).status).toBe(404);
    });

    it('cross-tenant: B cannot update A booking → 404', async () => {
      expect((await aPatch(ownerBToken, `/admin/bookings/${bookingId}`, { status: 'NO_SHOW' })).status).toBe(404);
    });

    it('module gate: C (restaurant not active) → 403 MODULE_DISABLED', async () => {
      const res = await aGet(ownerCToken, '/admin/bookings');
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('MODULE_DISABLED');
    });
  });

  // ── Business isolation sweep ────────────────────────────────────────────────────

  describe('Full isolation sweep — B reads none of A resources', () => {
    const aIds: Record<string, string> = {};

    beforeAll(async () => {
      const tax = await aPost(ownerAToken, '/admin/catalog/tax-categories', { name: 'IsoTax', rate: 0.1 });
      const cat = await aPost(ownerAToken, '/admin/catalog/categories', { name: 'IsoCat' });
      const item = await aPost(ownerAToken, '/admin/catalog/items', {
        categoryId: cat.body.id,
        name: 'IsoItem',
        basePriceMinorUnits: 5000,
      });
      const group = await aPost(ownerAToken, '/admin/catalog/modifier-groups', { name: 'IsoGroup' });
      const area = await aPost(ownerAToken, '/admin/dining/areas', { locationId: locAId, name: 'IsoArea' });
      const table = await aPost(ownerAToken, '/admin/dining/tables', {
        diningAreaId: area.body.id,
        locationId: locAId,
        code: `ISO${RUN}`,
      });
      const staff = await aPost(ownerAToken, '/admin/staff', { displayName: 'IsoStaff' });
      const guest = await aPost(ownerAToken, '/admin/guests', { displayName: 'IsoGuest' });
      const booking = await aPost(ownerAToken, '/admin/bookings', {
        locationId: locAId,
        partySize: 2,
        scheduledAt: new Date(Date.now() + 86_400_000 * 3).toISOString(),
      });
      Object.assign(aIds, {
        tax: tax.body.id,
        cat: cat.body.id,
        item: item.body.id,
        group: group.body.id,
        area: area.body.id,
        table: table.body.id,
        staff: staff.body.id,
        guest: guest.body.id,
        booking: booking.body.id,
      });
    });

    it('B cannot read any A resource by id — all 404', async () => {
      const results = await Promise.all([
        aGet(ownerBToken, `/admin/catalog/tax-categories/${aIds.tax}`),
        aGet(ownerBToken, `/admin/catalog/categories/${aIds.cat}`),
        aGet(ownerBToken, `/admin/catalog/items/${aIds.item}`),
        aGet(ownerBToken, `/admin/catalog/modifier-groups/${aIds.group}`),
        aGet(ownerBToken, `/admin/dining/areas/${aIds.area}`),
        aGet(ownerBToken, `/admin/dining/tables/${aIds.table}`),
        aGet(ownerBToken, `/admin/staff/${aIds.staff}`),
        aGet(ownerBToken, `/admin/guests/${aIds.guest}`),
        aGet(ownerBToken, `/admin/bookings/${aIds.booking}`),
      ]);
      for (const r of results) {
        expect(r.status).toBe(404);
      }
    });

    it('B list endpoints contain none of A resource ids', async () => {
      const lists = await Promise.all([
        aGet(ownerBToken, '/admin/catalog/tax-categories'),
        aGet(ownerBToken, '/admin/catalog/categories'),
        aGet(ownerBToken, '/admin/catalog/items'),
        aGet(ownerBToken, '/admin/catalog/modifier-groups'),
        aGet(ownerBToken, '/admin/dining/areas'),
        aGet(ownerBToken, '/admin/dining/tables'),
        aGet(ownerBToken, '/admin/staff'),
        aGet(ownerBToken, '/admin/guests'),
        aGet(ownerBToken, '/admin/bookings'),
      ]);
      const forbidden = new Set(Object.values(aIds));
      for (const r of lists) {
        expect(r.status).toBe(200);
        for (const row of r.body as Array<{ id: string }>) {
          expect(forbidden.has(row.id)).toBe(false);
        }
      }
    });
  });
});
