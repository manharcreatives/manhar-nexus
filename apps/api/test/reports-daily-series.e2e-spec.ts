import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';

jest.setTimeout(180_000);

/**
 * GET /admin/reports/daily-series — per-day revenue for the Home strip and the
 * Sales Summary trend chart. Covers zero-fill, totals matching the Sales
 * Summary, refunds, validation bounds, permission, auth and tenant isolation.
 */
describe('Reports daily series (e2e)', () => {
  let app: INestApplication;
  let platformToken: string;
  let ownerAToken: string;
  let ownerBToken: string;
  let cashierToken: string;
  let locAId: string;
  let bizAId: string;
  let bizBId: string;

  const RUN = Date.now().toString(36);
  const PW = 'Test!Password1';
  const http = () => app.getHttpServer();
  const pPost = (path: string, body: object = {}) =>
    request(http()).post(path).set('authorization', `Bearer ${platformToken}`).send(body);
  const aGet = (tok: string, path: string) => request(http()).get(path).set('authorization', `Bearer ${tok}`);
  const aPost = (tok: string, path: string, body: object = {}) =>
    request(http()).post(path).set('authorization', `Bearer ${tok}`).send(body);
  const freshKey = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });

  const isoDay = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  const today = isoDay(0);
  const weekAgo = isoDay(-6);

  const login = async (email: string): Promise<string> => {
    const res = await request(http()).post('/auth/login').send({ email, password: PW });
    expect(res.status).toBe(200);
    return res.body.accessToken as string;
  };
  const provisionOwner = async (bizId: string, suffix: string): Promise<string> => {
    const email = `owner-ds-${suffix}-${RUN}@test.local`;
    const res = await pPost(`/internal/businesses/${bizId}/provision`, { email, displayName: `Owner ${suffix}`, password: PW });
    expect(res.status).toBe(201);
    return login(email);
  };
  const activate = async (bizId: string, key: string): Promise<void> => {
    const a = await pPost(`/internal/businesses/${bizId}/modules/${key}/activate`);
    if (a.status !== 201 && a.status !== 409) throw new Error(`activate ${key}: ${a.status}`);
    const s = await pPost(`/internal/businesses/${bizId}/modules/${key}/complete-setup`);
    if (s.status !== 200 && s.status !== 201) throw new Error(`setup ${key}: ${s.status}`);
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    applyHttpDefaults(app);
    await app.init();

    const l = await request(http())
      .post('/auth/login')
      .send({
        email: process.env.PLATFORM_BOOTSTRAP_EMAIL ?? 'platform@manhar.local',
        password: process.env.PLATFORM_BOOTSTRAP_PASSWORD ?? 'ChangeMe!Dev12345',
      });
    platformToken = l.body.accessToken as string;

    bizAId = (await pPost('/internal/businesses', { name: `DS BizA ${RUN}`, businessTypeKey: 'restaurant' })).body.id as string;
    bizBId = (await pPost('/internal/businesses', { name: `DS BizB ${RUN}`, businessTypeKey: 'restaurant' })).body.id as string;
    ownerAToken = await provisionOwner(bizAId, 'A');
    ownerBToken = await provisionOwner(bizBId, 'B');
    locAId = (await pPost(`/internal/businesses/${bizAId}/locations`, { name: `LocDS ${RUN}`, timezone: 'Asia/Kolkata' })).body
      .id as string;
    for (const b of [bizAId, bizBId]) {
      for (const m of ['restaurant', 'catalog', 'checkout', 'reports']) await activate(b, m);
    }

    // One paid cash invoice today: 2 x (1000 + 5% tax) = 2100, then a 500 refund.
    const taxCatId = (await aPost(ownerAToken, '/admin/catalog/tax-categories', { name: 'GST 5%', rate: 0.05, isDefault: true }))
      .body.id as string;
    const catId = (await aPost(ownerAToken, '/admin/catalog/categories', { name: `DS Cat ${RUN}`, sortOrder: 0 })).body.id as string;
    const itemId = (
      await aPost(ownerAToken, '/admin/catalog/items', {
        categoryId: catId,
        name: 'DS Thali',
        basePriceMinorUnits: 1000,
        taxCategoryId: taxCatId,
        isAvailable: true,
      })
    ).body.id as string;
    const areaId = (await aPost(ownerAToken, '/admin/dining/areas', { locationId: locAId, name: `Hall DS ${RUN}`, sortOrder: 0 }))
      .body.id as string;
    const tableId = (
      await aPost(ownerAToken, '/admin/dining/tables', { diningAreaId: areaId, locationId: locAId, code: `DS${RUN}`, capacity: 2 })
    ).body.id as string;
    const sessionId = (await aPost(ownerAToken, '/admin/sessions', { locationId: locAId, diningTableId: tableId, partySize: 2 }))
      .body.id as string;
    const orderId = (
      await aPost(ownerAToken, '/admin/orders', { sessionId, idempotencyKey: freshKey(), lines: [{ catalogItemId: itemId, quantity: 2 }] })
    ).body.id as string;
    await aPost(ownerAToken, `/admin/orders/${orderId}/send`, {});
    const invoiceId = (await aPost(ownerAToken, `/admin/checkout/sessions/${sessionId}/invoice`, {})).body.id as string;
    expect((await aPost(ownerAToken, `/admin/checkout/invoices/${invoiceId}/finalise`, {})).status).toBe(201);
    const pay = await aPost(ownerAToken, `/admin/checkout/invoices/${invoiceId}/payments`, {
      idempotencyKey: freshKey(),
      method: 'CASH',
      amountMinorUnits: 2100,
      cashReceivedMinorUnits: 2100,
    });
    expect(pay.status).toBe(201);
    const refund = await aPost(ownerAToken, `/admin/checkout/payments/${pay.body.id as string}/refunds`, {
      reason: 'cold soup',
      amountMinorUnits: 500,
    });
    expect(refund.status).toBe(201);

    // checkout-associate holds reports.daily.view but not reports.sales.view.
    const cashierEmail = `cashier-ds-${RUN}@test.local`;
    const created = await aPost(ownerAToken, '/admin/users', {
      email: cashierEmail,
      password: PW,
      displayName: 'cashier',
      roleKeys: ['checkout-associate'],
    });
    expect(created.status).toBe(201);
    cashierToken = await login(cashierEmail);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns one zero-filled point per day, in order, with UTC bucketing', async () => {
    const res = await aGet(ownerAToken, `/admin/reports/daily-series?from=${weekAgo}&to=${today}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ from: weekAgo, to: today, businessId: bizAId, timezone: 'UTC' });
    const days = res.body.days as { date: string }[];
    expect(days).toHaveLength(7);
    expect(days[0].date).toBe(weekAgo);
    expect(days[6].date).toBe(today);
    expect(days.map((d) => d.date)).toEqual([...days.map((d) => d.date)].sort());
  });

  it("puts today's paid invoice and its refund on today", async () => {
    const res = await aGet(ownerAToken, `/admin/reports/daily-series?from=${today}&to=${today}`);
    expect(res.status).toBe(200);
    const [day] = res.body.days;
    expect(day).toMatchObject({
      date: today,
      paidInvoiceCount: 1,
      grossSalesMinorUnits: 2000,
      totalRevenueMinorUnits: 2100,
    });
    expect(day.netRevenueMinorUnits).toBe(day.totalRevenueMinorUnits - day.totalRefundedMinorUnits);
  });

  it('sums to the Sales Summary for the same range', async () => {
    const [series, summary] = await Promise.all([
      aGet(ownerAToken, `/admin/reports/daily-series?from=${weekAgo}&to=${today}`),
      aGet(ownerAToken, `/admin/reports/sales?from=${weekAgo}&to=${today}`),
    ]);
    expect(series.status).toBe(200);
    expect(summary.status).toBe(200);
    type Day = { paidInvoiceCount: number; totalRevenueMinorUnits: number; totalRefundedMinorUnits: number; netRevenueMinorUnits: number };
    const sum = (k: keyof Day) => (series.body.days as Day[]).reduce((s, d) => s + d[k], 0);
    expect(sum('paidInvoiceCount')).toBe(summary.body.paidInvoiceCount);
    expect(sum('totalRevenueMinorUnits')).toBe(summary.body.totalRevenueMinorUnits);
    expect(sum('totalRefundedMinorUnits')).toBe(summary.body.totalRefundedMinorUnits);
    expect(sum('netRevenueMinorUnits')).toBe(summary.body.netRevenueMinorUnits);
  });

  it('filters by locationId', async () => {
    const other = '00000000-0000-4000-8000-000000000000';
    const res = await aGet(ownerAToken, `/admin/reports/daily-series?from=${today}&to=${today}&locationId=${other}`);
    expect(res.status).toBe(200);
    expect(res.body.days[0].paidInvoiceCount).toBe(0);
    const own = await aGet(ownerAToken, `/admin/reports/daily-series?from=${today}&to=${today}&locationId=${locAId}`);
    expect(own.body.days[0].paidInvoiceCount).toBe(1);
  });

  it('is tenant isolated: another business sees its own empty series', async () => {
    const res = await aGet(ownerBToken, `/admin/reports/daily-series?from=${today}&to=${today}`);
    expect(res.status).toBe(200);
    expect(res.body.businessId).toBe(bizBId);
    expect(res.body.days[0]).toMatchObject({ paidInvoiceCount: 0, totalRevenueMinorUnits: 0, netRevenueMinorUnits: 0 });
  });

  it.each([
    ['malformed date', 'from=not-a-date&to=2026-01-01'],
    ['impossible date', 'from=2026-02-31&to=2026-03-02'],
    ['from after to', 'from=2026-03-02&to=2026-03-01'],
    ['range over 92 days', 'from=2026-01-01&to=2026-04-03'],
    ['missing to', 'from=2026-01-01'],
    ['malformed locationId', 'from=2026-01-01&to=2026-01-02&locationId=nope'],
    ['unknown parameter', 'from=2026-01-01&to=2026-01-02&extra=1'],
  ])('returns 400 for %s', async (_label, qs) => {
    const res = await aGet(ownerAToken, `/admin/reports/daily-series?${qs}`);
    expect(res.status).toBe(400);
  });

  it('accepts exactly 92 days', async () => {
    const res = await aGet(ownerAToken, '/admin/reports/daily-series?from=2026-01-01&to=2026-04-02');
    expect(res.status).toBe(200);
    expect(res.body.days).toHaveLength(92);
  });

  it('denies a role without reports.sales.view (403)', async () => {
    const res = await aGet(cashierToken, `/admin/reports/daily-series?from=${today}&to=${today}`);
    expect(res.status).toBe(403);
  });

  it('requires authentication (401)', async () => {
    const res = await request(http()).get(`/admin/reports/daily-series?from=${today}&to=${today}`);
    expect(res.status).toBe(401);
  });
});
