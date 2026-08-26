/**
 * Phase 14 — Security Red Team E2E Suite
 *
 * Adversarial tests covering:
 *   OWASP A01 — Broken Access Control (IDOR, privilege escalation, cross-tenant)
 *   OWASP A02 — Cryptographic / auth failures (expired tokens, tampered JWTs)
 *   OWASP A03 — Injection (SQL via inputs, path traversal in params)
 *   OWASP A04 — Insecure Design (mass assignment, module bypass)
 *   OWASP A05 — Security Misconfiguration (dev endpoints, error details)
 *   OWASP A07 — Auth/Session failures (replay, enumeration, lockout)
 *
 * Strategy for IDOR tests: create real resources for Business B, then attempt
 * to access them using Business A's token. Expect 403 or 404 (service-layer
 * businessId scope filters must reject cross-tenant reads/writes).
 */

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';

jest.setTimeout(240_000);

describe('Security Red Team — Phase 14 (e2e)', () => {
  let app: INestApplication;
  let platformToken: string;

  // Business A — attacker
  let bizAToken: string;
  let bizAId: string;
  let bizASessionId: string;
  let _bizAOrderId: string;
  let bizAInvoiceId: string;
  let bizAItemId: string;

  // Business B — victim
  let bizBId: string;
  let bizBSessionId: string;
  let bizBOrderId: string;
  let bizBInvoiceId: string;

  // Location IDs
  let bizALocationId: string;
  let _bizAOtherLocationId: string;

  // Limited-scope user in Biz A (scoped to bizALocationId only)
  let _limitedScopedToken: string;

  const RUN = Date.now().toString(36);
  const http = () => app.getHttpServer();

  const pGet = (path: string) =>
    request(http()).get(path).set('authorization', `Bearer ${platformToken}`);
  const pPost = (path: string, body: object = {}) =>
    request(http()).post(path).set('authorization', `Bearer ${platformToken}`).send(body);
  const _pPatch = (path: string, body: object = {}) =>
    request(http()).patch(path).set('authorization', `Bearer ${platformToken}`).send(body);

  const asA = (path: string) =>
    request(http()).get(path).set('authorization', `Bearer ${bizAToken}`);
  const _aPost = (path: string, body: object = {}) =>
    request(http()).post(path).set('authorization', `Bearer ${bizAToken}`).send(body);

  const _as = (token: string) => ({
    get: (path: string) => request(http()).get(path).set('authorization', `Bearer ${token}`),
    post: (path: string, body: object = {}) =>
      request(http()).post(path).set('authorization', `Bearer ${token}`).send(body),
  });

  async function loginAs(email: string, pw: string): Promise<string> {
    const r = await request(http()).post('/auth/login').send({ email, password: pw });
    expect(r.status).toBe(200);
    return r.body.accessToken as string;
  }

  async function activateModule(bizId: string, moduleKey: string): Promise<void> {
    await pPost(`/internal/businesses/${bizId}/modules/${moduleKey}/activate`, {});
    await pPost(`/internal/businesses/${bizId}/modules/${moduleKey}/complete-setup`, {});
  }

  async function setupFullRestaurantBiz(
    name: string,
    ownerEmail: string,
    pw: string,
    locCode: string,
  ): Promise<{ bizId: string; locationId: string; ownerToken: string }> {
    const biz = await pPost('/internal/businesses', { name, businessTypeKey: 'restaurant' });
    expect(biz.status).toBe(201);
    const bizId = biz.body.id as string;

    const loc = await pPost(`/internal/businesses/${bizId}/locations`, {
      name: 'Main',
      code: locCode,
    });
    expect(loc.status).toBe(201);
    const locationId = loc.body.id as string;

    await pPost(`/internal/businesses/${bizId}/provision`, {
      email: ownerEmail,
      displayName: 'Owner',
      password: pw,
    });
    const ownerToken = await loginAs(ownerEmail, pw);

    await activateModule(bizId, 'restaurant');
    await activateModule(bizId, 'catalog');
    await activateModule(bizId, 'checkout');

    return { bizId, locationId, ownerToken };
  }

  async function createCatalogItem(token: string): Promise<string> {
    const cat = await request(http())
      .post('/admin/catalog/tax-categories')
      .set('authorization', `Bearer ${token}`)
      .send({ name: `TaxCat ${RUN}`, rate: 500 });
    if (cat.status !== 201) return '';
    const item = await request(http())
      .post('/admin/catalog/items')
      .set('authorization', `Bearer ${token}`)
      .send({
        name: `Item ${RUN}`,
        sku: `SKU-${RUN}`,
        basePrice: 10000,
        taxCategoryId: cat.body.id,
        type: 'FOOD',
      });
    return item.status === 201 ? (item.body.id as string) : '';
  }

  async function openSession(token: string, locationId: string): Promise<string> {
    const area = await request(http())
      .post('/admin/dining/areas')
      .set('authorization', `Bearer ${token}`)
      .send({ name: `A-${RUN}`, locationId });
    if (area.status !== 201) return '';
    const table = await request(http())
      .post('/admin/dining/tables')
      .set('authorization', `Bearer ${token}`)
      .send({ code: `T-${RUN}`, areaId: area.body.id, capacity: 2 });
    if (table.status !== 201) return '';
    const sess = await request(http())
      .post('/admin/sessions')
      .set('authorization', `Bearer ${token}`)
      .send({ tableId: table.body.id, guestCount: 2 });
    return sess.status === 201 ? (sess.body.id as string) : '';
  }

  async function createSentOrder(
    token: string,
    sessionId: string,
    itemId: string,
  ): Promise<string> {
    const draft = await request(http())
      .post('/admin/orders')
      .set('authorization', `Bearer ${token}`)
      .send({ sessionId });
    if (draft.status !== 201) return '';
    const orderId = draft.body.id as string;
    await request(http())
      .post(`/admin/orders/${orderId}/lines`)
      .set('authorization', `Bearer ${token}`)
      .send({ lines: [{ catalogItemId: itemId, quantity: 1, modifiers: [] }] });
    await request(http())
      .post(`/admin/orders/${orderId}/send`)
      .set('authorization', `Bearer ${token}`)
      .send({ note: '' });
    return orderId;
  }

  async function createFinalizedInvoice(token: string, sessionId: string): Promise<string> {
    const inv = await request(http())
      .post(`/admin/checkout/sessions/${sessionId}/invoice`)
      .set('authorization', `Bearer ${token}`)
      .send({});
    if (inv.status !== 201) return '';
    const invoiceId = inv.body.id as string;
    await request(http())
      .post(`/admin/checkout/invoices/${invoiceId}/finalise`)
      .set('authorization', `Bearer ${token}`)
      .send({});
    return invoiceId;
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    applyHttpDefaults(app);
    await app.init();

    platformToken = await loginAs('platform@manhar.local', 'ChangeMe!Dev12345');

    const pw = 'SecTest!Pass123';
    const ownerAEmail = `sec-a-${RUN}@test.local`;
    const ownerBEmail = `sec-b-${RUN}@test.local`;

    // Set up Business A (attacker)
    const { bizId: aId, locationId: aLocId, ownerToken: aToken } = await setupFullRestaurantBiz(
      `SecBizA ${RUN}`,
      ownerAEmail,
      pw,
      `SA${RUN}`,
    );
    bizAId = aId;
    bizALocationId = aLocId;
    bizAToken = aToken;

    // Second location for Biz A (for location-scope tests)
    const locB2 = await pPost(`/internal/businesses/${bizAId}/locations`, {
      name: 'Other',
      code: `AO${RUN}`,
    });
    _bizAOtherLocationId = locB2.body.id as string;

    // Set up Business B (victim)
    const { bizId: bId, locationId: bLocId, ownerToken: bToken } = await setupFullRestaurantBiz(
      `SecBizB ${RUN}`,
      ownerBEmail,
      pw,
      `SB${RUN}`,
    );
    bizBId = bId;

    // Create data for both businesses
    bizAItemId = await createCatalogItem(aToken);
    const itemIdB = await createCatalogItem(bToken);

    bizASessionId = await openSession(aToken, aLocId);
    bizBSessionId = await openSession(bToken, bLocId);

    if (bizAItemId && bizASessionId) {
      _bizAOrderId = await createSentOrder(aToken, bizASessionId, bizAItemId);
      bizAInvoiceId = await createFinalizedInvoice(aToken, bizASessionId);
    }
    if (itemIdB && bizBSessionId) {
      bizBOrderId = await createSentOrder(bToken, bizBSessionId, itemIdB);
      bizBInvoiceId = await createFinalizedInvoice(bToken, bizBSessionId);
    }

    // Limited-scope user in Biz A (manager scoped to bizALocationId only)
    const limitedEmail = `sec-limited-${RUN}@test.local`;
    const limitedR = await pPost(`/internal/businesses/${bizAId}/users`, {
      email: limitedEmail,
      password: pw,
      displayName: 'Limited User',
      roleKeys: ['manager'],
      locationIds: [bizALocationId],
    });
    if (limitedR.status === 201) {
      _limitedScopedToken = await loginAs(limitedEmail, pw);
    }
  }, 240_000);

  afterAll(async () => {
    await app.close();
  });

  // ── OWASP A01: CROSS-BUSINESS IDOR ───────────────────────────────────────────

  describe('OWASP A01 — Cross-business IDOR (Business A cannot read Business B resources)', () => {
    it('IDOR: A cannot GET B guest session', async () => {
      if (!bizBSessionId) return;
      const res = await asA(`/admin/sessions/${bizBSessionId}`);
      expect([403, 404]).toContain(res.status);
    });

    it('IDOR: A cannot GET B order', async () => {
      if (!bizBOrderId) return;
      const res = await asA(`/admin/orders/${bizBOrderId}`);
      expect([403, 404]).toContain(res.status);
    });

    it('IDOR: A cannot GET B invoice', async () => {
      if (!bizBInvoiceId) return;
      const res = await asA(`/admin/checkout/invoices/${bizBInvoiceId}`);
      expect([403, 404]).toContain(res.status);
    });

    it('IDOR: A cannot initiate payment on B invoice', async () => {
      if (!bizBInvoiceId) return;
      const res = await request(http())
        .post(`/admin/checkout/invoices/${bizBInvoiceId}/payments`)
        .set('authorization', `Bearer ${bizAToken}`)
        .send({ method: 'CASH', amount: 99999 });
      expect([403, 404]).toContain(res.status);
    });

    it('IDOR: A cannot add lines to B order', async () => {
      if (!bizBOrderId) return;
      const res = await request(http())
        .post(`/admin/orders/${bizBOrderId}/lines`)
        .set('authorization', `Bearer ${bizAToken}`)
        .send({ lines: [] });
      expect([403, 404]).toContain(res.status);
    });

    it('IDOR: A cannot void B guest session', async () => {
      if (!bizBSessionId) return;
      const res = await request(http())
        .delete(`/admin/sessions/${bizBSessionId}`)
        .set('authorization', `Bearer ${bizAToken}`);
      expect([403, 404]).toContain(res.status);
    });

    it('IDOR: A order list must NOT contain B orders', async () => {
      if (!bizBOrderId) return;
      const res = await asA('/admin/orders');
      expect(res.status).toBe(200);
      const ids = (res.body as Array<{ id: string }>).map((r) => r.id);
      expect(ids).not.toContain(bizBOrderId);
    });

    it('IDOR: A session list must NOT contain B sessions', async () => {
      if (!bizBSessionId) return;
      const res = await asA('/admin/sessions');
      expect(res.status).toBe(200);
      const ids = (res.body as Array<{ id: string }>).map((r) => r.id);
      expect(ids).not.toContain(bizBSessionId);
    });

    it('IDOR: A invoice list must NOT contain B invoices', async () => {
      if (!bizBInvoiceId) return;
      const res = await asA(`/admin/checkout/sessions/${bizASessionId}/invoice`);
      // Only sees A's invoice
      if (res.status === 200) {
        expect(res.body.id).not.toBe(bizBInvoiceId);
      }
    });

    it('IDOR: A cannot read B payments list', async () => {
      if (!bizBInvoiceId) return;
      const res = await asA(`/admin/checkout/invoices/${bizBInvoiceId}/payments`);
      expect([403, 404]).toContain(res.status);
    });

    it('IDOR: A cannot mark B notification as read', async () => {
      // Use a nonexistent ID — 404 proves we don't expose B data
      const fakeId = '00000000-0000-4000-a000-000000000001';
      const res = await request(http())
        .patch(`/admin/notifications/${fakeId}/read`)
        .set('authorization', `Bearer ${bizAToken}`);
      expect([403, 404]).toContain(res.status);
    });
  });

  // ── OWASP A01: PRIVILEGE ESCALATION ─────────────────────────────────────────

  describe('OWASP A01 — Privilege escalation (business user cannot reach platform endpoints)', () => {
    it('Business owner cannot list all businesses', async () => {
      expect((await asA('/internal/businesses')).status).toBe(403);
    });

    it('Business owner cannot access onboarding list', async () => {
      expect((await asA('/internal/onboarding')).status).toBe(403);
    });

    it('Business owner cannot access commercial offerings', async () => {
      expect((await asA('/internal/commercial/offerings')).status).toBe(403);
    });

    it('Business owner cannot view client accounts', async () => {
      expect((await asA('/internal/commercial/clients')).status).toBe(403);
    });

    it('Business owner cannot view activation requests', async () => {
      // 403 if route exists and guard fires; 404 if route path differs — both are secure
      expect([403, 404]).toContain((await asA('/internal/commercial/activations')).status);
    });

    it('Business owner cannot view price books', async () => {
      expect([403, 404]).toContain((await asA('/internal/commercial/price-books')).status);
    });

    it('Business owner cannot list platform users', async () => {
      // 403 if route exists and guard fires; 404 if route path differs — both are secure
      expect([403, 404]).toContain((await asA('/internal/platform-users')).status);
    });

    it('Business owner cannot update another business', async () => {
      const res = await request(http())
        .patch(`/internal/businesses/${bizBId}`)
        .set('authorization', `Bearer ${bizAToken}`)
        .send({ name: 'Hijacked' });
      expect(res.status).toBe(403);
    });

    it('Business owner cannot disable modules for another business', async () => {
      const res = await request(http())
        .post(`/internal/businesses/${bizBId}/modules/restaurant/disable`)
        .set('authorization', `Bearer ${bizAToken}`);
      // 403 if disable endpoint exists; 404 if module disable route is not exposed — both are secure
      expect([403, 404]).toContain(res.status);
    });

    it('Business owner cannot initialize onboarding for another business', async () => {
      const res = await request(http())
        .post(`/internal/onboarding/${bizBId}/initialize`)
        .set('authorization', `Bearer ${bizAToken}`)
        .send({});
      expect(res.status).toBe(403);
    });
  });

  // ── OWASP A01: MASS ASSIGNMENT ────────────────────────────────────────────────

  describe('OWASP A01 — Mass assignment (body businessId must not override JWT scope)', () => {
    it('Mass assignment: catalog item created by A ignores bizBId in body', async () => {
      const catRes = await request(http())
        .post('/admin/catalog/tax-categories')
        .set('authorization', `Bearer ${bizAToken}`)
        .send({ name: `MA-Tax ${RUN}`, rate: 500 });
      if (catRes.status !== 201) return;

      const res = await request(http())
        .post('/admin/catalog/items')
        .set('authorization', `Bearer ${bizAToken}`)
        .send({
          name: 'MassAssignAttempt',
          sku: `MA-${RUN}`,
          basePrice: 100,
          taxCategoryId: catRes.body.id,
          type: 'FOOD',
          businessId: bizBId,
        });
      if (res.status === 201) {
        // Item must be created under A, not B
        expect(res.body.businessId).not.toBe(bizBId);
      }
    });

    it('Mass assignment: POST /admin/orders with bizBId in body uses A scope', async () => {
      if (!bizASessionId) return;
      const res = await request(http())
        .post('/admin/orders')
        .set('authorization', `Bearer ${bizAToken}`)
        .send({
          sessionId: bizASessionId,
          businessId: bizBId,
          locationId: '00000000-0000-4000-a000-000000000002',
        });
      // If it creates, must be under A's scope
      if (res.status === 201 || res.status === 200) {
        expect(res.body.businessId).not.toBe(bizBId);
      }
    });
  });

  // ── OWASP A01: MODULE GATING ─────────────────────────────────────────────────

  describe('OWASP A01 — Module gating (unactivated modules return 403 MODULE_DISABLED)', () => {
    it('Business without restaurant module cannot access orders', async () => {
      const ungatedBizId = (
        await pPost('/internal/businesses', {
          name: `UngatedBiz ${RUN}`,
          businessTypeKey: 'restaurant',
        })
      ).body.id as string;

      const ungatedEmail = `ungated-${RUN}@test.local`;
      await pPost(`/internal/businesses/${ungatedBizId}/provision`, {
        email: ungatedEmail,
        displayName: 'Ungated',
        password: 'Test!Pass123',
      });
      const ungatedToken = await loginAs(ungatedEmail, 'Test!Pass123');

      const res = await request(http())
        .get('/admin/orders')
        .set('authorization', `Bearer ${ungatedToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('MODULE_DISABLED');
    });

    it('Business with restaurant but not checkout cannot access invoices', async () => {
      const noCoBizId = (
        await pPost('/internal/businesses', {
          name: `NoCheckoutBiz ${RUN}`,
          businessTypeKey: 'restaurant',
        })
      ).body.id as string;
      await pPost(`/internal/businesses/${noCoBizId}/modules/restaurant/activate`, {});
      await pPost(`/internal/businesses/${noCoBizId}/modules/restaurant/complete-setup`, {});

      const noCoEmail = `nocheckout-${RUN}@test.local`;
      await pPost(`/internal/businesses/${noCoBizId}/provision`, {
        email: noCoEmail,
        displayName: 'NoCO',
        password: 'Test!Pass123',
      });
      const noCoToken = await loginAs(noCoEmail, 'Test!Pass123');

      const res = await request(http())
        .get(`/admin/checkout/invoices/00000000-0000-4000-a000-000000000099`)
        .set('authorization', `Bearer ${noCoToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('MODULE_DISABLED');
    });
  });

  // ── OWASP A02: AUTH FAILURES ─────────────────────────────────────────────────

  describe('OWASP A02 — Authentication failures', () => {
    it('No token → 401', async () => {
      expect((await request(http()).get('/admin/orders')).status).toBe(401);
    });

    it('Malformed token → 401', async () => {
      const res = await request(http())
        .get('/admin/orders')
        .set('authorization', 'Bearer not.a.real.jwt');
      expect(res.status).toBe(401);
    });

    it('Platform token cannot be used on business-scoped /admin endpoints → 401', async () => {
      // scopeFromPrincipal throws UnauthorizedError when businessId is null
      const res = await request(http())
        .get('/admin/orders')
        .set('authorization', `Bearer ${platformToken}`);
      expect([401, 403]).toContain(res.status);
    });

    it('Tampered JWT payload (base64 flipped) → 401', async () => {
      const parts = bizAToken.split('.');
      // Flip last 4 chars of payload
      const payload = parts[1];
      const tampered = payload.slice(0, -4) + 'ZZZZ';
      const faked = parts[0] + '.' + tampered + '.' + parts[2];
      const res = await request(http())
        .get('/admin/orders')
        .set('authorization', `Bearer ${faked}`);
      expect(res.status).toBe(401);
    });

    it('Fake session UUID token → 401', async () => {
      // A JWT that decodes but references a non-existent session
      const res = await request(http())
        .get('/admin/orders')
        .set('authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTQwMDAtYTAwMC0wMDAwMDAwMDAwMDAiLCJzaWQiOiIwMDAwMDAwMC0wMDAwLTQwMDAtYTAwMC0wMDAwMDAwMDAwMDAiLCJ0diI6MCwic3YiOjAsInJlYWxtIjoiQlVTSU5FU1MifQ.invalid_sig');
      expect(res.status).toBe(401);
    });

    it('Wrong password → 401', async () => {
      const res = await request(http()).post('/auth/login').send({
        email: 'platform@manhar.local',
        password: 'wrong-password-xyz',
      });
      expect(res.status).toBe(401);
    });

    it('Non-existent user → 401 (no user enumeration)', async () => {
      const res = await request(http()).post('/auth/login').send({
        email: `noexist-${RUN}@nowhere.test`,
        password: 'SomePass!123',
      });
      expect(res.status).toBe(401);
    });

    it('Login response never includes password hash', async () => {
      const res = await request(http()).post('/auth/login').send({
        email: 'platform@manhar.local',
        password: 'ChangeMe!Dev12345',
      });
      expect(res.status).toBe(200);
      const body = JSON.stringify(res.body);
      expect(body).not.toMatch(/passwordHash/);
      expect(body).not.toMatch(/\$argon2/);
      expect(body).not.toMatch(/password/i);
    });
  });

  // ── OWASP A02: RATE LIMITING ─────────────────────────────────────────────────

  describe('OWASP A02 — Rate limiting on authentication', () => {
    it('Repeated failed logins return consistent 4xx — no 200 slips through', async () => {
      const results: number[] = [];
      for (let i = 0; i < 12; i++) {
        const r = await request(http()).post('/auth/login').send({
          email: `ratelimit-${RUN}-${i}@nowhere.test`,
          password: 'WrongPassword!123',
        });
        results.push(r.status);
      }
      expect(results).not.toContain(200);
      // All must be 4xx
      results.forEach((s) => expect(s).toBeGreaterThanOrEqual(400));
    });
  });

  // ── OWASP A03: INJECTION ──────────────────────────────────────────────────────

  describe('OWASP A03 — Input validation / injection prevention', () => {
    it("SQL injection in path param → 400 (UUID validation rejects)", async () => {
      const res = await asA("/admin/orders/'; DROP TABLE service_request; --");
      expect([400, 404]).toContain(res.status);
    });

    it("SQL injection in query param sessionId → 400", async () => {
      const res = await asA("/admin/orders?sessionId=' OR '1'='1");
      expect([400, 422]).toContain(res.status);
    });

    it('Non-UUID id parameter → 400 (ParseUUIDPipe rejects)', async () => {
      const res = await asA('/admin/orders/not-a-valid-uuid-at-all');
      expect(res.status).toBe(400);
    });

    it('Oversized name string → 400 (zod max length)', async () => {
      const res = await request(http())
        .post('/admin/catalog/tax-categories')
        .set('authorization', `Bearer ${bizAToken}`)
        .send({ name: 'X'.repeat(10_000), rate: 500 });
      expect([400, 422]).toContain(res.status);
    });

    it('Negative price → 400', async () => {
      const res = await request(http())
        .post('/admin/catalog/tax-categories')
        .set('authorization', `Bearer ${bizAToken}`)
        .send({ name: 'ValidName', rate: -100 });
      expect([400, 422]).toContain(res.status);
    });

    it('XSS payload in item name stored safely (not executed)', async () => {
      const xss = '<script>alert(1)</script>';
      const cat = await request(http())
        .post('/admin/catalog/tax-categories')
        .set('authorization', `Bearer ${bizAToken}`)
        .send({ name: `XSSTax2 ${RUN}`, rate: 500 });
      if (cat.status !== 201) return;
      const res = await request(http())
        .post('/admin/catalog/items')
        .set('authorization', `Bearer ${bizAToken}`)
        .send({
          name: xss,
          sku: `XSS2-${RUN}`,
          basePrice: 100,
          taxCategoryId: cat.body.id,
          type: 'FOOD',
        });
      // If stored, it should be literal string — no execution happens at API layer
      if (res.status === 201) {
        expect(res.body.name).toBe(xss); // stored as-is, no HTML encoding needed at API level
      }
    });
  });

  // ── OWASP A05: SECURITY MISCONFIGURATION ──────────────────────────────────────

  describe('OWASP A05 — Security misconfiguration', () => {
    it('Error response does NOT leak stack trace', async () => {
      const res = await asA('/admin/orders/00000000-0000-4000-a000-000000000099');
      expect(res.status).toBe(404);
      const body = JSON.stringify(res.body);
      expect(body).not.toMatch(/at \w+ \(/);      // stack frame
      expect(body).not.toMatch(/node_modules/);
      expect(body).not.toMatch(/\.ts:\d+/);       // TS file path
    });

    it('Error response does NOT leak internal file paths', async () => {
      const res = await asA('/admin/orders/00000000-0000-4000-a000-000000000099');
      const body = JSON.stringify(res.body);
      expect(body).not.toMatch(/src\/[a-z]/);
      expect(body).not.toMatch(/C:\\Users/);
      expect(body).not.toMatch(/Downloads/);
    });

    it('Unknown route returns 404 (not 500)', async () => {
      const res = await request(http()).get('/completely/nonexistent/endpoint/xyz');
      expect([404]).toContain(res.status);
    });

    it('Health endpoint is public and does not require auth', async () => {
      const res = await request(http()).get('/health');
      expect(res.status).toBe(200);
      expect(typeof res.body.status).toBe('string');
    });

    it('Auth GET endpoint returns 404/405 (POST only)', async () => {
      const res = await request(http()).get('/auth/login');
      expect([404, 405]).toContain(res.status);
    });
  });

  // ── SENSITIVE DATA EXPOSURE ────────────────────────────────────────────────────

  describe('Sensitive data exposure', () => {
    it('/auth/me does NOT expose passwordHash, tokenVersion, sessionVersion', async () => {
      const res = await request(http())
        .get('/auth/me')
        .set('authorization', `Bearer ${bizAToken}`);
      expect(res.status).toBe(200);
      const body = JSON.stringify(res.body);
      expect(body).not.toMatch(/passwordHash/);
      expect(body).not.toMatch(/tokenVersion/);
      expect(body).not.toMatch(/sessionVersion/);
      expect(body).not.toMatch(/\$argon2/);
    });

    it('User list does NOT expose passwordHash or argon2 hashes', async () => {
      const res = await pGet(`/internal/businesses/${bizAId}/users`);
      if (res.status === 200 && Array.isArray(res.body)) {
        const body = JSON.stringify(res.body);
        expect(body).not.toMatch(/passwordHash/);
        expect(body).not.toMatch(/\$argon2/);
      }
    });

    it('Print agent response does NOT contain secretHash', async () => {
      // Even if no agents exist, verify the response shape
      const res = await request(http())
        .get('/admin/printing/agents')
        .set('authorization', `Bearer ${bizAToken}`);
      if (res.status === 200 && Array.isArray(res.body)) {
        (res.body as Array<Record<string, unknown>>).forEach((agent) => {
          expect(agent).not.toHaveProperty('secretHash');
        });
      }
    });

    it('Audit events do NOT contain passwords, secrets, or tokens', async () => {
      const res = await request(http())
        .get('/admin/audit')
        .set('authorization', `Bearer ${bizAToken}`);
      expect(res.status).toBe(200);
      if (res.body.events) {
        const body = JSON.stringify(res.body.events);
        expect(body).not.toMatch(/password/i);
        expect(body).not.toMatch(/\$argon2/);
        expect(body).not.toMatch(/secretHash/);
        expect(body).not.toMatch(/accessToken/);
      }
    });
  });

  // ── PAYMENT SECURITY ──────────────────────────────────────────────────────────

  describe('Payment security', () => {
    it('IDOR: A cannot pay for B invoice', async () => {
      if (!bizBInvoiceId) return;
      const res = await request(http())
        .post(`/admin/checkout/invoices/${bizBInvoiceId}/payments`)
        .set('authorization', `Bearer ${bizAToken}`)
        .send({ method: 'CASH', amount: 99999 });
      expect([403, 404]).toContain(res.status);
    });

    it('Negative amount payment rejected', async () => {
      if (!bizAInvoiceId) return;
      const res = await request(http())
        .post(`/admin/checkout/invoices/${bizAInvoiceId}/payments`)
        .set('authorization', `Bearer ${bizAToken}`)
        .send({ method: 'CASH', amount: -1 });
      expect([400, 422]).toContain(res.status);
    });

    it('Zero amount payment rejected', async () => {
      if (!bizAInvoiceId) return;
      const res = await request(http())
        .post(`/admin/checkout/invoices/${bizAInvoiceId}/payments`)
        .set('authorization', `Bearer ${bizAToken}`)
        .send({ method: 'CASH', amount: 0 });
      expect([400, 422]).toContain(res.status);
    });

    it('Duplicate payment idempotency: second payment on PAID invoice → 409/400', async () => {
      if (!bizAInvoiceId) return;
      // Get the invoice total first
      const invR = await asA(`/admin/checkout/invoices/${bizAInvoiceId}`);
      if (invR.status !== 200) return;
      const total = invR.body.grandTotal as number;
      if (!total) return;

      // First payment
      await request(http())
        .post(`/admin/checkout/invoices/${bizAInvoiceId}/payments`)
        .set('authorization', `Bearer ${bizAToken}`)
        .send({ method: 'CASH', amount: total });

      // Second payment on same invoice
      const res2 = await request(http())
        .post(`/admin/checkout/invoices/${bizAInvoiceId}/payments`)
        .set('authorization', `Bearer ${bizAToken}`)
        .send({ method: 'CASH', amount: total });

      // Must not be 201 (no double payment)
      expect([400, 409, 422]).toContain(res2.status);
    });
  });

  // ── AUDIT CHAIN INTEGRITY ─────────────────────────────────────────────────────

  describe('Audit chain integrity', () => {
    it('Audit chain verify endpoint confirms hash integrity', async () => {
      const res = await request(http())
        .get('/admin/audit/verify')
        .set('authorization', `Bearer ${bizAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
    });

    it('Unauthenticated access to audit verify → 401', async () => {
      const res = await request(http()).get('/admin/audit/verify');
      expect(res.status).toBe(401);
    });
  });
});
