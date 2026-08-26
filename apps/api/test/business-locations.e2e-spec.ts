import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';

// NestJS module compilation + argon2 hashing across multiple owners takes time.
jest.setTimeout(60_000);

/**
 * Phase 4 — Business & Locations E2E suite.
 * Tests: branding, location hours, service modes, business-realm write endpoints,
 * provisioning, and cross-business isolation. All against a real PostgreSQL DB.
 */
describe('Business & Locations — Phase 4 (e2e)', () => {
  let app: INestApplication;
  let platformToken: string;

  // Business A and B for isolation tests.
  let bizAId: string;
  let bizBId: string;
  let ownerAToken: string;
  let ownerBToken: string;
  let locAId: string;
  let locBId: string;

  const RUN = Date.now().toString(36);
  const http = (): ReturnType<INestApplication['getHttpServer']> => app.getHttpServer();

  async function pReq(path: string, body: object): Promise<request.Response> {
    return request(http())
      .post(path)
      .set('authorization', `Bearer ${platformToken}`)
      .send(body);
  }

  async function createBusiness(name: string, extra: Record<string, unknown> = {}): Promise<string> {
    const res = await pReq('/internal/businesses', { name, businessTypeKey: 'restaurant', ...extra });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  async function provisionOwner(businessId: string, suffix: string): Promise<string> {
    const email = `owner-${suffix}-${RUN}@test.local`;
    await request(http())
      .post(`/internal/businesses/${businessId}/provision`)
      .set('authorization', `Bearer ${platformToken}`)
      .send({ email, displayName: 'Owner', password: 'TestPass!123' })
      .expect(201);
    const res = await request(http())
      .post('/auth/login')
      .send({ email, password: 'TestPass!123' })
      .expect(200);
    return res.body.accessToken as string;
  }

  async function adminPost(tok: string, path: string, body: object): Promise<request.Response> {
    return request(http()).post(path).set('authorization', `Bearer ${tok}`).send(body);
  }
  async function adminPatch(tok: string, path: string, body: object): Promise<request.Response> {
    return request(http()).patch(path).set('authorization', `Bearer ${tok}`).send(body);
  }
  async function adminPut(tok: string, path: string, body: object): Promise<request.Response> {
    return request(http()).put(path).set('authorization', `Bearer ${tok}`).send(body);
  }
  async function adminGet(tok: string, path: string): Promise<request.Response> {
    return request(http()).get(path).set('authorization', `Bearer ${tok}`);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    applyHttpDefaults(app);
    await app.init();

    const platformEmail = process.env.PLATFORM_BOOTSTRAP_EMAIL ?? 'platform@manhar.local';
    const platformPassword = process.env.PLATFORM_BOOTSTRAP_PASSWORD ?? 'ChangeMe!Dev12345';
    const loginRes = await request(http())
      .post('/auth/login')
      .send({ email: platformEmail, password: platformPassword })
      .expect(200);
    platformToken = loginRes.body.accessToken as string;

    // Set up two businesses with owners and one location each (for isolation tests).
    bizAId = await createBusiness('Biz A P4');
    bizBId = await createBusiness('Biz B P4');
    ownerAToken = await provisionOwner(bizAId, 'a');
    ownerBToken = await provisionOwner(bizBId, 'b');

    const locARes = await adminPost(ownerAToken, '/admin/locations', { name: 'Loc A', code: 'LA' });
    expect(locARes.status).toBe(201);
    locAId = locARes.body.id as string;

    const locBRes = await adminPost(ownerBToken, '/admin/locations', { name: 'Loc B', code: 'LB' });
    expect(locBRes.status).toBe(201);
    locBId = locBRes.body.id as string;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  // ── Business branding ──────────────────────────────────────────────────────

  describe('Business branding (platform realm)', () => {
    it('creates a business with branding fields', async () => {
      const id = await createBusiness('Branding Co', {
        slug: `branding-co-p4-${RUN}`,
        accentColor: '#FF6B35',
        invoiceName: 'Branding Co Pvt Ltd',
        taxId: '22AAAAA0000A1Z5',
      });
      const res = await request(http())
        .get(`/internal/businesses/${id}`)
        .set('authorization', `Bearer ${platformToken}`)
        .expect(200);
      expect(res.body.slug).toBe(`branding-co-p4-${RUN}`);
      expect(res.body.accentColor).toBe('#FF6B35');
      expect(res.body.invoiceName).toBe('Branding Co Pvt Ltd');
      expect(res.body.taxId).toBe('22AAAAA0000A1Z5');
    });

    it('updates branding fields on an existing business', async () => {
      const id = await createBusiness('Update Brand Co');
      await request(http())
        .patch(`/internal/businesses/${id}`)
        .set('authorization', `Bearer ${platformToken}`)
        .send({ accentColor: '#1A73E8', logoUrl: 'https://cdn.example.com/logo.png' })
        .expect(200);
      const res = await request(http())
        .get(`/internal/businesses/${id}`)
        .set('authorization', `Bearer ${platformToken}`)
        .expect(200);
      expect(res.body.accentColor).toBe('#1A73E8');
      expect(res.body.logoUrl).toBe('https://cdn.example.com/logo.png');
    });

    it('rejects duplicate slugs with 409', async () => {
      const slug = `dup-slug-${RUN}`;
      await createBusiness('Slug A', { slug });
      const res = await pReq('/internal/businesses', {
        name: 'Slug B',
        businessTypeKey: 'restaurant',
        slug,
      });
      expect(res.status).toBe(409);
    });

    it('rejects invalid hex color with 400', async () => {
      const id = await createBusiness('Color Co');
      const res = await request(http())
        .patch(`/internal/businesses/${id}`)
        .set('authorization', `Bearer ${platformToken}`)
        .send({ accentColor: 'not-a-color' });
      expect(res.status).toBe(400);
    });

    it('rejects invalid logoUrl with 400', async () => {
      const id = await createBusiness('Logo Co');
      const res = await request(http())
        .patch(`/internal/businesses/${id}`)
        .set('authorization', `Bearer ${platformToken}`)
        .send({ logoUrl: 'not-a-url' });
      expect(res.status).toBe(400);
    });
  });

  // ── Provisioning ───────────────────────────────────────────────────────────

  describe('Business provisioning', () => {
    it('returns 409 if the business already has an owner (bizAId already provisioned)', async () => {
      const email2 = `downer2-${RUN}@test.local`;
      const res = await request(http())
        .post(`/internal/businesses/${bizAId}/provision`)
        .set('authorization', `Bearer ${platformToken}`)
        .send({ email: email2, displayName: 'Owner 2', password: 'Pass!1234' });
      expect(res.status).toBe(409);
    });

    it('returns 409 if email is already registered', async () => {
      const newBizId = await createBusiness('Email Dup Co');
      const dupEmail = `dup-email-${RUN}@test.local`;
      // First registration succeeds.
      await request(http())
        .post(`/internal/businesses/${newBizId}/provision`)
        .set('authorization', `Bearer ${platformToken}`)
        .send({ email: dupEmail, displayName: 'Owner', password: 'Pass!1234' })
        .expect(201);
      // Second biz uses same email → conflict.
      const newBizId2 = await createBusiness('Email Dup Co 2');
      const res = await request(http())
        .post(`/internal/businesses/${newBizId2}/provision`)
        .set('authorization', `Bearer ${platformToken}`)
        .send({ email: dupEmail, displayName: 'Owner', password: 'Pass!1234' });
      expect(res.status).toBe(409);
    });

    it('provisioned owner can login and access /admin/business', async () => {
      const res = await adminGet(ownerAToken, '/admin/business');
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(bizAId);
    });

    it('returns 404 for a non-existent businessId', async () => {
      const res = await request(http())
        .post('/internal/businesses/00000000-0000-4000-a000-000000000000/provision')
        .set('authorization', `Bearer ${platformToken}`)
        .send({ email: 'x@test.local', displayName: 'X', password: 'Pass!1234' });
      expect(res.status).toBe(404);
    });

    it('provisioned owner result does not include passwordHash', async () => {
      const newBizId = await createBusiness('No Hash Co');
      const email = `nohash-${RUN}@test.local`;
      const res = await request(http())
        .post(`/internal/businesses/${newBizId}/provision`)
        .set('authorization', `Bearer ${platformToken}`)
        .send({ email, displayName: 'Owner', password: 'Pass!1234' })
        .expect(201);
      expect(res.body.owner).not.toHaveProperty('passwordHash');
      expect(res.body.owner.realm).toBe('BUSINESS');
      expect(res.body.owner.businessId).toBe(newBizId);
    });
  });

  // ── Admin business profile ─────────────────────────────────────────────────

  describe('Admin business profile (business realm)', () => {
    it('GET /admin/business returns own business', async () => {
      const res = await adminGet(ownerAToken, '/admin/business');
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(bizAId);
    });

    it('PATCH /admin/business updates own business profile', async () => {
      await adminPatch(ownerAToken, '/admin/business', {
        invoiceAddress: '123 Main Street, Mumbai',
      }).then((r) => expect(r.status).toBe(200));
      const res = await adminGet(ownerAToken, '/admin/business');
      expect(res.body.invoiceAddress).toBe('123 Main Street, Mumbai');
    });

    it('business user only sees their own business — not another', async () => {
      const resA = await adminGet(ownerAToken, '/admin/business');
      const resB = await adminGet(ownerBToken, '/admin/business');
      expect(resA.body.id).toBe(bizAId);
      expect(resB.body.id).toBe(bizBId);
      expect(resA.body.id).not.toBe(resB.body.id);
    });

    it('PATCH /admin/business rejects invalid hex color', async () => {
      const res = await adminPatch(ownerAToken, '/admin/business', { accentColor: 'bad' });
      expect(res.status).toBe(400);
    });
  });

  // ── Location CRUD (business realm) ────────────────────────────────────────

  describe('Admin location CRUD (business realm)', () => {
    it('creates a location and returns businessId from principal', async () => {
      const res = await adminPost(ownerAToken, '/admin/locations', { name: 'Branch X' });
      expect(res.status).toBe(201);
      expect(res.body.businessId).toBe(bizAId);
    });

    it('lists locations scoped to own business only', async () => {
      const res = await adminGet(ownerAToken, '/admin/locations');
      expect(res.status).toBe(200);
      const ids = (res.body as { id: string }[]).map((l) => l.id);
      expect(ids).toContain(locAId);
      expect(ids).not.toContain(locBId);
    });

    it('updates a location via business realm', async () => {
      await adminPatch(ownerAToken, `/admin/locations/${locAId}`, {
        name: 'Loc A Updated',
      }).then((r) => expect(r.status).toBe(200));
      const res = await adminGet(ownerAToken, `/admin/locations/${locAId}`);
      expect(res.body.name).toBe('Loc A Updated');
    });

    it('cross-business: GET another biz location returns 404', async () => {
      const res = await adminGet(ownerAToken, `/admin/locations/${locBId}`);
      expect(res.status).toBe(404);
    });

    it('cross-business: PATCH another biz location returns 404', async () => {
      const res = await adminPatch(ownerAToken, `/admin/locations/${locBId}`, { name: 'Hacked' });
      expect(res.status).toBe(404);
    });
  });

  // ── Location hours ─────────────────────────────────────────────────────────

  describe('Location hours (business realm)', () => {
    it('initially has no hours', async () => {
      const res = await adminGet(ownerAToken, `/admin/locations/${locAId}/hours`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('upserts operating hours for the full week', async () => {
      const hours = [
        { dayOfWeek: 0, isClosed: true },
        { dayOfWeek: 1, isClosed: false, openTime: '09:00', closeTime: '22:00' },
        { dayOfWeek: 2, isClosed: false, openTime: '09:00', closeTime: '22:00' },
        { dayOfWeek: 3, isClosed: false, openTime: '09:00', closeTime: '22:00' },
        { dayOfWeek: 4, isClosed: false, openTime: '09:00', closeTime: '22:00' },
        { dayOfWeek: 5, isClosed: false, openTime: '09:00', closeTime: '23:00' },
        { dayOfWeek: 6, isClosed: false, openTime: '09:00', closeTime: '23:00' },
      ];
      const res = await adminPut(ownerAToken, `/admin/locations/${locAId}/hours`, { hours });
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(7);
      const sunday = res.body.find((h: { dayOfWeek: number }) => h.dayOfWeek === 0);
      expect(sunday.isClosed).toBe(true);
      expect(sunday.openTime).toBeNull();
      const monday = res.body.find((h: { dayOfWeek: number }) => h.dayOfWeek === 1);
      expect(monday.openTime).toBe('09:00');
    });

    it('partial update replaces only specified days', async () => {
      await adminPut(ownerAToken, `/admin/locations/${locAId}/hours`, {
        hours: [{ dayOfWeek: 1, isClosed: false, openTime: '10:00', closeTime: '21:00' }],
      }).then((r) => expect(r.status).toBe(200));
      const res = await adminGet(ownerAToken, `/admin/locations/${locAId}/hours`);
      const monday = res.body.find((h: { dayOfWeek: number }) => h.dayOfWeek === 1);
      expect(monday.openTime).toBe('10:00');
      // other days unchanged
      const friday = res.body.find((h: { dayOfWeek: number }) => h.dayOfWeek === 4);
      expect(friday.openTime).toBe('09:00');
    });

    it('rejects missing openTime when isClosed=false with 400', async () => {
      const res = await adminPut(ownerAToken, `/admin/locations/${locAId}/hours`, {
        hours: [{ dayOfWeek: 2, isClosed: false }],
      });
      expect(res.status).toBe(400);
    });

    it('rejects invalid time format (single-digit hour) with 400', async () => {
      const res = await adminPut(ownerAToken, `/admin/locations/${locAId}/hours`, {
        hours: [{ dayOfWeek: 2, isClosed: false, openTime: '9:00', closeTime: '22:00' }],
      });
      expect(res.status).toBe(400);
    });

    it('cross-business: cannot GET hours for another business location', async () => {
      const res = await adminGet(ownerAToken, `/admin/locations/${locBId}/hours`);
      expect(res.status).toBe(404);
    });

    it('cross-business: cannot PUT hours for another business location', async () => {
      const res = await adminPut(ownerAToken, `/admin/locations/${locBId}/hours`, {
        hours: [{ dayOfWeek: 1, isClosed: false, openTime: '08:00', closeTime: '20:00' }],
      });
      expect(res.status).toBe(404);
    });
  });

  // ── Service modes ──────────────────────────────────────────────────────────

  describe('Location service modes (business realm)', () => {
    it('initially has no service modes', async () => {
      const res = await adminGet(ownerAToken, `/admin/locations/${locAId}/service-modes`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('upserts service modes', async () => {
      const res = await adminPut(ownerAToken, `/admin/locations/${locAId}/service-modes`, {
        modes: [{ mode: 'DINE_IN', isEnabled: true }, { mode: 'TAKEOUT', isEnabled: true }],
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.some((m: { mode: string }) => m.mode === 'DINE_IN')).toBe(true);
    });

    it('disables a service mode', async () => {
      await adminPut(ownerAToken, `/admin/locations/${locAId}/service-modes`, {
        modes: [{ mode: 'TAKEOUT', isEnabled: false }],
      }).then((r) => expect(r.status).toBe(200));
      const res = await adminGet(ownerAToken, `/admin/locations/${locAId}/service-modes`);
      const takeout = res.body.find((m: { mode: string }) => m.mode === 'TAKEOUT');
      expect(takeout.isEnabled).toBe(false);
      // DINE_IN unchanged (still enabled from previous test)
      const dineIn = res.body.find((m: { mode: string }) => m.mode === 'DINE_IN');
      expect(dineIn.isEnabled).toBe(true);
    });

    it('rejects invalid service mode with 400', async () => {
      const res = await adminPut(ownerAToken, `/admin/locations/${locAId}/service-modes`, {
        modes: [{ mode: 'INVALID_MODE', isEnabled: true }],
      });
      expect(res.status).toBe(400);
    });

    it('cross-business isolation: cannot GET service modes for another business location', async () => {
      const res = await adminGet(ownerAToken, `/admin/locations/${locBId}/service-modes`);
      expect(res.status).toBe(404);
    });

    it('cross-business isolation: cannot PUT service modes for another business location', async () => {
      const res = await adminPut(ownerAToken, `/admin/locations/${locBId}/service-modes`, {
        modes: [{ mode: 'DINE_IN', isEnabled: true }],
      });
      expect(res.status).toBe(404);
    });
  });
});
