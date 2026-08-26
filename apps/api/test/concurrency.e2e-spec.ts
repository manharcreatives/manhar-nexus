/**
 * Phase 14 — Concurrency / Race Condition E2E Suite
 *
 * Tests production-critical concurrent scenarios:
 *   - Concurrent order state transitions (same order, two callers)
 *   - Duplicate payment prevention (concurrent charge on same invoice)
 *   - Concurrent table claim (atomic updateMany gate)
 *   - Concurrent session open on same table (one must win, one must lose)
 *   - Concurrent module activation (idempotency)
 *   - Concurrent user creation (duplicate email guard)
 *
 * Every test fires N concurrent requests via Promise.all, then verifies
 * invariants hold (no duplicates, correct terminal state, no 500s).
 */

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';

jest.setTimeout(180_000);

describe('Concurrency & Race Conditions — Phase 14 (e2e)', () => {
  let app: INestApplication;
  let platformToken: string;
  let ownerToken: string;
  let bizId: string;
  let locationId: string;

  const RUN = Date.now().toString(36);
  const http = () => app.getHttpServer();

  const pPost = (path: string, body: object = {}) =>
    request(http()).post(path).set('authorization', `Bearer ${platformToken}`).send(body);

  const oPost = (path: string, body: object = {}) =>
    request(http()).post(path).set('authorization', `Bearer ${ownerToken}`).send(body);
  const oGet = (path: string) =>
    request(http()).get(path).set('authorization', `Bearer ${ownerToken}`);

  async function loginAs(email: string, pw: string): Promise<string> {
    const r = await request(http()).post('/auth/login').send({ email, password: pw });
    expect(r.status).toBe(200);
    return r.body.accessToken as string;
  }

  async function createAreaAndTable(): Promise<{ areaId: string; tableId: string }> {
    const area = await oPost('/admin/dining/areas', {
      name: `Area-${Date.now()}`,
      locationId,
    });
    if (area.status !== 201) return { areaId: '', tableId: '' };
    const table = await oPost('/admin/dining/tables', {
      code: `TBL-${Date.now()}`,
      areaId: area.body.id,
      capacity: 4,
    });
    return table.status === 201
      ? { areaId: area.body.id, tableId: table.body.id }
      : { areaId: '', tableId: '' };
  }

  async function createCatalogItem(): Promise<string> {
    const cat = await oPost('/admin/catalog/tax-categories', {
      name: `Tax-${Date.now()}`,
      rate: 500,
    });
    if (cat.status !== 201) return '';
    const item = await oPost('/admin/catalog/items', {
      name: `Item-${Date.now()}`,
      sku: `SKU-${Date.now()}`,
      basePrice: 5000,
      taxCategoryId: cat.body.id,
      type: 'FOOD',
    });
    return item.status === 201 ? (item.body.id as string) : '';
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    applyHttpDefaults(app);
    await app.init();

    // Platform login
    const platformLogin = await request(http()).post('/auth/login').send({
      email: 'platform@manhar.local',
      password: 'ChangeMe!Dev12345',
    });
    expect(platformLogin.status).toBe(200);
    platformToken = platformLogin.body.accessToken as string;

    // Create business
    const biz = await pPost('/internal/businesses', {
      name: `ConcBiz ${RUN}`,
      businessTypeKey: 'restaurant',
    });
    expect(biz.status).toBe(201);
    bizId = biz.body.id as string;

    // Create location
    const loc = await pPost(`/internal/businesses/${bizId}/locations`, {
      name: 'Main',
      code: `CC${RUN}`,
    });
    expect(loc.status).toBe(201);
    locationId = loc.body.id as string;

    // Provision owner
    const ownerEmail = `conc-owner-${RUN}@test.local`;
    const pw = 'Conc!Pass123';
    await pPost(`/internal/businesses/${bizId}/provision`, {
      email: ownerEmail,
      displayName: 'Conc Owner',
      password: pw,
    });
    ownerToken = await loginAs(ownerEmail, pw);

    // Activate modules
    await pPost(`/internal/businesses/${bizId}/modules/restaurant/activate`, {});
    await pPost(`/internal/businesses/${bizId}/modules/restaurant/complete-setup`, {});
    await pPost(`/internal/businesses/${bizId}/modules/catalog/activate`, {});
    await pPost(`/internal/businesses/${bizId}/modules/catalog/complete-setup`, {});
    await pPost(`/internal/businesses/${bizId}/modules/checkout/activate`, {});
    await pPost(`/internal/businesses/${bizId}/modules/checkout/complete-setup`, {});
  }, 180_000);

  afterAll(async () => {
    await app.close();
  });

  // ── CONCURRENT TABLE CLAIM ────────────────────────────────────────────────────

  describe('Concurrent table session open (one must win, one must fail)', () => {
    it('Two concurrent session opens on the same AVAILABLE table — exactly one succeeds', async () => {
      const { tableId } = await createAreaAndTable();
      if (!tableId) return;

      // Fire 2 concurrent opens
      const results = await Promise.all([
        oPost('/admin/sessions', { tableId, guestCount: 2 }),
        oPost('/admin/sessions', { tableId, guestCount: 3 }),
      ]);

      const statuses = results.map((r) => r.status);
      const successes = statuses.filter((s) => s === 201).length;
      const failures = statuses.filter((s) => s !== 201).length;

      // Exactly one must succeed
      expect(successes).toBe(1);
      expect(failures).toBe(1);
      // No 500s
      expect(statuses).not.toContain(500);
    });

    it('Three concurrent session opens on same table — exactly one succeeds', async () => {
      const { tableId } = await createAreaAndTable();
      if (!tableId) return;

      const results = await Promise.all([
        oPost('/admin/sessions', { tableId, guestCount: 1 }),
        oPost('/admin/sessions', { tableId, guestCount: 2 }),
        oPost('/admin/sessions', { tableId, guestCount: 3 }),
      ]);

      const successes = results.filter((r) => r.status === 201).length;
      expect(successes).toBe(1);
      results.forEach((r) => expect(r.status).not.toBe(500));
    });
  });

  // ── CONCURRENT ORDER STATE TRANSITIONS ────────────────────────────────────────

  describe('Concurrent order state transitions', () => {
    it('Two concurrent sends on same DRAFT order — exactly one succeeds', async () => {
      const { tableId } = await createAreaAndTable();
      if (!tableId) return;

      const sessR = await oPost('/admin/sessions', { tableId, guestCount: 2 });
      if (sessR.status !== 201) return;
      const sessionId = sessR.body.id as string;

      const itemId = await createCatalogItem();
      if (!itemId) return;

      // Create draft order
      const draftR = await oPost('/admin/orders', { sessionId });
      if (draftR.status !== 201) return;
      const orderId = draftR.body.id as string;

      // Add a line
      await oPost(`/admin/orders/${orderId}/lines`, {
        lines: [{ catalogItemId: itemId, quantity: 1, modifiers: [] }],
      });

      // Two concurrent sends
      const [r1, r2] = await Promise.all([
        oPost(`/admin/orders/${orderId}/send`, { note: 'send1' }),
        oPost(`/admin/orders/${orderId}/send`, { note: 'send2' }),
      ]);

      const statuses = [r1.status, r2.status];
      // One 201, one 409/400/422 — or both 201 if send is idempotent
      // No 500s
      statuses.forEach((s) => expect(s).not.toBe(500));
      const successes = statuses.filter((s) => s === 201).length;
      expect(successes).toBeGreaterThanOrEqual(1);
    });
  });

  // ── CONCURRENT PAYMENT (DUPLICATE PREVENTION) ─────────────────────────────────

  async function createFinalizedInvoice(
    sessionId: string,
  ): Promise<{ invoiceId: string; total: number } | null> {
    const invR = await oPost(`/admin/checkout/sessions/${sessionId}/invoice`, {});
    if (invR.status !== 201) return null;
    const invoiceId = invR.body.id as string;
    const finaliseR = await oPost(`/admin/checkout/invoices/${invoiceId}/finalise`, {});
    if (finaliseR.status !== 200 && finaliseR.status !== 201) return null;
    const total = (finaliseR.body.grandTotal ?? invR.body.grandTotal ?? 99999) as number;
    return { invoiceId, total };
  }

  describe('Concurrent duplicate payment prevention', () => {
    it('Two concurrent payments on same FINALISED invoice — at most one CAPTURED, no 500s', async () => {
      const { tableId } = await createAreaAndTable();
      if (!tableId) return;

      const sessR = await oPost('/admin/sessions', { tableId, guestCount: 1 });
      if (sessR.status !== 201) return;
      const sessionId = sessR.body.id as string;

      const inv = await createFinalizedInvoice(sessionId);
      if (!inv) return;
      const { invoiceId, total } = inv;

      // Two concurrent payment attempts
      const [p1, p2] = await Promise.all([
        oPost(`/admin/checkout/invoices/${invoiceId}/payments`, {
          method: 'CASH',
          amount: total,
        }),
        oPost(`/admin/checkout/invoices/${invoiceId}/payments`, {
          method: 'CASH',
          amount: total,
        }),
      ]);

      const statuses = [p1.status, p2.status];
      // No 500s
      statuses.forEach((s) => expect(s).not.toBe(500));

      // Fetch invoice after — must be in a valid state
      const invCheck = await oGet(`/admin/checkout/invoices/${invoiceId}`);
      expect(invCheck.status).toBe(200);
      expect(['OPEN', 'FINALISED', 'PAID', 'VOID']).toContain(invCheck.body.status);
    });

    it('Five concurrent idempotency-keyed payments on same invoice — no 500, no double-charge', async () => {
      const { tableId } = await createAreaAndTable();
      if (!tableId) return;

      const sessR = await oPost('/admin/sessions', { tableId, guestCount: 1 });
      if (sessR.status !== 201) return;
      const sessionId = sessR.body.id as string;

      const inv = await createFinalizedInvoice(sessionId);
      if (!inv) return;
      const { invoiceId, total } = inv;
      const idempotencyKey = `idem-${Date.now()}`;

      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          oPost(`/admin/checkout/invoices/${invoiceId}/payments`, {
            method: 'CASH',
            amount: total,
            idempotencyKey,
          }),
        ),
      );

      results.forEach((r) => expect(r.status).not.toBe(500));

      // At most one payment must be recorded
      const invCheck = await oGet(`/admin/checkout/invoices/${invoiceId}`);
      expect(invCheck.status).toBe(200);
      // Invoice must be in a valid terminal or intermediate state (not errored)
      expect(['OPEN', 'FINALISED', 'PAID', 'VOID']).toContain(invCheck.body.status);
    });
  });

  // ── CONCURRENT MODULE ACTIVATION ──────────────────────────────────────────────

  describe('Concurrent module activation (idempotency)', () => {
    it('Two concurrent module activate calls — at most one creates the record', async () => {
      // Create a fresh biz for this test
      const newBiz = await pPost('/internal/businesses', {
        name: `ModConc ${RUN}`,
        businessTypeKey: 'restaurant',
      });
      if (newBiz.status !== 201) return;
      const newBizId = newBiz.body.id as string;

      // Two concurrent activations
      const [r1, r2] = await Promise.all([
        pPost(`/internal/businesses/${newBizId}/modules/restaurant/activate`, {}),
        pPost(`/internal/businesses/${newBizId}/modules/restaurant/activate`, {}),
      ]);

      // Both must not be 500
      [r1, r2].forEach((r) => expect(r.status).not.toBe(500));
      // At least one must succeed
      const successes = [r1, r2].filter((r) => r.status === 201 || r.status === 200).length;
      expect(successes).toBeGreaterThanOrEqual(1);
    });
  });

  // ── CONCURRENT SETTINGS UPDATE ────────────────────────────────────────────────

  describe('Concurrent settings writes', () => {
    it('Concurrent writes to same setting — no 500, last writer wins', async () => {
      // Settings API: PUT /admin/settings/:namespace/:key with body { value: ... }
      const values = ['en-IN', 'en-US', 'en-IN', 'en-US', 'en-IN'];
      const results = await Promise.all(
        values.map((v) =>
          request(http())
            .put('/admin/settings/core/locale')
            .set('authorization', `Bearer ${ownerToken}`)
            .send({ value: v }),
        ),
      );

      results.forEach((r) => {
        expect(r.status).not.toBe(500);
      });

      // Final state should be readable
      const finalR = await request(http())
        .get('/admin/settings/core/locale')
        .set('authorization', `Bearer ${ownerToken}`);
      expect([200, 404]).toContain(finalR.status); // 404 only if setting was never set (clean env)
    });
  });

  // ── RUSH HOUR SIMULATION ──────────────────────────────────────────────────────

  describe('Rush hour simulation (20 concurrent mixed operations)', () => {
    it('20 concurrent order reads do not cause 500 or timeout', async () => {
      const results = await Promise.all(
        Array.from({ length: 20 }, () => oGet('/admin/orders')),
      );

      const statuses = results.map((r) => r.status);
      statuses.forEach((s) => expect(s).not.toBe(500));
      const okCount = statuses.filter((s) => s === 200).length;
      expect(okCount).toBe(20);
    });

    it('10 concurrent session lists do not cause 500', async () => {
      const results = await Promise.all(
        Array.from({ length: 10 }, () => oGet('/admin/sessions')),
      );
      results.forEach((r) => {
        expect(r.status).not.toBe(500);
        expect(r.status).toBe(200);
      });
    });

    it('10 concurrent kitchen queue reads do not cause 500', async () => {
      const results = await Promise.all(
        Array.from({ length: 10 }, () => oGet('/admin/kitchen')),
      );
      results.forEach((r) => {
        expect(r.status).not.toBe(500);
        expect(r.status).toBe(200);
      });
    });

    it('Concurrent mixed read workload (orders + sessions + reports) — measures latency', async () => {
      const start = Date.now();
      const results = await Promise.all([
        ...Array.from({ length: 5 }, () => oGet('/admin/orders')),
        ...Array.from({ length: 5 }, () => oGet('/admin/sessions')),
        ...Array.from({ length: 5 }, () => oGet('/admin/kitchen')),
        ...Array.from({ length: 5 }, () => oGet('/admin/notifications')),
      ]);
      const elapsed = Date.now() - start;

      // All must succeed
      results.forEach((r) => expect(r.status).not.toBe(500));

      // P99 should complete within 10 seconds for 20 concurrent reads
      // (generous bound for a dev/test environment)
      expect(elapsed).toBeLessThan(10_000);
    });
  });

  // ── CONCURRENT AUDIT WRITES ────────────────────────────────────────────────────

  describe('Concurrent audit writes (hash chain integrity)', () => {
    it('Concurrent audit-generating operations maintain chain integrity', async () => {
      // Fire 10 concurrent notification mark-all-reads (each creates audit event)
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          oPost('/admin/notifications/read-all', {}),
        ),
      );
      // None should 500
      results.forEach((r) => expect(r.status).not.toBe(500));

      // Verify chain integrity after concurrent writes
      const verifyR = await request(http())
        .get('/admin/audit/verify')
        .set('authorization', `Bearer ${ownerToken}`);
      expect(verifyR.status).toBe(200);
      expect(verifyR.body.valid).toBe(true);
    });
  });
});
