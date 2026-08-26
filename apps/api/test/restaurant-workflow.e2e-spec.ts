/**
 * Phase 15 — Restaurant V1 Complete Service Journey (e2e)
 *
 * Validates the end-to-end restaurant workflow as a single coherent
 * operational journey, not isolated endpoint checks.
 *
 * Journey:
 *   Table AVAILABLE
 *   → Open Session (table OCCUPIED)
 *   → Create Order (2 items, exact known price/tax)
 *   → Send to Kitchen (SENT → requestNumber allocated)
 *   → Kitchen: SENT → ACCEPTED → PREPARING → READY
 *   → Mark SERVED
 *   → Invoice: getOrCreate → verify totals → finalise
 *   → CASH payment → invoice PAID
 *   → Close Session (table CLEANING)
 *   → Reset Table (table AVAILABLE)
 *   → Daily report reflects the transaction
 *   → Audit chain: valid
 *
 * Guards tested separately:
 *   - Duplicate payment on PAID invoice → rejected
 *   - Concurrent session open on same table → exactly one wins
 *   - Void session (no orders) → table AVAILABLE
 *   - Role-based: kitchen-only user can access kitchen, cannot manage sessions
 */

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';

jest.setTimeout(180_000);

describe('Restaurant V1 — Complete Service Journey (e2e)', () => {
  let app: INestApplication;
  let platformToken: string;

  // Business under test
  let bizId: string;
  let locationId: string;
  let ownerToken: string;

  // Catalog
  let taxCategoryId: string;
  let item1Id: string; // Paneer Tikka — ₹200 (20000 paise), rate 5%
  let item2Id: string; // Naan — ₹50 (5000 paise), rate 5%

  // Dining
  let areaId: string;
  let table1Id: string; // main journey table
  let table2Id: string; // concurrent open guard
  let table3Id: string; // void session guard

  // Shared across the main journey blocks
  let sessionId: string;
  let orderId: string;
  let invoiceId: string;
  let paymentId: string;

  const RUN = Date.now().toString(36);
  const http = () => app.getHttpServer();

  const pPost = (path: string, body: object = {}) =>
    request(http()).post(path).set('Authorization', `Bearer ${platformToken}`).send(body);

  const oPost = (path: string, body: object = {}) =>
    request(http()).post(path).set('Authorization', `Bearer ${ownerToken}`).send(body);
  const oGet = (path: string) =>
    request(http()).get(path).set('Authorization', `Bearer ${ownerToken}`);

  const uuid = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });

  async function loginAs(email: string, pw: string): Promise<string> {
    const r = await request(http()).post('/auth/login').send({ email, password: pw });
    expect(r.status).toBe(200);
    return r.body.accessToken as string;
  }

  async function activateModule(moduleKey: string): Promise<void> {
    const a = await pPost(`/internal/businesses/${bizId}/modules/${moduleKey}/activate`);
    if (a.status !== 201 && a.status !== 409) throw new Error(`activate ${moduleKey} failed: ${a.status}`);
    const s = await pPost(`/internal/businesses/${bizId}/modules/${moduleKey}/complete-setup`);
    if (s.status !== 200 && s.status !== 201) throw new Error(`complete-setup ${moduleKey} failed: ${s.status}`);
  }

  async function makeTable(code: string): Promise<string> {
    const r = await oPost('/admin/dining/tables', {
      diningAreaId: areaId,
      locationId,
      code: `${code}-${RUN}`,
      capacity: 6,
      isActive: true,
    });
    expect(r.status).toBe(201);
    return r.body.id as string;
  }

  // ── SETUP ─────────────────────────────────────────────────────────────────────

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    applyHttpDefaults(app);
    await app.init();

    // Platform login
    const pl = await request(http()).post('/auth/login').send({
      email: process.env.PLATFORM_BOOTSTRAP_EMAIL ?? 'platform@manhar.local',
      password: process.env.PLATFORM_BOOTSTRAP_PASSWORD ?? 'ChangeMe!Dev12345',
    });
    expect(pl.status).toBe(200);
    platformToken = pl.body.accessToken as string;

    // Business
    const biz = await pPost('/internal/businesses', {
      name: `P15 Workflow ${RUN}`,
      businessTypeKey: 'restaurant',
    });
    expect(biz.status).toBe(201);
    bizId = biz.body.id as string;

    // Location
    const loc = await pPost(`/internal/businesses/${bizId}/locations`, {
      name: `Location ${RUN}`,
      timezone: 'Asia/Kolkata',
    });
    expect(loc.status).toBe(201);
    locationId = loc.body.id as string;

    // Owner
    const ownerEmail = `p15-owner-${RUN}@test.local`;
    const pw = 'Pilot!Pass123';
    await pPost(`/internal/businesses/${bizId}/provision`, {
      email: ownerEmail,
      displayName: `P15 Owner`,
      password: pw,
    });
    ownerToken = await loginAs(ownerEmail, pw);

    // Activate all modules
    await activateModule('restaurant');
    await activateModule('catalog');
    await activateModule('checkout');
    await activateModule('reports');

    // Tax category: 5% GST
    const tax = await oPost('/admin/catalog/tax-categories', {
      name: `GST5 ${RUN}`,
      rate: 0.05,
      isActive: true,
    });
    expect(tax.status).toBe(201);
    taxCategoryId = tax.body.id as string;

    // Menu category
    const cat = await oPost('/admin/catalog/categories', {
      name: `Food ${RUN}`,
      isActive: true,
      sortOrder: 0,
    });
    expect(cat.status).toBe(201);
    const categoryId = cat.body.id as string;

    // Item 1: Paneer Tikka — ₹200 (20000 paise)
    const i1 = await oPost('/admin/catalog/items', {
      name: `Paneer Tikka ${RUN}`,
      categoryId,
      taxCategoryId,
      basePriceMinorUnits: 20000,
      isActive: true,
      isAvailable: true,
      sortOrder: 0,
    });
    expect(i1.status).toBe(201);
    item1Id = i1.body.id as string;

    // Item 2: Naan — ₹50 (5000 paise)
    const i2 = await oPost('/admin/catalog/items', {
      name: `Naan ${RUN}`,
      categoryId,
      taxCategoryId,
      basePriceMinorUnits: 5000,
      isActive: true,
      isAvailable: true,
      sortOrder: 1,
    });
    expect(i2.status).toBe(201);
    item2Id = i2.body.id as string;

    // Dining area
    const area = await oPost('/admin/dining/areas', {
      locationId,
      name: `Main Hall ${RUN}`,
      isActive: true,
      sortOrder: 0,
    });
    expect(area.status).toBe(201);
    areaId = area.body.id as string;

    // Three tables
    table1Id = await makeTable('T1');
    table2Id = await makeTable('T2');
    table3Id = await makeTable('T3');
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  // ── 1. PRE-JOURNEY: TABLE IS AVAILABLE ────────────────────────────────────────

  describe('1. Pre-journey: table starts AVAILABLE', () => {
    it('table is AVAILABLE before any session', async () => {
      const r = await oGet(`/admin/dining/tables/${table1Id}`);
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('AVAILABLE');
    });
  });

  // ── 2. OPEN SESSION ────────────────────────────────────────────────────────────

  describe('2. Open guest session', () => {
    it('opens a session: table AVAILABLE → OCCUPIED', async () => {
      const r = await oPost('/admin/sessions', {
        locationId,
        diningTableId: table1Id,
        partySize: 4,
        notes: 'Anniversary dinner',
      });
      expect(r.status).toBe(201);
      expect(r.body.status).toBe('OPEN');
      expect(r.body.partySize).toBe(4);
      expect(r.body.diningTableId).toBe(table1Id);
      sessionId = r.body.id as string;
    });

    it('table is now OCCUPIED', async () => {
      const r = await oGet(`/admin/dining/tables/${table1Id}`);
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('OCCUPIED');
    });
  });

  // ── 3. TAKE ORDER ─────────────────────────────────────────────────────────────

  describe('3. Create order with two items', () => {
    it('creates a DRAFT order with two line items', async () => {
      const r = await oPost('/admin/orders', {
        sessionId,
        idempotencyKey: uuid(),
        lines: [
          { catalogItemId: item1Id, quantity: 2, modifiers: [] }, // ₹200 × 2 = ₹400
          { catalogItemId: item2Id, quantity: 4, modifiers: [] }, // ₹50  × 4 = ₹200
        ],
      });
      expect(r.status).toBe(201);
      expect(r.body.status).toBe('DRAFT');
      expect(r.body.lines).toHaveLength(2);
      expect(r.body.sessionId).toBe(sessionId);
      orderId = r.body.id as string;
    });

    it('idempotency: duplicate idempotencyKey returns same order', async () => {
      const key = uuid();
      const r1 = await oPost('/admin/orders', {
        sessionId,
        idempotencyKey: key,
        lines: [{ catalogItemId: item1Id, quantity: 1, modifiers: [] }],
      });
      expect(r1.status).toBe(201);

      const r2 = await oPost('/admin/orders', {
        sessionId,
        idempotencyKey: key,
        lines: [{ catalogItemId: item1Id, quantity: 1, modifiers: [] }],
      });
      expect(r2.status).toBe(201);
      // Same order returned
      expect(r2.body.id).toBe(r1.body.id);
    });
  });

  // ── 4. SEND TO KITCHEN ────────────────────────────────────────────────────────

  describe('4. Send order to kitchen', () => {
    it('sends the main DRAFT order → SENT with requestNumber allocated', async () => {
      const r = await oPost(`/admin/orders/${orderId}/send`);
      expect(r.status).toBe(201);
      expect(r.body.status).toBe('SENT');
      expect(r.body.requestNumber).toBeTruthy();
    });

    it('order appears in the kitchen queue', async () => {
      const r = await oGet('/admin/kitchen');
      expect(r.status).toBe(200);
      const ids = (r.body as { id: string }[]).map((o) => o.id);
      expect(ids).toContain(orderId);
    });

    it('cannot send a SENT order again', async () => {
      const r = await oPost(`/admin/orders/${orderId}/send`);
      expect([400, 409, 422]).toContain(r.status);
    });
  });

  // ── 5. KITCHEN LIFECYCLE ──────────────────────────────────────────────────────

  describe('5. Kitchen state machine: SENT → ACCEPTED → PREPARING → READY', () => {
    it('kitchen accepts the order: SENT → ACCEPTED', async () => {
      const r = await oPost(`/admin/kitchen/${orderId}/accept`);
      expect(r.status).toBe(201);
      expect(r.body.status).toBe('ACCEPTED');
    });

    it('kitchen starts preparation: ACCEPTED → PREPARING', async () => {
      const r = await oPost(`/admin/kitchen/${orderId}/prepare`);
      expect(r.status).toBe(201);
      expect(r.body.status).toBe('PREPARING');
    });

    it('kitchen marks order ready: PREPARING → READY', async () => {
      const r = await oPost(`/admin/kitchen/${orderId}/ready`);
      expect(r.status).toBe(201);
      expect(r.body.status).toBe('READY');
    });

    it('order status confirmed READY via GET /admin/orders/:id', async () => {
      const r = await oGet(`/admin/orders/${orderId}`);
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('READY');
    });
  });

  // ── 6. MARK SERVED ────────────────────────────────────────────────────────────

  describe('6. Mark order SERVED', () => {
    it('staff marks the order as served: READY → SERVED', async () => {
      const r = await oPost(`/admin/orders/${orderId}/serve`);
      expect(r.status).toBe(201);
      expect(r.body.status).toBe('SERVED');
    });
  });

  // ── 7. INVOICE ────────────────────────────────────────────────────────────────

  describe('7. Create and verify invoice', () => {
    // Expected totals:
    //   Item 1: 20000 × 2 = 40000 paise subtotal, tax = round(40000 × 0.05) = 2000
    //   Item 2: 5000  × 4 = 20000 paise subtotal, tax = round(20000 × 0.05) = 1000
    //   Total subtotal: 60000, total tax: 3000, grand total: 63000

    it('getOrCreate invoice from session — lines match order', async () => {
      const r = await oPost(`/admin/checkout/sessions/${sessionId}/invoice`);
      expect(r.status).toBe(201);
      expect(r.body.sessionId).toBe(sessionId);
      expect(r.body.status).toBe('DRAFT');
      expect(r.body.lines).toHaveLength(2);
      invoiceId = r.body.id as string;
    });

    it('getOrCreate is idempotent — same invoice on second call', async () => {
      const r = await oPost(`/admin/checkout/sessions/${sessionId}/invoice`);
      expect(r.status).toBe(201);
      expect(r.body.id).toBe(invoiceId);
    });

    it('invoice totals are arithmetically correct', async () => {
      const r = await oGet(`/admin/checkout/invoices/${invoiceId}`);
      expect(r.status).toBe(200);
      // Subtotal = 60000 (items before tax)
      expect(r.body.subtotalMinorUnits).toBe(60000);
      // Tax = 3000 (5% on each line, summed)
      expect(r.body.totalTaxMinorUnits).toBe(3000);
      // Grand total = 63000
      expect(r.body.grandTotalMinorUnits).toBe(63000);
    });

    it('finalises the DRAFT invoice — status FINALISED, invoiceNumber assigned', async () => {
      const r = await oPost(`/admin/checkout/invoices/${invoiceId}/finalise`);
      expect([200, 201]).toContain(r.status);
      expect(r.body.status).toBe('FINALISED');
      expect(r.body.invoiceNumber).toBeTruthy();
    });

    it('cannot finalise an already-FINALISED invoice', async () => {
      const r = await oPost(`/admin/checkout/invoices/${invoiceId}/finalise`);
      expect([400, 409, 422]).toContain(r.status);
    });
  });

  // ── 8. PAYMENT ───────────────────────────────────────────────────────────────

  describe('8. Record cash payment', () => {
    it('records exact cash payment → invoice PAID', async () => {
      const r = await oPost(`/admin/checkout/invoices/${invoiceId}/payments`, {
        method: 'CASH',
        amountMinorUnits: 63000,
        cashReceivedMinorUnits: 63000, // exact cash; change = 0
        idempotencyKey: uuid(),
      });
      expect([200, 201]).toContain(r.status);
      expect(r.body.status).toBe('CAPTURED');
      paymentId = r.body.id as string;

      // Verify invoice is now PAID
      const inv = await oGet(`/admin/checkout/invoices/${invoiceId}`);
      expect(inv.status).toBe(200);
      expect(inv.body.status).toBe('PAID');
    });

    it('payment record is visible in the invoice payments list', async () => {
      const r = await oGet(`/admin/checkout/invoices/${invoiceId}/payments`);
      expect(r.status).toBe(200);
      const ids = (r.body as { id: string }[]).map((p) => p.id);
      expect(ids).toContain(paymentId);
    });
  });

  // ── 9. CLOSE SESSION ──────────────────────────────────────────────────────────

  describe('9. Close session and reset table', () => {
    it('closes the session → table CLEANING', async () => {
      const r = await oPost(`/admin/sessions/${sessionId}/close`);
      expect([200, 201]).toContain(r.status);
      expect(r.body.status).toBe('CLOSED');

      const table = await oGet(`/admin/dining/tables/${table1Id}`);
      expect(table.status).toBe(200);
      expect(table.body.status).toBe('CLEANING');
    });

    it('resets table: CLEANING → AVAILABLE', async () => {
      const r = await oPost(`/admin/dining/tables/${table1Id}/reset`);
      expect(r.status).toBe(204); // 204 No Content

      const table = await oGet(`/admin/dining/tables/${table1Id}`);
      expect(table.status).toBe(200);
      expect(table.body.status).toBe('AVAILABLE');
    });

    it('new session can be opened on the reset table', async () => {
      const r = await oPost('/admin/sessions', {
        locationId,
        diningTableId: table1Id,
        partySize: 2,
      });
      expect(r.status).toBe(201);
      // Clean up: void the newly opened session so table state doesn't pollute other tests
      await oPost(`/admin/sessions/${r.body.id as string}/void`, { reason: 'test cleanup' });
    });
  });

  // ── 10. DAILY REPORT ──────────────────────────────────────────────────────────

  describe('10. Daily report reflects the transaction', () => {
    it('daily report for today includes the paid invoice', async () => {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
      const r = await oGet(`/admin/reports/daily?date=${today}`);
      expect(r.status).toBe(200);
      // At least one invoice paid today
      expect(r.body.paidInvoiceCount).toBeGreaterThanOrEqual(1);
      // Revenue at least covers this transaction (63000)
      expect(r.body.totalRevenueMinorUnits).toBeGreaterThanOrEqual(63000);
    });
  });

  // ── 11. AUDIT TRAIL ───────────────────────────────────────────────────────────

  describe('11. Audit trail integrity', () => {
    it('audit chain is valid after the full journey', async () => {
      const r = await oGet('/admin/audit/verify');
      expect(r.status).toBe(200);
      expect(r.body.valid).toBe(true);
    });

    it('audit log contains events from the journey', async () => {
      const r = await oGet('/admin/audit?take=100');
      expect(r.status).toBe(200);
      // Response: { events: AuditEvent[], total: number }
      expect(Array.isArray(r.body.events)).toBe(true);
      expect((r.body.events as unknown[]).length).toBeGreaterThan(0);
    });
  });

  // ── GUARD: DUPLICATE PAYMENT ──────────────────────────────────────────────────

  describe('Guard: duplicate payment on PAID invoice is rejected', () => {
    it('second payment attempt on PAID invoice → 409 CONFLICT', async () => {
      const r = await oPost(`/admin/checkout/invoices/${invoiceId}/payments`, {
        method: 'CASH',
        amountMinorUnits: 63000,
        cashReceivedMinorUnits: 63000,
        idempotencyKey: uuid(),
      });
      expect([400, 409, 422]).toContain(r.status);
      expect(r.status).not.toBe(500);
    });
  });

  // ── GUARD: CONCURRENT SESSION OPEN ───────────────────────────────────────────

  describe('Guard: concurrent session open on same table', () => {
    it('exactly one of two concurrent opens wins, none is 500', async () => {
      const [r1, r2] = await Promise.all([
        oPost('/admin/sessions', { locationId, diningTableId: table2Id, partySize: 2 }),
        oPost('/admin/sessions', { locationId, diningTableId: table2Id, partySize: 3 }),
      ]);
      const statuses = [r1.status, r2.status];
      expect(statuses).not.toContain(500);
      const successes = statuses.filter((s) => s === 201).length;
      expect(successes).toBe(1);
    });
  });

  // ── GUARD: SESSION VOID ───────────────────────────────────────────────────────

  describe('Guard: void session with no confirmed orders → table AVAILABLE', () => {
    let voidSessionId: string;

    it('opens a session on table3', async () => {
      const r = await oPost('/admin/sessions', {
        locationId,
        diningTableId: table3Id,
        partySize: 1,
      });
      expect(r.status).toBe(201);
      voidSessionId = r.body.id as string;

      const tbl = await oGet(`/admin/dining/tables/${table3Id}`);
      expect(tbl.body.status).toBe('OCCUPIED');
    });

    it('voids the session (no orders) → table AVAILABLE', async () => {
      const r = await oPost(`/admin/sessions/${voidSessionId}/void`, {
        reason: 'Guest left before ordering',
      });
      expect([200, 201]).toContain(r.status);
      expect(r.body.status).toBe('VOID');

      const tbl = await oGet(`/admin/dining/tables/${table3Id}`);
      expect(tbl.body.status).toBe('AVAILABLE');
    });

    it('cannot void a session that already has a SENT order', async () => {
      // Fresh session + order for this guard
      const s = await oPost('/admin/sessions', {
        locationId,
        diningTableId: table3Id,
        partySize: 2,
      });
      expect(s.status).toBe(201);
      const sid = s.body.id as string;

      const o = await oPost('/admin/orders', {
        sessionId: sid,
        idempotencyKey: uuid(),
        lines: [{ catalogItemId: item1Id, quantity: 1, modifiers: [] }],
      });
      expect(o.status).toBe(201);
      await oPost(`/admin/orders/${o.body.id as string}/send`);

      const v = await oPost(`/admin/sessions/${sid}/void`, { reason: 'test' });
      expect([400, 409, 422]).toContain(v.status);

      // Cancel the order and clean up
      await oPost(`/admin/orders/${o.body.id as string}/cancel`, { reason: 'test cleanup' });
      await oPost(`/admin/sessions/${sid}/close`);
    });
  });

  // ── ROLE-BASED: KITCHEN-ONLY USER ────────────────────────────────────────────

  describe('Role-based: kitchen-only user access', () => {
    let kitchenToken: string;

    beforeAll(async () => {
      // Create a custom role with kitchen permissions only
      const roleR = await oPost('/admin/roles', {
        key: `kitchen-only-${RUN}`,
        name: `Kitchen Only ${RUN}`,
        permissions: [
          'core.notification.view',
          'restaurant.order.view',
          'restaurant.kitchen.view',
          'restaurant.kitchen.manage',
        ],
      });
      expect(roleR.status).toBe(201);
      const roleId = roleR.body.id as string;

      // Create a business user (no initial role via admin endpoint)
      const kitchenEmail = `kitchen-${RUN}@test.local`;
      const userR = await oPost('/admin/users', {
        email: kitchenEmail,
        displayName: `Kitchen Staff ${RUN}`,
        password: 'Kitchen!Pass123',
      });
      expect(userR.status).toBe(201);
      const userId = userR.body.id as string;

      // Assign the kitchen-only role (returns 204)
      const assignR = await request(http())
        .post(`/admin/users/${userId}/roles`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ roleId });
      expect(assignR.status).toBe(204);

      kitchenToken = await loginAs(kitchenEmail, 'Kitchen!Pass123');
    });

    it('kitchen user can view the kitchen queue', async () => {
      const r = await request(http())
        .get('/admin/kitchen')
        .set('Authorization', `Bearer ${kitchenToken}`);
      expect(r.status).toBe(200);
    });

    it('kitchen user CANNOT manage sessions (403)', async () => {
      const r = await request(http())
        .post('/admin/sessions')
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ locationId, diningTableId: table1Id, partySize: 1 });
      expect(r.status).toBe(403);
    });

    it('kitchen user CANNOT create orders (403)', async () => {
      const r = await request(http())
        .post('/admin/orders')
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({ sessionId, idempotencyKey: uuid(), lines: [{ catalogItemId: item1Id, quantity: 1, modifiers: [] }] });
      expect(r.status).toBe(403);
    });

    it('kitchen user CANNOT access checkout invoices (403)', async () => {
      const r = await request(http())
        .post(`/admin/checkout/sessions/${sessionId}/invoice`)
        .set('Authorization', `Bearer ${kitchenToken}`)
        .send({});
      expect(r.status).toBe(403);
    });
  });
});
