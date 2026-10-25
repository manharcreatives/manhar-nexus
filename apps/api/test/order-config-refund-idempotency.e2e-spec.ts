import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';

jest.setTimeout(120_000);

/**
 * Order-line configuration validation + refund idempotency (e2e).
 *
 * Order lines (POST /admin/orders and POST /admin/orders/:id/lines):
 *   - variantId must belong to the ordered item and be available
 *   - choosing no variant is allowed (variants are deltas over the base price)
 *   - options must come from an ACTIVE group linked to the item, be available,
 *     and appear at most once
 *   - each linked group's min/max/required bounds must hold
 *   - rejections are 400 VALIDATION with a stable message prefix and
 *     details.reason; nothing is persisted; server pricing is kept
 *
 * Refunds (POST /admin/checkout/payments/:id/refunds):
 *   - optional idempotencyKey; replay returns the original refund (no double refund)
 *   - same key with a different amount or payment → 409 CONFLICT
 *   - concurrent retries with one key create exactly one refund
 *   - refund.created audit event written once
 */
describe('Order line configuration + refund idempotency (e2e)', () => {
  let app: INestApplication;
  let platformToken: string;
  let ownerToken: string;
  let locId: string;
  let sessionId: string;

  // Catalog fixtures
  let pizzaId: string;
  let pastaId: string;
  let platterId: string;
  let teaId: string;
  let smallId: string;
  let largeId: string;
  let familyId: string; // unavailable variant
  let pastaVariantId: string;
  let thinId: string;
  let thickId: string;
  let oliveId: string;
  let cornId: string;
  let jalapenoId: string;
  let soldOutToppingId: string;
  let unlinkedOptionId: string;
  let inactiveGroupOptionId: string;
  const dipIds: string[] = [];

  const RUN = Date.now().toString(36);
  const http = () => app.getHttpServer();

  const pPost = (path: string, body: object = {}) =>
    request(http()).post(path).set('authorization', `Bearer ${platformToken}`).send(body);
  const aGet = (path: string) => request(http()).get(path).set('authorization', `Bearer ${ownerToken}`);
  const aPost = (path: string, body: object = {}) =>
    request(http()).post(path).set('authorization', `Bearer ${ownerToken}`).send(body);

  const freshKey = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });

  const activateModule = async (bizId: string, moduleKey: string): Promise<void> => {
    const a = await pPost(`/internal/businesses/${bizId}/modules/${moduleKey}/activate`);
    if (a.status !== 201 && a.status !== 409) throw new Error(`activate ${moduleKey}: ${a.status}`);
    const s = await pPost(`/internal/businesses/${bizId}/modules/${moduleKey}/complete-setup`);
    if (s.status !== 200 && s.status !== 201) throw new Error(`complete-setup ${moduleKey}: ${s.status}`);
  };

  const created = async (path: string, body: object): Promise<string> => {
    const res = await aPost(path, body);
    if (res.status !== 201) throw new Error(`${path} → ${res.status} ${JSON.stringify(res.body)}`);
    return res.body.id as string;
  };

  const mkGroup = (name: string, extra: object) =>
    created('/admin/catalog/modifier-groups', { name: `${name} ${RUN}`, ...extra });
  const mkOption = (groupId: string, name: string, priceAdjMinorUnits = 0, extra: object = {}) =>
    created(`/admin/catalog/modifier-groups/${groupId}/options`, { name, priceAdjMinorUnits, ...extra });
  const link = async (itemId: string, groupId: string, sortOrder = 0) => {
    const res = await aPost(`/admin/catalog/items/${itemId}/modifier-groups`, { modifierGroupId: groupId, sortOrder });
    expect(res.status).toBe(201);
  };

  type Line = { catalogItemId: string; variantId?: string; quantity: number; modifiers?: { modifierOptionId: string }[] };
  const mods = (...ids: string[]) => ids.map((modifierOptionId) => ({ modifierOptionId }));
  const order = (lines: Line[]) => aPost('/admin/orders', { sessionId, idempotencyKey: freshKey(), lines });

  const expectConfigRejection = (res: request.Response, reason: string) => {
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
    expect(res.body.error.message).toMatch(/^Invalid item configuration: /);
    expect(res.body.error.details.reason).toBe(reason);
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

    const biz = await pPost('/internal/businesses', { name: `OCR Biz ${RUN}`, businessTypeKey: 'restaurant' });
    expect(biz.status).toBe(201);
    const bizId = biz.body.id as string;
    const email = `owner-ocr-${RUN}@test.local`;
    const pw = 'Test!Password1';
    expect((await pPost(`/internal/businesses/${bizId}/provision`, { email, displayName: 'Owner OCR', password: pw })).status).toBe(201);
    const ownerLogin = await request(http()).post('/auth/login').send({ email, password: pw });
    expect(ownerLogin.status).toBe(200);
    ownerToken = ownerLogin.body.accessToken as string;
    const loc = await pPost(`/internal/businesses/${bizId}/locations`, { name: `OCR Loc ${RUN}`, timezone: 'Asia/Kolkata' });
    expect(loc.status).toBe(201);
    locId = loc.body.id as string;
    await activateModule(bizId, 'restaurant');
    await activateModule(bizId, 'catalog');
    await activateModule(bizId, 'checkout');

    // ── Catalog ────────────────────────────────────────────────────────────────
    const taxId = await created('/admin/catalog/tax-categories', { name: `GST ${RUN}`, rate: 0.05, isDefault: true });
    const catId = await created('/admin/catalog/categories', { name: `OCR Cat ${RUN}` });
    const item = (name: string, basePriceMinorUnits: number) =>
      created('/admin/catalog/items', { categoryId: catId, taxCategoryId: taxId, name: `${name} ${RUN}`, basePriceMinorUnits });

    pizzaId = await item('Pizza', 10000);
    pastaId = await item('Pasta', 8000);
    platterId = await item('Platter', 5000);
    teaId = await item('Tea', 1000);

    smallId = await created(`/admin/catalog/items/${pizzaId}/variants`, { name: 'Small', priceAdjMinorUnits: 0 });
    largeId = await created(`/admin/catalog/items/${pizzaId}/variants`, { name: 'Large', priceAdjMinorUnits: 3000 });
    familyId = await created(`/admin/catalog/items/${pizzaId}/variants`, {
      name: 'Family', priceAdjMinorUnits: 6000, isAvailable: false,
    });
    pastaVariantId = await created(`/admin/catalog/items/${pastaId}/variants`, { name: 'Penne', priceAdjMinorUnits: 0 });

    // Crust: required, single choice
    const crust = await mkGroup('Crust', { selectionType: 'SINGLE', isRequired: true, minSelections: 1, maxSelections: 1 });
    thinId = await mkOption(crust, 'Thin', 0);
    thickId = await mkOption(crust, 'Thick', 500);
    // Toppings: optional, up to 2
    const toppings = await mkGroup('Toppings', { selectionType: 'MULTIPLE', isRequired: false, minSelections: 0, maxSelections: 2 });
    oliveId = await mkOption(toppings, 'Olive', 200);
    cornId = await mkOption(toppings, 'Corn', 300);
    jalapenoId = await mkOption(toppings, 'Jalapeno', 400);
    soldOutToppingId = await mkOption(toppings, 'Truffle', 900, { isAvailable: false });
    // Linked but inactive group
    const seasonal = await mkGroup('Seasonal', { selectionType: 'MULTIPLE', isActive: false });
    inactiveGroupOptionId = await mkOption(seasonal, 'Pumpkin', 100);
    await link(pizzaId, crust, 0);
    await link(pizzaId, toppings, 1);
    await link(pizzaId, seasonal, 2);

    // Never linked to any item
    const sauces = await mkGroup('Sauces', { selectionType: 'MULTIPLE' });
    unlinkedOptionId = await mkOption(sauces, 'Mayo', 100);

    // Platter: non-required group with minSelections 2, max 3
    const dips = await mkGroup('Dips', { selectionType: 'MULTIPLE', isRequired: false, minSelections: 2, maxSelections: 3 });
    for (const n of ['Hummus', 'Salsa', 'Tzatziki', 'Guac']) dipIds.push(await mkOption(dips, n, 100));
    await link(platterId, dips);

    // ── Dining + session ───────────────────────────────────────────────────────
    const areaId = await created('/admin/dining/areas', { locationId: locId, name: `OCR Hall ${RUN}` });
    const tableId = await created('/admin/dining/tables', { diningAreaId: areaId, locationId: locId, code: `OCR1-${RUN}`, capacity: 4 });
    sessionId = await created('/admin/sessions', { locationId: locId, diningTableId: tableId, partySize: 2 });
  });

  afterAll(async () => {
    await app.close();
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('Order create: configuration rejections', () => {
    it('rejects a variant that belongs to a different item', async () => {
      const res = await order([{ catalogItemId: pizzaId, variantId: pastaVariantId, quantity: 1, modifiers: mods(thinId) }]);
      expectConfigRejection(res, 'VARIANT_NOT_FOR_ITEM');
      expect(res.body.error.details.variantId).toBe(pastaVariantId);
    });

    it('rejects an unknown variant id', async () => {
      const res = await order([{ catalogItemId: pizzaId, variantId: freshKey(), quantity: 1, modifiers: mods(thinId) }]);
      expectConfigRejection(res, 'VARIANT_NOT_FOR_ITEM');
    });

    it('rejects an unavailable variant', async () => {
      const res = await order([{ catalogItemId: pizzaId, variantId: familyId, quantity: 1, modifiers: mods(thinId) }]);
      expectConfigRejection(res, 'VARIANT_UNAVAILABLE');
    });

    it('rejects an option from a group not linked to the item', async () => {
      const res = await order([{ catalogItemId: pizzaId, variantId: smallId, quantity: 1, modifiers: mods(thinId, unlinkedOptionId) }]);
      expectConfigRejection(res, 'OPTION_NOT_FOR_ITEM');
      expect(res.body.error.details.modifierOptionId).toBe(unlinkedOptionId);
    });

    it('rejects an option of a linked item when ordered on another item', async () => {
      const res = await order([{ catalogItemId: pastaId, quantity: 1, modifiers: mods(oliveId) }]);
      expectConfigRejection(res, 'OPTION_NOT_FOR_ITEM');
    });

    it('rejects an option from a linked but inactive group', async () => {
      const res = await order([{ catalogItemId: pizzaId, quantity: 1, modifiers: mods(thinId, inactiveGroupOptionId) }]);
      expectConfigRejection(res, 'OPTION_NOT_FOR_ITEM');
    });

    it('rejects an unavailable option', async () => {
      const res = await order([{ catalogItemId: pizzaId, quantity: 1, modifiers: mods(thinId, soldOutToppingId) }]);
      expectConfigRejection(res, 'OPTION_UNAVAILABLE');
    });

    it('rejects duplicate options on one line', async () => {
      const res = await order([{ catalogItemId: pizzaId, quantity: 1, modifiers: mods(thinId, oliveId, oliveId) }]);
      expectConfigRejection(res, 'DUPLICATE_OPTION');
    });

    it('rejects a missing selection for a required group', async () => {
      const res = await order([{ catalogItemId: pizzaId, variantId: smallId, quantity: 1, modifiers: mods(oliveId) }]);
      expectConfigRejection(res, 'GROUP_MIN');
      expect(res.body.error.details).toMatchObject({ min: 1, picked: 0 });
    });

    it('rejects two picks in a SINGLE group', async () => {
      const res = await order([{ catalogItemId: pizzaId, quantity: 1, modifiers: mods(thinId, thickId) }]);
      expectConfigRejection(res, 'GROUP_MAX');
      expect(res.body.error.details).toMatchObject({ max: 1, picked: 2 });
    });

    it('rejects more picks than maxSelections in a MULTIPLE group', async () => {
      const res = await order([{ catalogItemId: pizzaId, quantity: 1, modifiers: mods(thinId, oliveId, cornId, jalapenoId) }]);
      expectConfigRejection(res, 'GROUP_MAX');
      expect(res.body.error.details).toMatchObject({ max: 2, picked: 3 });
    });

    it('rejects fewer picks than minSelections in a non-required group', async () => {
      const res = await order([{ catalogItemId: platterId, quantity: 1, modifiers: mods(dipIds[0]) }]);
      expectConfigRejection(res, 'GROUP_MIN');
      expect(res.body.error.details).toMatchObject({ min: 2, picked: 1 });
    });

    it('identifies the failing line by index and persists nothing', async () => {
      const before = (await aGet(`/admin/orders?sessionId=${sessionId}`)).body.length as number;
      const res = await order([
        { catalogItemId: teaId, quantity: 1 },
        { catalogItemId: pizzaId, quantity: 1, modifiers: mods(unlinkedOptionId) },
      ]);
      expectConfigRejection(res, 'OPTION_NOT_FOR_ITEM');
      expect(res.body.error.details.lineIndex).toBe(1);
      const after = (await aGet(`/admin/orders?sessionId=${sessionId}`)).body.length as number;
      expect(after).toBe(before);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('Order create: valid configured orders', () => {
    it('accepts a fully configured line and prices it on the server', async () => {
      const res = await order([
        { catalogItemId: pizzaId, variantId: largeId, quantity: 2, modifiers: mods(thickId, oliveId, cornId) },
        { catalogItemId: platterId, quantity: 1, modifiers: mods(dipIds[0], dipIds[1], dipIds[2]) },
      ]);
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('DRAFT');
      const [pizza, platter] = res.body.lines as {
        variantNameSnapshot: string | null;
        unitPriceMinorUnits: number;
        quantity: number;
        modifiers: { optionNameSnapshot: string; priceAdjMinorUnits: number }[];
      }[];
      expect(pizza.variantNameSnapshot).toBe('Large');
      expect(pizza.unitPriceMinorUnits).toBe(10000 + 3000 + 500 + 200 + 300);
      expect(pizza.quantity).toBe(2);
      expect(pizza.modifiers.map((m) => m.optionNameSnapshot).sort()).toEqual(['Corn', 'Olive', 'Thick']);
      expect(platter.unitPriceMinorUnits).toBe(5000 + 300);

      // Order creation is audited
      const audit = await aGet('/admin/audit?action=service_request.draft_created&take=50');
      expect(audit.status).toBe(200);
      expect((audit.body.events as { resourceId: string }[]).some((e) => e.resourceId === res.body.id)).toBe(true);
    });

    it('allows an item with variants to be ordered without a variant (base price)', async () => {
      const res = await order([{ catalogItemId: pizzaId, quantity: 1, modifiers: mods(thinId) }]);
      expect(res.status).toBe(201);
      expect(res.body.lines[0].variantNameSnapshot).toBeNull();
      expect(res.body.lines[0].unitPriceMinorUnits).toBe(10000);
    });

    it('allows optional groups to be left empty', async () => {
      const res = await order([{ catalogItemId: pizzaId, variantId: smallId, quantity: 1, modifiers: mods(thinId) }]);
      expect(res.status).toBe(201);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('Add lines: same validation', () => {
    let draftId: string;
    let version: number;

    beforeAll(async () => {
      const res = await order([{ catalogItemId: teaId, quantity: 1 }]);
      expect(res.status).toBe(201);
      draftId = res.body.id as string;
      version = res.body.version as number;
    });

    it('rejects an invalid line and leaves the draft untouched', async () => {
      const res = await aPost(`/admin/orders/${draftId}/lines`, {
        lines: [{ catalogItemId: pizzaId, variantId: pastaVariantId, quantity: 1, modifiers: mods(thinId) }],
      });
      expectConfigRejection(res, 'VARIANT_NOT_FOR_ITEM');
      const after = await aGet(`/admin/orders/${draftId}`);
      expect(after.body.lines).toHaveLength(1);
      expect(after.body.version).toBe(version);
    });

    it('rejects a required group left empty', async () => {
      const res = await aPost(`/admin/orders/${draftId}/lines`, {
        lines: [{ catalogItemId: pizzaId, quantity: 1, modifiers: [] }],
      });
      expectConfigRejection(res, 'GROUP_MIN');
    });

    it('accepts a valid configured line', async () => {
      const res = await aPost(`/admin/orders/${draftId}/lines`, {
        lines: [{ catalogItemId: pizzaId, variantId: smallId, quantity: 1, modifiers: mods(thinId, jalapenoId) }],
      });
      expect(res.status).toBe(201);
      expect(res.body.lines).toHaveLength(2);
      const added = (res.body.lines as { catalogItemId: string; unitPriceMinorUnits: number }[]).find(
        (l) => l.catalogItemId === pizzaId,
      );
      expect(added?.unitPriceMinorUnits).toBe(10000 + 0 + 0 + 400);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('Refund idempotency', () => {
    let paymentId: string;
    let otherPaymentId: string;

    /** Opens a table session, orders 2 teas (2100 incl. 5% GST), finalises and pays cash. */
    const paidCashPayment = async (code: string): Promise<string> => {
      const areaId = await created('/admin/dining/areas', { locationId: locId, name: `Refund Hall ${code} ${RUN}` });
      const tableId = await created('/admin/dining/tables', { diningAreaId: areaId, locationId: locId, code: `${code}-${RUN}`, capacity: 2 });
      const s = await created('/admin/sessions', { locationId: locId, diningTableId: tableId, partySize: 1 });
      const o = await created('/admin/orders', { sessionId: s, idempotencyKey: freshKey(), lines: [{ catalogItemId: teaId, quantity: 2 }] });
      expect((await aPost(`/admin/orders/${o}/send`, {})).status).toBe(201);
      const inv = await aPost(`/admin/checkout/sessions/${s}/invoice`, {});
      expect(inv.status).toBe(201);
      expect(inv.body.grandTotalMinorUnits).toBe(2100);
      expect((await aPost(`/admin/checkout/invoices/${inv.body.id}/finalise`, {})).status).toBe(201);
      const pay = await aPost(`/admin/checkout/invoices/${inv.body.id}/payments`, {
        idempotencyKey: freshKey(), method: 'CASH', amountMinorUnits: 2100, cashReceivedMinorUnits: 2100,
      });
      expect(pay.status).toBe(201);
      expect(pay.body.status).toBe('CAPTURED');
      return pay.body.id as string;
    };

    const refund = (pid: string, body: object) => aPost(`/admin/checkout/payments/${pid}/refunds`, body);
    const refundsOf = async (pid: string) => {
      const res = await aGet(`/admin/checkout/payments/${pid}`);
      expect(res.status).toBe(200);
      return res.body.refunds as { id: string; amountMinorUnits: number }[];
    };

    beforeAll(async () => {
      paymentId = await paidCashPayment('RF1');
      otherPaymentId = await paidCashPayment('RF2');
    });

    it('replays the original refund for a retried key (no double refund)', async () => {
      const key = freshKey();
      const r1 = await refund(paymentId, { idempotencyKey: key, reason: 'Cold tea', amountMinorUnits: 500 });
      expect(r1.status).toBe(201);
      expect(r1.body.idempotencyKey).toBe(key);

      const r2 = await refund(paymentId, { idempotencyKey: key, reason: 'Cold tea', amountMinorUnits: 500 });
      expect(r2.status).toBe(201);
      expect(r2.body.id).toBe(r1.body.id);

      const rows = await refundsOf(paymentId);
      expect(rows).toHaveLength(1);
      expect(rows.reduce((s, r) => s + r.amountMinorUnits, 0)).toBe(500);

      // Audited exactly once
      const audit = await aGet('/admin/audit?action=refund.created&take=100');
      expect(audit.status).toBe(200);
      const hits = (audit.body.events as { resourceId: string }[]).filter((e) => e.resourceId === r1.body.id);
      expect(hits).toHaveLength(1);
    });

    it('same key with a different amount → 409 CONFLICT, nothing refunded', async () => {
      const key = freshKey();
      expect((await refund(paymentId, { idempotencyKey: key, reason: 'Spill', amountMinorUnits: 100 })).status).toBe(201);
      const res = await refund(paymentId, { idempotencyKey: key, reason: 'Spill', amountMinorUnits: 200 });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      const total = (await refundsOf(paymentId)).reduce((s, r) => s + r.amountMinorUnits, 0);
      expect(total).toBe(500 + 100);
    });

    it('same key on a different payment → 409 CONFLICT', async () => {
      const key = freshKey();
      expect((await refund(paymentId, { idempotencyKey: key, reason: 'Wrong order', amountMinorUnits: 100 })).status).toBe(201);
      const res = await refund(otherPaymentId, { idempotencyKey: key, reason: 'Wrong order', amountMinorUnits: 100 });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(await refundsOf(otherPaymentId)).toHaveLength(0);
    });

    it('concurrent retries with one key create exactly one refund', async () => {
      const key = freshKey();
      const results = await Promise.all(
        Array.from({ length: 5 }, () => refund(otherPaymentId, { idempotencyKey: key, reason: 'Race', amountMinorUnits: 300 })),
      );
      for (const r of results) expect(r.status).toBe(201);
      expect(new Set(results.map((r) => r.body.id as string)).size).toBe(1);
      const rows = await refundsOf(otherPaymentId);
      expect(rows).toHaveLength(1);
      expect(rows[0].amountMinorUnits).toBe(300);
    });

    it('refunds without a key still work (key is optional)', async () => {
      const res = await refund(otherPaymentId, { reason: 'No key', amountMinorUnits: 100 });
      expect(res.status).toBe(201);
      expect(res.body.idempotencyKey).toBeNull();
    });

    it('rejects a malformed key', async () => {
      const res = await refund(otherPaymentId, { idempotencyKey: 'not-a-uuid', reason: 'Bad', amountMinorUnits: 100 });
      expect(res.status).toBe(400);
    });
  });
});
