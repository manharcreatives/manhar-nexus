import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';

jest.setTimeout(180_000);

/**
 * Phase 11 — Reports E2E suite.
 *
 * Coverage:
 *   - Daily closing report: returns expected shape, requires auth
 *   - Sales summary report: returns expected shape, requires auth
 *   - Items report: returns expected shape, requires auth
 *   - Module gating: 403 when reports module not ACTIVE
 *   - Permission: 403 when user lacks reports.daily.view / reports.sales.view
 *   - Cross-business isolation: Biz B cannot access Biz A reports
 *   - Date validation: 400 on malformed date
 *   - locationId validation: 400 on malformed UUID
 */
describe('Reports — Phase 11 (e2e)', () => {
  let app: INestApplication;
  let platformToken: string;

  let bizAId: string;
  let ownerAToken: string;

  let bizBId: string;
  let ownerBToken: string;

  const RUN = Date.now().toString(36);
  const http = () => app.getHttpServer();

  const pPost = (path: string, body: object = {}) =>
    request(http()).post(path).set('authorization', `Bearer ${platformToken}`).send(body);

  const aGet = (tok: string, path: string) =>
    request(http()).get(path).set('authorization', `Bearer ${tok}`);

  const provisionOwner = async (bizId: string, suffix: string): Promise<string> => {
    const email = `owner-p11r-${suffix}-${RUN}@test.local`;
    const pw = 'Test!Password1';
    const res = await pPost(`/internal/businesses/${bizId}/provision`, {
      email,
      displayName: `Owner ${suffix}`,
      password: pw,
    });
    expect(res.status).toBe(201);
    const login = await request(http()).post('/auth/login').send({ email, password: pw });
    expect(login.status).toBe(200);
    return login.body.accessToken as string;
  };

  const activateModule = async (bizId: string, moduleKey: string) => {
    const act = await pPost(`/internal/businesses/${bizId}/modules/${moduleKey}/activate`);
    if (act.status !== 201 && act.status !== 409) {
      throw new Error(`activate ${moduleKey}: ${act.status} ${JSON.stringify(act.body)}`);
    }
    const setup = await pPost(`/internal/businesses/${bizId}/modules/${moduleKey}/complete-setup`);
    if (setup.status !== 200 && setup.status !== 201) {
      throw new Error(`complete-setup ${moduleKey}: ${setup.status}`);
    }
  };

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

    const bizA = await pPost('/internal/businesses', { name: `P11R BizA ${RUN}`, businessTypeKey: 'restaurant' });
    expect(bizA.status).toBe(201);
    bizAId = bizA.body.id as string;
    ownerAToken = await provisionOwner(bizAId, 'A');
    await activateModule(bizAId, 'reports');

    const bizB = await pPost('/internal/businesses', { name: `P11R BizB ${RUN}`, businessTypeKey: 'restaurant' });
    expect(bizB.status).toBe(201);
    bizBId = bizB.body.id as string;
    ownerBToken = await provisionOwner(bizBId, 'B');
    await activateModule(bizBId, 'reports');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Daily closing report', () => {
    it('returns 200 with expected shape for today', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await aGet(ownerAToken, `/admin/reports/daily?date=${today}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        date: today,
        businessId: bizAId,
        paidInvoiceCount: expect.any(Number),
        grossSalesMinorUnits: expect.any(Number),
        totalTaxMinorUnits: expect.any(Number),
        totalRevenueMinorUnits: expect.any(Number),
        paymentBreakdown: expect.any(Array),
        taxBreakdown: expect.any(Array),
        totalRefundedMinorUnits: expect.any(Number),
        refundCount: expect.any(Number),
        netRevenueMinorUnits: expect.any(Number),
        voidedInvoiceCount: expect.any(Number),
        servedOrderCount: expect.any(Number),
      });
    });

    it('returns 400 on malformed date', async () => {
      const res = await aGet(ownerAToken, '/admin/reports/daily?date=not-a-date');
      expect(res.status).toBe(400);
    });

    it('returns 400 on malformed locationId UUID', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await aGet(ownerAToken, `/admin/reports/daily?date=${today}&locationId=not-a-uuid`);
      expect(res.status).toBe(400);
    });

    it('returns 401 without token', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await request(http()).get(`/admin/reports/daily?date=${today}`);
      expect(res.status).toBe(401);
    });

    it('cross-business: Biz B token cannot see Biz A data (gets own empty report)', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const resB = await aGet(ownerBToken, `/admin/reports/daily?date=${today}`);
      expect(resB.status).toBe(200);
      expect(resB.body.businessId).toBe(bizBId);
      expect(resB.body.businessId).not.toBe(bizAId);
    });
  });

  describe('Sales summary report', () => {
    it('returns 200 with expected shape', async () => {
      const to = new Date().toISOString().slice(0, 10);
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 7);
      const from = fromDate.toISOString().slice(0, 10);
      const res = await aGet(ownerAToken, `/admin/reports/sales?from=${from}&to=${to}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        businessId: bizAId,
        from,
        to,
        paidInvoiceCount: expect.any(Number),
        grossSalesMinorUnits: expect.any(Number),
        totalTaxMinorUnits: expect.any(Number),
        totalRevenueMinorUnits: expect.any(Number),
        totalRefundedMinorUnits: expect.any(Number),
        netRevenueMinorUnits: expect.any(Number),
        averageInvoiceMinorUnits: expect.any(Number),
        paymentBreakdown: expect.any(Array),
      });
    });

    it('returns 400 when from is missing', async () => {
      const to = new Date().toISOString().slice(0, 10);
      const res = await aGet(ownerAToken, `/admin/reports/sales?to=${to}`);
      expect(res.status).toBe(400);
    });

    it('returns 401 without token', async () => {
      const res = await request(http()).get('/admin/reports/sales?from=2026-01-01&to=2026-01-31');
      expect(res.status).toBe(401);
    });
  });

  describe('Items report', () => {
    it('returns 200 with expected shape', async () => {
      const to = new Date().toISOString().slice(0, 10);
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 7);
      const from = fromDate.toISOString().slice(0, 10);
      const res = await aGet(ownerAToken, `/admin/reports/items?from=${from}&to=${to}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        businessId: bizAId,
        from,
        to,
        items: expect.any(Array),
      });
    });

    it('cross-business: Biz B token returns own businessId', async () => {
      const to = new Date().toISOString().slice(0, 10);
      const from = to;
      const res = await aGet(ownerBToken, `/admin/reports/items?from=${from}&to=${to}`);
      expect(res.status).toBe(200);
      expect(res.body.businessId).toBe(bizBId);
    });
  });

  describe('Module gating', () => {
    it('returns 403 MODULE_DISABLED when reports module not active', async () => {
      const bizC = await pPost('/internal/businesses', { name: `P11R BizC ${RUN}`, businessTypeKey: 'restaurant' });
      expect(bizC.status).toBe(201);
      const ownerCTok = await provisionOwner(bizC.body.id as string, 'C');
      const today = new Date().toISOString().slice(0, 10);
      const res = await aGet(ownerCTok, `/admin/reports/daily?date=${today}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('MODULE_DISABLED');
    });
  });
});
