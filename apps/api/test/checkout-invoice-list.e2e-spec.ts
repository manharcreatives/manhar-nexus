import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';

jest.setTimeout(180_000);

/**
 * GET /admin/checkout/invoices - paginated invoice list for the Bills UI.
 * Also covers concurrent-refund safety on the refund endpoint.
 */
describe('Checkout invoice list (e2e)', () => {
  let app: INestApplication;
  let platformToken: string;
  let ownerAToken: string;
  let ownerBToken: string;
  let noCheckoutToken: string;
  let locAId: string;
  let paidInvoiceId: string;
  let paidPaymentId: string;
  let finalisedInvoiceId: string;
  let voidedInvoiceId: string;
  let tableCode: string;

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

  const login = async (email: string): Promise<string> => {
    const res = await request(http()).post('/auth/login').send({ email, password: PW });
    expect(res.status).toBe(200);
    return res.body.accessToken as string;
  };
  const provisionOwner = async (bizId: string, suffix: string): Promise<string> => {
    const email = `owner-il-${suffix}-${RUN}@test.local`;
    const res = await pPost(`/internal/businesses/${bizId}/provision`, {
      email,
      displayName: `Owner ${suffix}`,
      password: PW,
    });
    expect(res.status).toBe(201);
    return login(email);
  };
  const activate = async (bizId: string, key: string): Promise<void> => {
    const a = await pPost(`/internal/businesses/${bizId}/modules/${key}/activate`);
    if (a.status !== 201 && a.status !== 409) throw new Error(`activate ${key}: ${a.status}`);
    const s = await pPost(`/internal/businesses/${bizId}/modules/${key}/complete-setup`);
    if (s.status !== 200 && s.status !== 201) throw new Error(`setup ${key}: ${s.status}`);
  };

  let diningAreaId: string;
  let catalogItemId: string;
  let tableSeq = 0;

  /** Open a session with one sent order and return a finalised invoice id. */
  const makeFinalisedInvoice = async (qty: number): Promise<{ invoiceId: string; code: string }> => {
    const code = `IL${RUN}${tableSeq++}`;
    const t = (
      await aPost(ownerAToken, '/admin/dining/tables', { diningAreaId, locationId: locAId, code, capacity: 2 })
    ).body.id as string;
    const s = (
      await aPost(ownerAToken, '/admin/sessions', { locationId: locAId, diningTableId: t, partySize: 1 })
    ).body.id as string;
    const o = (
      await aPost(ownerAToken, '/admin/orders', {
        sessionId: s,
        idempotencyKey: freshKey(),
        lines: [{ catalogItemId, quantity: qty }],
      })
    ).body.id as string;
    await aPost(ownerAToken, `/admin/orders/${o}/send`, {});
    const invoiceId = (await aPost(ownerAToken, `/admin/checkout/sessions/${s}/invoice`, {})).body.id as string;
    const fin = await aPost(ownerAToken, `/admin/checkout/invoices/${invoiceId}/finalise`, {});
    expect(fin.status).toBe(201);
    return { invoiceId, code };
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

    const bizA = (await pPost('/internal/businesses', { name: `IL BizA ${RUN}`, businessTypeKey: 'restaurant' })).body
      .id as string;
    const bizB = (await pPost('/internal/businesses', { name: `IL BizB ${RUN}`, businessTypeKey: 'restaurant' })).body
      .id as string;
    ownerAToken = await provisionOwner(bizA, 'A');
    ownerBToken = await provisionOwner(bizB, 'B');
    locAId = (
      await pPost(`/internal/businesses/${bizA}/locations`, { name: `LocIL ${RUN}`, timezone: 'Asia/Kolkata' })
    ).body.id as string;
    await pPost(`/internal/businesses/${bizB}/locations`, { name: `LocILB ${RUN}`, timezone: 'Asia/Kolkata' });
    for (const b of [bizA, bizB]) {
      for (const m of ['restaurant', 'catalog', 'checkout']) await activate(b, m);
    }

    const taxCatId = (
      await aPost(ownerAToken, '/admin/catalog/tax-categories', { name: 'GST 5%', rate: 0.05, isDefault: true })
    ).body.id as string;
    const catId = (await aPost(ownerAToken, '/admin/catalog/categories', { name: `IL Cat ${RUN}`, sortOrder: 0 })).body
      .id as string;
    catalogItemId = (
      await aPost(ownerAToken, '/admin/catalog/items', {
        categoryId: catId,
        name: 'IL Burger',
        basePriceMinorUnits: 1000,
        taxCategoryId: taxCatId,
        isAvailable: true,
      })
    ).body.id as string;
    diningAreaId = (
      await aPost(ownerAToken, '/admin/dining/areas', { locationId: locAId, name: `Hall IL ${RUN}`, sortOrder: 0 })
    ).body.id as string;

    // Role without checkout access (service-team)
    const stEmail = `st-il-${RUN}@test.local`;
    const created = await aPost(ownerAToken, '/admin/users', {
      email: stEmail,
      password: PW,
      displayName: 'st',
      roleKeys: ['service-team'],
    });
    expect(created.status).toBe(201);
    noCheckoutToken = await login(stEmail);

    // Paid (cash) invoice, 2 x 1050 = 2100
    const paid = await makeFinalisedInvoice(2);
    paidInvoiceId = paid.invoiceId;
    tableCode = paid.code;
    const pay = await aPost(ownerAToken, `/admin/checkout/invoices/${paidInvoiceId}/payments`, {
      idempotencyKey: freshKey(),
      method: 'CASH',
      amountMinorUnits: 2100,
      cashReceivedMinorUnits: 2100,
    });
    expect(pay.status).toBe(201);
    paidPaymentId = pay.body.id as string;

    // Finalised-unpaid invoice
    finalisedInvoiceId = (await makeFinalisedInvoice(1)).invoiceId;

    // Voided invoice
    voidedInvoiceId = (await makeFinalisedInvoice(1)).invoiceId;
    const v = await aPost(ownerAToken, `/admin/checkout/invoices/${voidedInvoiceId}/void`, { reason: 'test void' });
    expect(v.status).toBe(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns { items, total } newest first with payments and table code', async () => {
    const res = await aGet(ownerAToken, '/admin/checkout/invoices');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.items.map((i: { id: string }) => i.id)).toEqual([
      voidedInvoiceId,
      finalisedInvoiceId,
      paidInvoiceId,
    ]);
    const paid = res.body.items[2];
    expect(paid.status).toBe('PAID');
    expect(paid.invoiceNumber).toBeTruthy();
    expect(paid.grandTotalMinorUnits).toBe(2100);
    expect(paid.currencyCode).toBe('INR');
    expect(paid.paidAt).toBeTruthy();
    expect(paid.tableCode).toBe(tableCode);
    expect(paid.payments).toHaveLength(1);
    expect(paid.payments[0]).toMatchObject({
      id: paidPaymentId,
      method: 'CASH',
      status: 'CAPTURED',
      amountMinorUnits: 2100,
      refundedMinorUnits: 0,
    });
  });

  it('reflects refunded totals per payment', async () => {
    const r = await aPost(ownerAToken, `/admin/checkout/payments/${paidPaymentId}/refunds`, {
      reason: 'partial',
      amountMinorUnits: 500,
    });
    expect(r.status).toBe(201);
    const res = await aGet(ownerAToken, '/admin/checkout/invoices?status=PAID');
    expect(res.body.items[0].payments[0].refundedMinorUnits).toBe(500);
  });

  it('filters by status', async () => {
    const res = await aGet(ownerAToken, '/admin/checkout/invoices?status=VOIDED');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].id).toBe(voidedInvoiceId);
    const bad = await aGet(ownerAToken, '/admin/checkout/invoices?status=NOPE');
    expect(bad.status).toBe(400);
  });

  it('paginates with skip/take and reports the full total', async () => {
    const p1 = await aGet(ownerAToken, '/admin/checkout/invoices?take=2&skip=0');
    expect(p1.body.items).toHaveLength(2);
    expect(p1.body.total).toBe(3);
    const p2 = await aGet(ownerAToken, '/admin/checkout/invoices?take=2&skip=2');
    expect(p2.body.items).toHaveLength(1);
    expect(p2.body.items[0].id).toBe(paidInvoiceId);
  });

  it('enforces pagination bounds', async () => {
    expect((await aGet(ownerAToken, '/admin/checkout/invoices?take=101')).status).toBe(400);
    expect((await aGet(ownerAToken, '/admin/checkout/invoices?take=0')).status).toBe(400);
    expect((await aGet(ownerAToken, '/admin/checkout/invoices?skip=-1')).status).toBe(400);
    expect((await aGet(ownerAToken, '/admin/checkout/invoices?take=100')).status).toBe(200);
  });

  it('date filter: date-only "to" is inclusive of the whole day', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const inRange = await aGet(ownerAToken, `/admin/checkout/invoices?from=${today}&to=${today}`);
    expect(inRange.body.total).toBe(3);
    const past = await aGet(ownerAToken, '/admin/checkout/invoices?from=2000-01-01&to=2000-01-02');
    expect(past.body.total).toBe(0);
    expect((await aGet(ownerAToken, '/admin/checkout/invoices?from=garbage')).status).toBe(400);
  });

  it('is tenant isolated: another business sees nothing', async () => {
    const res = await aGet(ownerBToken, '/admin/checkout/invoices');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], total: 0 });
  });

  it('rejects a locationId from another business', async () => {
    const res = await aGet(ownerBToken, `/admin/checkout/invoices?locationId=${locAId}`);
    expect(res.status).toBe(404);
  });

  it('denies a role without checkout access (403)', async () => {
    const res = await aGet(noCheckoutToken, '/admin/checkout/invoices');
    expect(res.status).toBe(403);
  });

  it('requires authentication (401)', async () => {
    const res = await request(http()).get('/admin/checkout/invoices');
    expect(res.status).toBe(401);
  });

  it('concurrent refunds cannot exceed the captured amount', async () => {
    const { invoiceId } = await makeFinalisedInvoice(1); // 1050
    const pay = await aPost(ownerAToken, `/admin/checkout/invoices/${invoiceId}/payments`, {
      idempotencyKey: freshKey(),
      method: 'CASH',
      amountMinorUnits: 1050,
      cashReceivedMinorUnits: 1050,
    });
    const pid = pay.body.id as string;
    const results = await Promise.all(
      [0, 1, 2, 3].map(() =>
        aPost(ownerAToken, `/admin/checkout/payments/${pid}/refunds`, { reason: 'race', amountMinorUnits: 1050 }),
      ),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 400)).toHaveLength(3);
    const list = await aGet(ownerAToken, '/admin/checkout/invoices?status=PAID&take=100');
    const row = list.body.items.find((i: { id: string }) => i.id === invoiceId);
    expect(row.payments[0].refundedMinorUnits).toBe(1050);
  });
});
