import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';

jest.setTimeout(240_000);

/**
 * Update Round 2 (S3): kitchen order timeline, waiter "Show bill" / "Show payment QR" read
 * models, the checkout UPI settings, and payment idempotency / switching safety.
 */
describe('Order timeline, waiter bill + payment QR, payment switching (e2e)', () => {
  let app: INestApplication;
  let platformToken: string;
  let bizId: string;
  let ownerToken: string;
  let locId: string;
  let itemId: string;
  let areaId: string;
  let otherOwnerToken: string;

  // role tokens
  let waiterToken: string;
  let kitchenToken: string;
  let hostToken: string;
  let cashierToken: string;

  const RUN = Date.now().toString(36);
  const PW = 'Test!Password1';
  const http = () => app.getHttpServer();
  const get = (tok: string, path: string) => request(http()).get(path).set('authorization', `Bearer ${tok}`);
  const post = (tok: string, path: string, body: object = {}) => request(http()).post(path).set('authorization', `Bearer ${tok}`).send(body);
  const put = (tok: string, path: string, body: object = {}) => request(http()).put(path).set('authorization', `Bearer ${tok}`).send(body);
  const pPost = (path: string, body: object = {}) => request(http()).post(path).set('authorization', `Bearer ${platformToken}`).send(body);

  const key = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });

  const login = async (email: string): Promise<string> => {
    const res = await request(http()).post('/auth/login').send({ email, password: PW });
    expect(res.status).toBe(200);
    return res.body.accessToken as string;
  };
  const mkUser = async (name: string, roleKey: string): Promise<string> => {
    const email = `${name}-s3-${RUN}@test.local`;
    const res = await post(ownerToken, '/admin/users', { email, password: PW, displayName: `${name} Person`, roleKeys: [roleKey] });
    expect(res.status).toBe(201);
    return login(email);
  };
  const activate = async (id: string, moduleKey: string) => {
    const a = await pPost(`/internal/businesses/${id}/modules/${moduleKey}/activate`);
    expect([201, 409]).toContain(a.status);
    const s = await pPost(`/internal/businesses/${id}/modules/${moduleKey}/complete-setup`);
    expect([200, 201]).toContain(s.status);
  };
  const owner = async (id: string, tag: string): Promise<string> => {
    const email = `owner-s3-${tag}-${RUN}@test.local`;
    expect((await pPost(`/internal/businesses/${id}/provision`, { email, displayName: `Owner ${tag}`, password: PW })).status).toBe(201);
    return login(email);
  };

  /** Opens a table, sends one order of `qty` burgers (1000 paise + 5% GST each), returns ids. */
  const seat = async (code: string, qty = 2) => {
    const table = await post(ownerToken, '/admin/dining/tables', { diningAreaId: areaId, locationId: locId, code: `${code}-${RUN}`, capacity: 2 });
    expect(table.status).toBe(201);
    const sess = await post(ownerToken, '/admin/sessions', { locationId: locId, diningTableId: table.body.id, partySize: 2 });
    expect(sess.status).toBe(201);
    const order = await post(ownerToken, '/admin/orders', { sessionId: sess.body.id, idempotencyKey: key(), lines: [{ catalogItemId: itemId, quantity: qty }] });
    expect(order.status).toBe(201);
    expect((await post(ownerToken, `/admin/orders/${order.body.id}/send`, {})).status).toBe(201);
    return { sessionId: sess.body.id as string, orderId: order.body.id as string, tableCode: `${code}-${RUN}` };
  };
  const finalised = async (code: string, qty = 2) => {
    const s = await seat(code, qty);
    const inv = await post(ownerToken, `/admin/checkout/sessions/${s.sessionId}/invoice`, {});
    expect(inv.status).toBe(201);
    expect((await post(ownerToken, `/admin/checkout/invoices/${inv.body.id}/finalise`, {})).status).toBe(201);
    return { ...s, invoiceId: inv.body.id as string, total: inv.body.grandTotalMinorUnits as number };
  };
  const payUrl = (invoiceId: string) => `/admin/checkout/invoices/${invoiceId}/payments`;

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

    const biz = await pPost('/internal/businesses', { name: `S3 Cafe ${RUN}`, businessTypeKey: 'restaurant' });
    expect(biz.status).toBe(201);
    bizId = biz.body.id as string;
    ownerToken = await owner(bizId, 'A');
    locId = (await pPost(`/internal/businesses/${bizId}/locations`, { name: `Riverside ${RUN}`, timezone: 'Asia/Kolkata' })).body.id as string;
    for (const m of ['restaurant', 'catalog', 'checkout']) await activate(bizId, m);

    const other = await pPost('/internal/businesses', { name: `S3 Other ${RUN}`, businessTypeKey: 'restaurant' });
    otherOwnerToken = await owner(other.body.id as string, 'B');
    await pPost(`/internal/businesses/${other.body.id}/locations`, { name: `Other ${RUN}`, timezone: 'Asia/Kolkata' });
    for (const m of ['restaurant', 'catalog', 'checkout']) await activate(other.body.id as string, m);

    const tax = await post(ownerToken, '/admin/catalog/tax-categories', { name: 'GST 5%', rate: 0.05, isDefault: true });
    expect(tax.status).toBe(201);
    const cat = await post(ownerToken, '/admin/catalog/categories', { name: `S3 Cat ${RUN}`, sortOrder: 0 });
    itemId = (
      await post(ownerToken, '/admin/catalog/items', { categoryId: cat.body.id, name: 'Burger', basePriceMinorUnits: 1000, taxCategoryId: tax.body.id, isAvailable: true })
    ).body.id as string;
    areaId = (await post(ownerToken, '/admin/dining/areas', { locationId: locId, name: `Hall S3 ${RUN}`, sortOrder: 0 })).body.id as string;

    waiterToken = await mkUser('waiter', 'service-team');
    kitchenToken = await mkUser('kitchen', 'kitchen-team');
    hostToken = await mkUser('host', 'host');
    cashierToken = await mkUser('cashier', 'checkout-associate');
  });

  afterAll(async () => {
    await app.close();
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /admin/kitchen/:id/timeline', () => {
    let orderId: string;
    beforeAll(async () => {
      orderId = (await seat('TL')).orderId;
    });

    it('lists every step in order with actor, gaps and a running total', async () => {
      expect((await post(kitchenToken, `/admin/kitchen/${orderId}/accept`, {})).status).toBe(201);
      expect((await post(kitchenToken, `/admin/kitchen/${orderId}/prepare`, {})).status).toBe(201);
      expect((await post(kitchenToken, `/admin/kitchen/${orderId}/ready`, {})).status).toBe(201);

      const res = await get(kitchenToken, `/admin/kitchen/${orderId}/timeline`);
      expect(res.status).toBe(200);
      expect(res.body.steps.map((s: { kind: string }) => s.kind)).toEqual(['created', 'sent', 'accepted', 'preparing', 'ready']);
      expect(res.body.finished).toBe(false);
      expect(res.body.order.id).toBe(orderId);
      expect(res.body.order.status).toBe('READY');
      expect(res.body.steps[0].sincePreviousMs).toBe(0);
      expect(res.body.steps[0].actor).toEqual({ type: 'staff', label: expect.stringContaining('Owner') });
      expect(res.body.steps[2].actor.label).toContain('kitchen');
      for (let i = 1; i < res.body.steps.length; i++) {
        const prev = new Date(res.body.steps[i - 1].at).getTime();
        const cur = new Date(res.body.steps[i].at).getTime();
        expect(res.body.steps[i].sincePreviousMs).toBe(Math.max(0, cur - prev));
        expect(res.body.steps[i].source).toBe('activity');
      }
      expect(res.body.totalMs).toBeGreaterThanOrEqual(res.body.steps[res.body.steps.length - 1].sinceStartMs);
      expect(typeof res.body.serverTime).toBe('string');
    });

    it('stops the clock when served and records the serving waiter', async () => {
      expect((await post(waiterToken, `/admin/orders/${orderId}/serve`, {})).status).toBe(201);
      const res = await get(waiterToken, `/admin/kitchen/${orderId}/timeline`);
      expect(res.status).toBe(200);
      expect(res.body.steps[res.body.steps.length - 1].kind).toBe('served');
      expect(res.body.steps[res.body.steps.length - 1].actor.label).toContain('waiter');
      expect(res.body.finished).toBe(true);
      expect(res.body.endedAt).toBe(res.body.steps[res.body.steps.length - 1].at);
    });

    it('is view-gated: cashier has no kitchen access, other tenants see 404, unknown ids 404', async () => {
      expect((await get(cashierToken, `/admin/kitchen/${orderId}/timeline`)).status).toBe(403);
      expect((await get(otherOwnerToken, `/admin/kitchen/${orderId}/timeline`)).status).toBe(404);
      expect((await get(ownerToken, `/admin/kitchen/${key()}/timeline`)).status).toBe(404);
      expect((await get(ownerToken, '/admin/kitchen/not-a-uuid/timeline')).status).toBe(400);
      expect((await request(http()).get(`/admin/kitchen/${orderId}/timeline`)).status).toBe(401);
    });

    it('shows a cancellation with its reason', async () => {
      const s = await seat('TLC');
      expect((await post(ownerToken, `/admin/orders/${s.orderId}/cancel`, { reason: 'Guest left' })).status).toBe(201);
      const res = await get(ownerToken, `/admin/kitchen/${s.orderId}/timeline`);
      const last = res.body.steps[res.body.steps.length - 1];
      expect(last.kind).toBe('cancelled');
      expect(last.detail.reason).toBe('Guest left');
      expect(res.body.finished).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('waiter bill view', () => {
    it('before a bill exists: NO_BILL; draft: NOT_FINALISED (a guest never sees a draft)', async () => {
      const s = await seat('BV1');
      const none = await get(waiterToken, `/admin/checkout/sessions/${s.sessionId}/bill-view`);
      expect(none.status).toBe(200);
      expect(none.body.state).toBe('NO_BILL');
      expect(none.body.bill).toBeNull();
      expect(none.body.tableCode).toBe(s.tableCode);

      const inv = await post(ownerToken, `/admin/checkout/sessions/${s.sessionId}/invoice`, {});
      const draft = await get(waiterToken, `/admin/checkout/sessions/${s.sessionId}/bill-view`);
      expect(draft.body.state).toBe('NOT_FINALISED');
      expect(draft.body.bill).toBeNull();
      expect((await get(waiterToken, `/admin/checkout/invoices/${inv.body.id}/bill-view`)).body.state).toBe('NOT_FINALISED');
    });

    it('finalised: clean itemised view with GST split, reference and exact totals', async () => {
      const f = await finalised('BV2', 3); // 3 x 1000 = 3000 + 150 GST
      const res = await get(waiterToken, `/admin/checkout/sessions/${f.sessionId}/bill-view`);
      expect(res.status).toBe(200);
      expect(res.body.state).toBe('READY');
      expect(res.body.business.name).toContain('S3 Cafe');
      expect(res.body.tableCode).toBe(f.tableCode);
      const bill = res.body.bill;
      expect(bill.invoiceId).toBe(f.invoiceId);
      expect(bill.status).toBe('FINALISED');
      expect(bill.reference).toMatch(/^[A-Z0-9]{2,}-\d{4}$|^\d{4}$|^[A-Za-z0-9-]+$/);
      expect(bill.lines).toEqual([
        expect.objectContaining({ name: 'Burger', quantity: 3, unitPriceMinorUnits: 1000, amountMinorUnits: 3000 }),
      ]);
      expect(bill.subtotalMinorUnits).toBe(3000);
      expect(bill.totalTaxMinorUnits).toBe(150);
      expect(bill.grandTotalMinorUnits).toBe(3150);
      expect(bill.taxLines).toHaveLength(1);
      expect(bill.taxLines[0]).toMatchObject({ label: 'GST 5%', ratePercent: 5, taxableMinorUnits: 3000, taxMinorUnits: 150 });
      expect(bill.taxLines[0].components.map((c: { label: string; taxMinorUnits: number }) => [c.label, c.taxMinorUnits])).toEqual([
        ['CGST', 75],
        ['SGST', 75],
      ]);
      expect(bill.paid).toBe(false);
      expect(bill.paymentPending).toBe(false);
      // identical result by invoice id
      const byInvoice = await get(waiterToken, `/admin/checkout/invoices/${f.invoiceId}/bill-view`);
      expect(byInvoice.body.bill).toEqual(bill);
    });

    it('reflects a pending UPI request and then the paid state', async () => {
      const f = await finalised('BV3', 1);
      const p = await post(cashierToken, payUrl(f.invoiceId), { idempotencyKey: key(), method: 'UPI', amountMinorUnits: f.total });
      expect(p.status).toBe(201);
      expect((await get(waiterToken, `/admin/checkout/invoices/${f.invoiceId}/bill-view`)).body.bill.paymentPending).toBe(true);
      expect((await post(cashierToken, `/admin/checkout/payments/${p.body.id}/capture`, { referenceCode: 'UTR1234567890' })).status).toBe(201);
      const done = (await get(waiterToken, `/admin/checkout/invoices/${f.invoiceId}/bill-view`)).body.bill;
      expect(done.paid).toBe(true);
      expect(done.paymentPending).toBe(false);
      expect(done.status).toBe('PAID');
    });

    it('is permission-gated and tenant-isolated, and does not widen invoice access', async () => {
      const f = await finalised('BV4', 1);
      const url = `/admin/checkout/invoices/${f.invoiceId}/bill-view`;
      expect((await get(cashierToken, url)).status).toBe(200);
      expect((await get(ownerToken, url)).status).toBe(200);
      expect((await get(hostToken, url)).status).toBe(403);
      expect((await get(kitchenToken, url)).status).toBe(403);
      expect((await get(otherOwnerToken, url)).status).toBe(404);
      expect((await get(otherOwnerToken, `/admin/checkout/sessions/${f.sessionId}/bill-view`)).status).toBe(404);
      expect((await request(http()).get(url)).status).toBe(401);
      // The waiter can show a bill but still cannot browse invoices or take payments.
      expect((await get(waiterToken, `/admin/checkout/invoices/${f.invoiceId}`)).status).toBe(403);
      expect((await post(waiterToken, payUrl(f.invoiceId), { idempotencyKey: key(), method: 'UPI', amountMinorUnits: f.total })).status).toBe(403);
      expect((await post(waiterToken, `/admin/checkout/sessions/${f.sessionId}/invoice`, {})).status).toBe(403);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('checkout UPI settings + payment QR', () => {
    let f: { sessionId: string; invoiceId: string; total: number; tableCode: string };
    beforeAll(async () => {
      f = await finalised('QR1', 2); // 2100
    });
    const qr = (tok: string, id = f.invoiceId) => get(tok, `/admin/checkout/invoices/${id}/payment-qr`);

    it('the settings exist, default to empty, and validate the VPA format', async () => {
      const schema = await get(ownerToken, '/admin/settings/schema?namespace=checkout');
      expect(schema.body.map((d: { key: string }) => d.key).sort()).toEqual(['upi_payee_name', 'upi_vpa']);
      const eff = await get(ownerToken, '/admin/settings/effective?namespace=checkout');
      expect(eff.body.find((v: { key: string }) => v.key === 'upi_vpa').value).toBe('');

      for (const bad of ['notavpa', 'a@b', 'name@bank.com', 'sp ace@ybl', '@ybl']) {
        const r = await put(ownerToken, '/admin/settings/checkout/upi_vpa', { value: bad });
        expect({ bad, status: r.status }).toEqual({ bad, status: 400 });
      }
    });

    it('not configured: tells the UI so instead of returning a broken code', async () => {
      const res = await qr(waiterToken);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ ready: false, reason: 'UPI_NOT_CONFIGURED', upi: null, amountMinorUnits: f.total, paid: false });
    });

    it('configured: exact UPI URI for the exact payable amount', async () => {
      expect((await put(ownerToken, '/admin/settings/checkout/upi_vpa', { value: ' riverside@okhdfcbank ' })).status).toBe(200);
      expect((await put(ownerToken, '/admin/settings/checkout/upi_payee_name', { value: 'Riverside Kitchen' })).status).toBe(200);
      const res = await qr(waiterToken);
      expect(res.status).toBe(200);
      expect(res.body.ready).toBe(true);
      expect(res.body.reason).toBeNull();
      expect(res.body.amountMinorUnits).toBe(2100);
      const u = new URL(res.body.upi.uri);
      expect(u.protocol).toBe('upi:');
      expect(u.searchParams.get('pa')).toBe('riverside@okhdfcbank');
      expect(u.searchParams.get('pn')).toBe('Riverside Kitchen');
      expect(u.searchParams.get('am')).toBe('21.00');
      expect(u.searchParams.get('cu')).toBe('INR');
      expect(u.searchParams.get('tn')).toContain('Table');
      expect(u.searchParams.get('tr')).toMatch(/^[A-Za-z0-9]{1,35}$/);
      expect(res.body.upi.vpa).toBe('riverside@okhdfcbank');
    });

    it('falls back to the restaurant name when no payee name is set', async () => {
      expect((await put(ownerToken, '/admin/settings/checkout/upi_payee_name', { value: '' })).status).toBe(200);
      const res = await qr(cashierToken);
      expect(new URL(res.body.upi.uri).searchParams.get('pn')).toContain('S3 Cafe');
    });

    it('is gated by paymentqr.show and tenant', async () => {
      expect((await qr(hostToken)).status).toBe(403);
      expect((await qr(kitchenToken)).status).toBe(403);
      expect((await qr(otherOwnerToken)).status).toBe(404);
      expect((await request(http()).get(`/admin/checkout/invoices/${f.invoiceId}/payment-qr`)).status).toBe(401);
    });

    it('draft invoices, paid invoices and voided invoices never get a QR', async () => {
      const s = await seat('QR2', 1);
      const draft = await post(ownerToken, `/admin/checkout/sessions/${s.sessionId}/invoice`, {});
      expect((await qr(waiterToken, draft.body.id)).body).toMatchObject({ ready: false, reason: 'NOT_FINALISED', upi: null });

      const paid = await finalised('QR3', 1);
      expect((await post(cashierToken, payUrl(paid.invoiceId), { idempotencyKey: key(), method: 'CASH', amountMinorUnits: paid.total, cashReceivedMinorUnits: paid.total })).status).toBe(201);
      expect((await qr(waiterToken, paid.invoiceId)).body).toMatchObject({ ready: false, reason: 'PAID', paid: true, upi: null });

      const voided = await finalised('QR4', 1);
      expect((await post(ownerToken, `/admin/checkout/invoices/${voided.invoiceId}/void`, { reason: 'test' })).status).toBe(201);
      expect((await qr(waiterToken, voided.invoiceId)).body).toMatchObject({ ready: false, reason: 'VOID', upi: null });
    });

    it('a location override of the VPA wins for that location', async () => {
      const r = await put(ownerToken, `/admin/settings/checkout/upi_vpa?locationId=${locId}`, { value: 'branch@ybl' });
      expect(r.status).toBe(200);
      expect((await qr(waiterToken)).body.upi.vpa).toBe('branch@ybl');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('payment idempotency and switching method', () => {
    it('a key cannot stand in for a different payment (method, amount, cash tendered, invoice)', async () => {
      const a = await finalised('ID1', 1);
      const b = await finalised('ID2', 1);
      const k = key();
      const first = await post(cashierToken, payUrl(a.invoiceId), { idempotencyKey: k, method: 'CASH', amountMinorUnits: a.total, cashReceivedMinorUnits: 2000 });
      expect(first.status).toBe(201);
      const replay = await post(cashierToken, payUrl(a.invoiceId), { idempotencyKey: k, method: 'CASH', amountMinorUnits: a.total, cashReceivedMinorUnits: 2000 });
      expect(replay.status).toBe(201);
      expect(replay.body.id).toBe(first.body.id);

      const otherCash = await post(cashierToken, payUrl(a.invoiceId), { idempotencyKey: k, method: 'CASH', amountMinorUnits: a.total, cashReceivedMinorUnits: 5000 });
      expect(otherCash.status).toBe(409);
      const otherMethod = await post(cashierToken, payUrl(a.invoiceId), { idempotencyKey: k, method: 'UPI', amountMinorUnits: a.total });
      expect(otherMethod.status).toBe(409);
      const otherInvoice = await post(cashierToken, payUrl(b.invoiceId), { idempotencyKey: k, method: 'CASH', amountMinorUnits: b.total, cashReceivedMinorUnits: 2000 });
      expect(otherInvoice.status).toBe(409);
      // Nothing was recorded against the other invoice.
      expect((await get(ownerToken, `/admin/checkout/invoices/${b.invoiceId}/payments`)).body).toHaveLength(0);
    });

    it('two simultaneous different-key payments on one bill: exactly one wins, one payment exists', async () => {
      const f = await finalised('ID3', 1);
      const attempts = await Promise.all(
        [0, 1, 2, 3].map(() => post(cashierToken, payUrl(f.invoiceId), { idempotencyKey: key(), method: 'CASH', amountMinorUnits: f.total, cashReceivedMinorUnits: f.total })),
      );
      expect(attempts.filter((r) => r.status === 201)).toHaveLength(1);
      expect(attempts.filter((r) => r.status === 409)).toHaveLength(3);
      const list = await get(ownerToken, `/admin/checkout/invoices/${f.invoiceId}/payments`);
      expect(list.body.filter((p: { status: string }) => p.status === 'CAPTURED')).toHaveLength(1);
      expect(list.body).toHaveLength(1);
    });

    it('the same key fired in parallel yields one payment and the same answer', async () => {
      const f = await finalised('ID4', 1);
      const k = key();
      const results = await Promise.all(
        [0, 1, 2].map(() => post(cashierToken, payUrl(f.invoiceId), { idempotencyKey: k, method: 'CASH', amountMinorUnits: f.total, cashReceivedMinorUnits: f.total })),
      );
      expect(results.map((r) => r.status)).toEqual([201, 201, 201]);
      expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
      expect((await get(ownerToken, `/admin/checkout/invoices/${f.invoiceId}/payments`)).body).toHaveLength(1);
    });

    it('UPI -> cash: the pending UPI request is cancelled, then cash is recorded once', async () => {
      const f = await finalised('SW1', 1);
      const upi = await post(cashierToken, payUrl(f.invoiceId), { idempotencyKey: key(), method: 'UPI', amountMinorUnits: f.total });
      expect(upi.status).toBe(201);
      expect(upi.body.status).toBe('PENDING');

      // cash is refused while the UPI request is still open (one active payment per bill)
      const blocked = await post(cashierToken, payUrl(f.invoiceId), { idempotencyKey: key(), method: 'CASH', amountMinorUnits: f.total, cashReceivedMinorUnits: f.total });
      expect(blocked.status).toBe(409);

      const cancelled = await post(cashierToken, `/admin/checkout/payments/${upi.body.id}/cancel`, { reason: 'Switched to cash' });
      expect(cancelled.status).toBe(201);
      expect(cancelled.body.status).toBe('CANCELLED');

      const cashKey = key();
      const cash = await post(cashierToken, payUrl(f.invoiceId), { idempotencyKey: cashKey, method: 'CASH', amountMinorUnits: f.total, cashReceivedMinorUnits: 2000 });
      expect(cash.status).toBe(201);
      expect(cash.body.status).toBe('CAPTURED');
      expect(cash.body.changeMinorUnits).toBe(2000 - f.total);
      // a retried confirm replays, no second payment
      const again = await post(cashierToken, payUrl(f.invoiceId), { idempotencyKey: cashKey, method: 'CASH', amountMinorUnits: f.total, cashReceivedMinorUnits: 2000 });
      expect(again.body.id).toBe(cash.body.id);

      const all = await get(ownerToken, `/admin/checkout/invoices/${f.invoiceId}/payments`);
      expect(all.body.map((p: { status: string }) => p.status).sort()).toEqual(['CANCELLED', 'CAPTURED']);
      expect((await get(ownerToken, `/admin/checkout/invoices/${f.invoiceId}`)).body.status).toBe('PAID');
    });

    it('cash -> UPI is impossible once cash is recorded (bill is PAID): 409, no second payment', async () => {
      const f = await finalised('SW2', 1);
      expect((await post(cashierToken, payUrl(f.invoiceId), { idempotencyKey: key(), method: 'CASH', amountMinorUnits: f.total, cashReceivedMinorUnits: f.total })).status).toBe(201);
      const upi = await post(cashierToken, payUrl(f.invoiceId), { idempotencyKey: key(), method: 'UPI', amountMinorUnits: f.total });
      expect(upi.status).toBe(409);
      expect((await get(ownerToken, `/admin/checkout/invoices/${f.invoiceId}/payments`)).body).toHaveLength(1);
    });

    it('confirming a UPI payment twice (retry / double tap) captures once; a different UTR is refused', async () => {
      const f = await finalised('SW3', 1);
      const upi = await post(cashierToken, payUrl(f.invoiceId), { idempotencyKey: key(), method: 'UPI', amountMinorUnits: f.total });
      const cap = () => post(cashierToken, `/admin/checkout/payments/${upi.body.id}/capture`, { referenceCode: 'UTR555000111' });
      const results = await Promise.all([cap(), cap(), cap()]);
      expect(results.every((r) => r.status === 201)).toBe(true);
      expect(results.every((r) => r.body.status === 'CAPTURED' && r.body.referenceCode === 'UTR555000111')).toBe(true);
      const different = await post(cashierToken, `/admin/checkout/payments/${upi.body.id}/capture`, { referenceCode: 'UTR_OTHER_999' });
      expect(different.status).toBe(400);
      const all = await get(ownerToken, `/admin/checkout/invoices/${f.invoiceId}/payments`);
      expect(all.body).toHaveLength(1);
      expect(all.body[0].referenceCode).toBe('UTR555000111');
    });

    it('capture racing a cancel never leaves a captured+cancelled mix', async () => {
      const f = await finalised('SW4', 1);
      const upi = await post(cashierToken, payUrl(f.invoiceId), { idempotencyKey: key(), method: 'UPI', amountMinorUnits: f.total });
      const [cap, can] = await Promise.all([
        post(cashierToken, `/admin/checkout/payments/${upi.body.id}/capture`, { referenceCode: 'UTR777000222' }),
        post(cashierToken, `/admin/checkout/payments/${upi.body.id}/cancel`, { reason: 'race' }),
      ]);
      const outcomes = [cap.status, can.status].sort();
      // exactly one succeeds (201); the loser is a 4xx
      expect(outcomes[0]).toBe(201);
      expect(outcomes[1]).toBeGreaterThanOrEqual(400);
      const final = (await get(ownerToken, `/admin/checkout/payments/${upi.body.id}`)).body;
      const inv = (await get(ownerToken, `/admin/checkout/invoices/${f.invoiceId}`)).body;
      expect(['CAPTURED', 'CANCELLED']).toContain(final.status);
      expect(inv.status).toBe(final.status === 'CAPTURED' ? 'PAID' : 'FINALISED');
    });
  });
});
