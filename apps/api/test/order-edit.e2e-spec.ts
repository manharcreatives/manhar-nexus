import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';
import { RealtimeBus } from '../src/realtime/realtime.bus';
import type { RealtimeEvent } from '../src/realtime/realtime.types';

jest.setTimeout(180_000);

/**
 * Order edit before the kitchen starts it (update round 2, A2).
 *   POST /admin/orders/:id/edit   (restaurant.order.edit)
 *   GET  /admin/orders/:id/edits  (restaurant.order.view)
 *
 * Rules under test: editable only in DRAFT/SENT with every line still PENDING (ORDER_EDIT_LOCKED otherwise),
 * optimistic concurrency (VERSION_CONFLICT), idempotent retries (also racing), append-only history + audit,
 * server-side re-pricing, permission gating, live-update topics, edit vs kitchen-accept races.
 */
describe('Order edit before the kitchen starts (e2e)', () => {
  let app: INestApplication;
  let platformToken: string;
  let ownerToken: string;
  let waiterToken: string; // restaurant.order.edit
  let noEditToken: string; // restaurant.order.manage but NOT edit
  let kitchenToken: string;
  let bizId: string;
  let locId: string;
  let tableCounter = 0;

  let pizzaId: string;
  let teaId: string;
  let soupId: string;
  let smallId: string;
  let largeId: string;
  let familyId: string; // unavailable variant
  let thinId: string;
  let thickId: string;
  let truffleId: string; // unavailable option

  const RUN = Date.now().toString(36);
  const http = () => app.getHttpServer();
  const uuid = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });

  const as = (token: string) => ({
    get: (p: string) => request(http()).get(p).set('authorization', `Bearer ${token}`),
    post: (p: string, b: object = {}) => request(http()).post(p).set('authorization', `Bearer ${token}`).send(b),
  });
  const owner = () => as(ownerToken);
  const kitchen = () => as(kitchenToken);

  const activate = async (module: string) => {
    const a = await as(platformToken).post(`/internal/businesses/${bizId}/modules/${module}/activate`);
    if (a.status !== 201 && a.status !== 409) throw new Error(`activate ${module}: ${a.status}`);
    const s = await as(platformToken).post(`/internal/businesses/${bizId}/modules/${module}/complete-setup`);
    if (s.status !== 200 && s.status !== 201) throw new Error(`complete-setup ${module}: ${s.status}`);
  };
  const created = async (path: string, body: object): Promise<string> => {
    const res = await owner().post(path, body);
    if (res.status !== 201) throw new Error(`${path} -> ${res.status} ${JSON.stringify(res.body)}`);
    return res.body.id as string;
  };
  const loginAs = async (email: string, password: string) => {
    const r = await request(http()).post('/auth/login').send({ email, password });
    expect(r.status).toBe(200);
    return r.body.accessToken as string;
  };
  const makeUser = async (label: string, permissions: string[]): Promise<string> => {
    const role = await owner().post('/admin/roles', { key: `${label}-${RUN}`, name: `${label} ${RUN}`, permissions });
    expect(role.status).toBe(201);
    const email = `${label}-${RUN}@test.local`;
    const user = await owner().post('/admin/users', { email, displayName: `${label} ${RUN}`, password: 'Staff!Pass123' });
    expect(user.status).toBe(201);
    const assign = await owner().post(`/admin/users/${user.body.id as string}/roles`, { roleId: role.body.id });
    expect(assign.status).toBe(204);
    return loginAs(email, 'Staff!Pass123');
  };

  const newSession = async (): Promise<string> => {
    const areaId = await created('/admin/dining/areas', { locationId: locId, name: `Hall ${RUN}-${tableCounter}` });
    const tableId = await created('/admin/dining/tables', {
      diningAreaId: areaId, locationId: locId, code: `OE${tableCounter++}-${RUN}`, capacity: 4,
    });
    return created('/admin/sessions', { locationId: locId, diningTableId: tableId, partySize: 2 });
  };

  type Line = { catalogItemId: string; variantId?: string; quantity: number; notes?: string; modifiers?: { modifierOptionId: string }[] };
  /** Creates and SENDS an order; returns the SENT request. */
  const sentOrder = async (sessionId: string, lines: Line[]) => {
    const draft = await owner().post('/admin/orders', { sessionId, idempotencyKey: uuid(), lines: lines.map((l) => ({ modifiers: [], ...l })) });
    expect(draft.status).toBe(201);
    const sent = await owner().post(`/admin/orders/${draft.body.id as string}/send`, {});
    expect(sent.status).toBe(201);
    return sent.body as Order;
  };
  interface OrderLine { id: string; itemNameSnapshot: string; variantNameSnapshot: string | null; quantity: number; unitPriceMinorUnits: number; notes: string | null; status: string; cancelReason: string | null; editKind: string | null; editedAt: string | null; modifiers: { optionNameSnapshot: string }[] }
  interface Order { id: string; status: string; version: number; notes: string | null; editCount: number; lastEditedAt: string | null; locationId: string; lines: OrderLine[]; edit?: { id: string; editNumber: number; replayed: boolean } }
  const get = async (id: string) => (await owner().get(`/admin/orders/${id}`)).body as Order;
  const active = (o: Order) => o.lines.filter((l) => l.status !== 'CANCELLED');
  const total = (o: Order) => active(o).reduce((s, l) => s + l.unitPriceMinorUnits * l.quantity, 0);

  const edit = (token: string, id: string, order: Order, body: object) =>
    as(token).post(`/admin/orders/${id}/edit`, { idempotencyKey: uuid(), expectedVersion: order.version, ...body });

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

    const biz = await as(platformToken).post('/internal/businesses', { name: `OE Biz ${RUN}`, businessTypeKey: 'restaurant' });
    expect(biz.status).toBe(201);
    bizId = biz.body.id as string;
    const email = `owner-oe-${RUN}@test.local`;
    expect((await as(platformToken).post(`/internal/businesses/${bizId}/provision`, { email, displayName: 'Owner OE', password: 'Test!Password1' })).status).toBe(201);
    ownerToken = await loginAs(email, 'Test!Password1');
    const loc = await as(platformToken).post(`/internal/businesses/${bizId}/locations`, { name: `OE Loc ${RUN}`, timezone: 'Asia/Kolkata' });
    expect(loc.status).toBe(201);
    locId = loc.body.id as string;
    for (const m of ['restaurant', 'catalog', 'checkout']) await activate(m);

    const taxId = await created('/admin/catalog/tax-categories', { name: `GST ${RUN}`, rate: 0.05, isDefault: true });
    const catId = await created('/admin/catalog/categories', { name: `OE Cat ${RUN}` });
    const item = (name: string, basePriceMinorUnits: number) =>
      created('/admin/catalog/items', { categoryId: catId, taxCategoryId: taxId, name: `${name} ${RUN}`, basePriceMinorUnits });
    pizzaId = await item('Pizza', 10000);
    teaId = await item('Tea', 1500);
    soupId = await item('Soup', 4000);
    smallId = await created(`/admin/catalog/items/${pizzaId}/variants`, { name: 'Small', priceAdjMinorUnits: 0 });
    largeId = await created(`/admin/catalog/items/${pizzaId}/variants`, { name: 'Large', priceAdjMinorUnits: 3000 });
    familyId = await created(`/admin/catalog/items/${pizzaId}/variants`, { name: 'Family', priceAdjMinorUnits: 6000, isAvailable: false });
    const crust = await created('/admin/catalog/modifier-groups', { name: `Crust ${RUN}`, selectionType: 'SINGLE', isRequired: true, minSelections: 1, maxSelections: 1 });
    thinId = await created(`/admin/catalog/modifier-groups/${crust}/options`, { name: 'Thin', priceAdjMinorUnits: 0 });
    thickId = await created(`/admin/catalog/modifier-groups/${crust}/options`, { name: 'Thick', priceAdjMinorUnits: 500 });
    truffleId = await created(`/admin/catalog/modifier-groups/${crust}/options`, { name: 'Truffle', priceAdjMinorUnits: 900, isAvailable: false });
    expect((await owner().post(`/admin/catalog/items/${pizzaId}/modifier-groups`, { modifierGroupId: crust, sortOrder: 0 })).status).toBe(201);

    const base = ['core.notification.view', 'restaurant.order.view', 'restaurant.session.view', 'restaurant.dining.view', 'catalog.item.view'];
    waiterToken = await makeUser('waiter', [...base, 'restaurant.order.manage', 'restaurant.order.edit']);
    noEditToken = await makeUser('noedit', [...base, 'restaurant.order.manage']);
    kitchenToken = await makeUser('kitchen', [...base, 'restaurant.kitchen.view', 'restaurant.kitchen.manage']);
  });

  afterAll(async () => {
    await app.close();
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('permission', () => {
    it('waiter with restaurant.order.edit may edit; order.manage alone, kitchen and anonymous may not', async () => {
      const s = await newSession();
      const o = await sentOrder(s, [{ catalogItemId: teaId, quantity: 1 }]);
      const body = { ops: [{ op: 'update', lineId: o.lines[0]!.id, quantity: 2 }] };

      expect((await edit(noEditToken, o.id, o, body)).status).toBe(403);
      expect((await edit(kitchenToken, o.id, o, body)).status).toBe(403);
      const anon = await request(http()).post(`/admin/orders/${o.id}/edit`).send({ idempotencyKey: uuid(), expectedVersion: o.version, ...body });
      expect(anon.status).toBe(401);
      expect((await get(o.id)).version).toBe(o.version); // nothing changed

      const ok = await edit(waiterToken, o.id, o, body);
      expect(ok.status).toBe(200);
    });

    it('the edit state / history is readable with restaurant.order.view only', async () => {
      const s = await newSession();
      const o = await sentOrder(s, [{ catalogItemId: teaId, quantity: 1 }]);
      const r = await kitchen().get(`/admin/orders/${o.id}/edits`);
      expect(r.status).toBe(200);
      expect(r.body.editable).toEqual({ allowed: true });
      expect(r.body.edits).toEqual([]);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('editing a SENT order (kitchen has not started)', () => {
    it('adds, changes and removes lines in one audited edit; prices come from the server', async () => {
      const s = await newSession();
      const o = await sentOrder(s, [
        { catalogItemId: teaId, quantity: 2, notes: 'less sugar' },
        { catalogItemId: soupId, quantity: 1 },
      ]);
      const tea = o.lines.find((l) => l.itemNameSnapshot.startsWith('Tea'))!;
      const soup = o.lines.find((l) => l.itemNameSnapshot.startsWith('Soup'))!;
      expect(total(o)).toBe(2 * 1500 + 4000);

      const res = await edit(waiterToken, o.id, o, {
        reason: 'Guest changed their mind',
        ops: [
          { op: 'update', lineId: tea.id, quantity: 3, notes: 'no sugar' },
          { op: 'remove', lineId: soup.id },
          // a hostile client sends prices / status: unknown keys are stripped, price is recomputed
          { op: 'add', line: { catalogItemId: pizzaId, variantId: largeId, quantity: 1, modifiers: [{ modifierOptionId: thickId }], unitPriceMinorUnits: 1 } },
        ],
      });
      expect(res.status).toBe(200);
      const after = res.body as Order;
      expect(after.version).toBe(o.version + 1);
      expect(after.editCount).toBe(1);
      expect(after.lastEditedAt).toBeTruthy();
      expect(after.edit).toMatchObject({ editNumber: 1, replayed: false });

      const teaAfter = after.lines.find((l) => l.id === tea.id)!;
      expect(teaAfter).toMatchObject({ quantity: 3, notes: 'no sugar', status: 'PENDING', editKind: 'CHANGED' });
      expect(teaAfter.editedAt).toBeTruthy();
      const soupAfter = after.lines.find((l) => l.id === soup.id)!;
      expect(soupAfter).toMatchObject({ status: 'CANCELLED', cancelReason: 'Removed by order edit' }); // kept, never deleted
      const pizza = after.lines.find((l) => l.itemNameSnapshot.startsWith('Pizza'))!;
      expect(pizza).toMatchObject({ editKind: 'ADDED', unitPriceMinorUnits: 10000 + 3000 + 500, variantNameSnapshot: 'Large' });
      expect(total(after)).toBe(3 * 1500 + 13500);

      // History row (append-only) with before/after and totals
      const hist = await owner().get(`/admin/orders/${o.id}/edits`);
      expect(hist.body.edits).toHaveLength(1);
      const row = hist.body.edits[0];
      expect(row).toMatchObject({ editNumber: 1, fromVersion: o.version, toVersion: after.version, statusAtEdit: 'SENT', reason: 'Guest changed their mind', actorType: 'USER' });
      expect(row.totalBeforeMinorUnits).toBe(2 * 1500 + 4000);
      expect(row.totalAfterMinorUnits).toBe(total(after));
      expect(row.changes.map((c: { op: string }) => c.op).sort()).toEqual(['add', 'remove', 'update']);
      expect(row.changes.find((c: { op: string }) => c.op === 'update').before).toMatchObject({ quantity: 2, notes: 'less sugar' });

      // Hash-chained audit event written in the same transaction
      const audit = await owner().get(`/admin/audit?action=service_request.edited&resourceId=${o.id}`);
      expect(audit.status).toBe(200);
      const events = audit.body.events as { action: string; metadata: Record<string, unknown> }[];
      expect(events).toHaveLength(1);
      expect(events[0]!.metadata).toMatchObject({ editNumber: 1, statusAtEdit: 'SENT', kitchenVisible: true });
      expect((await owner().get('/admin/audit/verify')).body.valid).toBe(true);
    });

    it('the kitchen queue carries the "edited" flag and the changed lines', async () => {
      const s = await newSession();
      const o = await sentOrder(s, [{ catalogItemId: teaId, quantity: 1 }]);
      const before = (await kitchen().get('/admin/kitchen')).body as Order[];
      expect(before.find((q) => q.id === o.id)?.editCount).toBe(0);

      expect((await edit(waiterToken, o.id, o, { ops: [{ op: 'add', line: { catalogItemId: soupId, quantity: 2 } }] })).status).toBe(200);
      const q = ((await kitchen().get('/admin/kitchen')).body as Order[]).find((x) => x.id === o.id)!;
      expect(q.editCount).toBe(1);
      expect(q.lastEditedAt).toBeTruthy();
      expect(q.lines.filter((l) => l.editKind === 'ADDED')).toHaveLength(1);
    });

    it('re-prices a line when its variant or options change (old line cancelled, new line snapshotted)', async () => {
      const s = await newSession();
      const o = await sentOrder(s, [{ catalogItemId: pizzaId, variantId: smallId, quantity: 2, notes: 'well done', modifiers: [{ modifierOptionId: thinId }] }]);
      const line = o.lines[0]!;
      expect(line.unitPriceMinorUnits).toBe(10000);

      const res = await edit(waiterToken, o.id, o, {
        ops: [{ op: 'update', lineId: line.id, variantId: largeId, modifiers: [{ modifierOptionId: thickId }] }],
      });
      expect(res.status).toBe(200);
      const after = res.body as Order;
      expect(after.lines.find((l) => l.id === line.id)).toMatchObject({ status: 'CANCELLED', cancelReason: 'Replaced by order edit' });
      const fresh = active(after);
      expect(fresh).toHaveLength(1);
      expect(fresh[0]).toMatchObject({ variantNameSnapshot: 'Large', quantity: 2, notes: 'well done', unitPriceMinorUnits: 13500, editKind: 'CHANGED' });
      expect(fresh[0]!.modifiers.map((m) => m.optionNameSnapshot)).toEqual(['Thick']);
      expect(total(after)).toBe(27000);
    });

    it('edits the order note on its own', async () => {
      const s = await newSession();
      const o = await sentOrder(s, [{ catalogItemId: teaId, quantity: 1 }]);
      const res = await edit(waiterToken, o.id, o, { ops: [], notes: 'Birthday table' });
      expect(res.status).toBe(200);
      expect((res.body as Order).notes).toBe('Birthday table');
      expect((res.body as Order).editCount).toBe(1);
    });

    it('rejects bad edits with clear codes and changes nothing', async () => {
      const s = await newSession();
      const o = await sentOrder(s, [{ catalogItemId: teaId, quantity: 1 }, { catalogItemId: soupId, quantity: 1 }]);
      const [a, b] = o.lines as [OrderLine, OrderLine];

      const noop = await edit(waiterToken, o.id, o, { ops: [{ op: 'update', lineId: a.id, quantity: 1 }] });
      expect(noop.status).toBe(400);
      expect(noop.body.error.details.reason).toBe('NO_CHANGES');

      const empty = await edit(waiterToken, o.id, o, { ops: [{ op: 'remove', lineId: a.id }, { op: 'remove', lineId: b.id }] });
      expect(empty.status).toBe(400);
      expect(empty.body.error.details.reason).toBe('EMPTY_ORDER');

      const unknown = await edit(waiterToken, o.id, o, { ops: [{ op: 'remove', lineId: uuid() }] });
      expect(unknown.status).toBe(404);

      const twice = await edit(waiterToken, o.id, o, { ops: [{ op: 'remove', lineId: a.id }, { op: 'update', lineId: a.id, quantity: 4 }] });
      expect(twice.status).toBe(400);
      expect(twice.body.error.details.reason).toBe('LINE_TOUCHED_TWICE');

      const unavailable = await edit(waiterToken, o.id, o, { ops: [{ op: 'add', line: { catalogItemId: pizzaId, variantId: familyId, quantity: 1, modifiers: [{ modifierOptionId: thinId }] } }] });
      expect(unavailable.status).toBe(400);
      expect(unavailable.body.error.details.reason).toBe('VARIANT_UNAVAILABLE');
      const soldOut = await edit(waiterToken, o.id, o, { ops: [{ op: 'add', line: { catalogItemId: pizzaId, variantId: smallId, quantity: 1, modifiers: [{ modifierOptionId: truffleId }] } }] });
      expect(soldOut.status).toBe(400);
      expect(soldOut.body.error.details.reason).toBe('OPTION_UNAVAILABLE');
      const missingRequired = await edit(waiterToken, o.id, o, { ops: [{ op: 'add', line: { catalogItemId: pizzaId, quantity: 1 } }] });
      expect(missingRequired.body.error.details.reason).toBe('GROUP_MIN');

      const badBody = await as(waiterToken).post(`/admin/orders/${o.id}/edit`, { ops: [{ op: 'remove', lineId: a.id }] });
      expect(badBody.status).toBe(400); // idempotencyKey + expectedVersion are mandatory

      const after = await get(o.id);
      expect(after.version).toBe(o.version);
      expect(after.editCount).toBe(0);
      expect((await owner().get(`/admin/orders/${o.id}/edits`)).body.edits).toEqual([]);
    });

    it('a DRAFT can be edited too, but is not flagged for the kitchen', async () => {
      const s = await newSession();
      const draft = await owner().post('/admin/orders', { sessionId: s, idempotencyKey: uuid(), lines: [{ catalogItemId: teaId, quantity: 1, modifiers: [] }] });
      const d = draft.body as Order;
      const res = await edit(waiterToken, d.id, d, { ops: [{ op: 'update', lineId: d.lines[0]!.id, quantity: 4 }] });
      expect(res.status).toBe(200);
      expect((res.body as Order).editCount).toBe(0);
      expect(active(res.body as Order)[0]!.editKind).toBeNull();
      expect((await owner().get(`/admin/orders/${d.id}/edits`)).body.edits[0].statusAtEdit).toBe('DRAFT');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('too late: the kitchen has started (or the order is finished)', () => {
    const expectLocked = (res: request.Response, reason: string) => {
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ORDER_EDIT_LOCKED');
      expect(res.body.error.details.reason).toBe(reason);
      expect(res.body.error.message).toEqual(expect.any(String));
    };

    it.each([
      ['ACCEPTED', async (id: string) => kitchen().post(`/admin/kitchen/${id}/accept`, {})],
      ['PREPARING', async (id: string) => { await kitchen().post(`/admin/kitchen/${id}/accept`, {}); return kitchen().post(`/admin/kitchen/${id}/prepare`, {}); }],
      ['READY', async (id: string) => { await kitchen().post(`/admin/kitchen/${id}/accept`, {}); await kitchen().post(`/admin/kitchen/${id}/prepare`, {}); return kitchen().post(`/admin/kitchen/${id}/ready`, {}); }],
    ])('status %s -> 409 ORDER_EDIT_LOCKED / KITCHEN_STARTED, order untouched', async (status, advance) => {
      const s = await newSession();
      const o = await sentOrder(s, [{ catalogItemId: teaId, quantity: 1 }]);
      const moved = await advance(o.id);
      expect(moved.status).toBe(201);
      const now = await get(o.id);
      expect(now.status).toBe(status);

      expectLocked(await edit(waiterToken, o.id, now, { ops: [{ op: 'update', lineId: o.lines[0]!.id, quantity: 9 }] }), 'KITCHEN_STARTED');
      // lock beats a stale version: the useful answer is "too late", not "reload"
      expectLocked(await edit(waiterToken, o.id, { ...now, version: 1 }, { ops: [{ op: 'remove', lineId: o.lines[0]!.id }] }), 'KITCHEN_STARTED');

      const after = await get(o.id);
      expect(after.version).toBe(now.version);
      expect(after.lines[0]!.quantity).toBe(1);
      const state = await owner().get(`/admin/orders/${o.id}/edits`);
      expect(state.body.editable).toMatchObject({ allowed: false, reason: 'KITCHEN_STARTED' });
      expect(state.body.edits).toEqual([]);
    });

    it('partial accept (one line started) locks the whole order even though the request is still SENT', async () => {
      const s = await newSession();
      const o = await sentOrder(s, [{ catalogItemId: teaId, quantity: 1 }, { catalogItemId: soupId, quantity: 1 }]);
      expect((await kitchen().post(`/admin/kitchen/${o.id}/accept`, { lineIds: [o.lines[0]!.id] })).status).toBe(201);
      const now = await get(o.id);
      expect(now.status).toBe('SENT');
      expect(now.lines.map((l) => l.status).sort()).toEqual(['PENDING', 'PREPARING']);
      expectLocked(await edit(waiterToken, o.id, now, { ops: [{ op: 'add', line: { catalogItemId: teaId, quantity: 1 } }] }), 'KITCHEN_STARTED');
    });

    it('SERVED and CANCELLED orders are locked with their own reasons', async () => {
      const s = await newSession();
      const served = await sentOrder(s, [{ catalogItemId: teaId, quantity: 1 }]);
      for (const step of ['accept', 'prepare', 'ready']) await kitchen().post(`/admin/kitchen/${served.id}/${step}`, {});
      expect((await owner().post(`/admin/orders/${served.id}/serve`, {})).status).toBe(201);
      expectLocked(await edit(waiterToken, served.id, await get(served.id), { ops: [{ op: 'remove', lineId: served.lines[0]!.id }] }), 'ORDER_SERVED');

      const cancelled = await sentOrder(await newSession(), [{ catalogItemId: teaId, quantity: 1 }]);
      expect((await owner().post(`/admin/orders/${cancelled.id}/cancel`, { reason: 'guest left' })).status).toBe(201);
      expectLocked(await edit(waiterToken, cancelled.id, await get(cancelled.id), { notes: 'x', ops: [] }), 'ORDER_CANCELLED');
    });

    it('a live invoice freezes the order (INVOICE_EXISTS); voiding the invoice makes it editable again', async () => {
      const s = await newSession();
      const o = await sentOrder(s, [{ catalogItemId: teaId, quantity: 1 }]);
      const inv = await owner().post(`/admin/checkout/sessions/${s}/invoice`, {});
      expect([200, 201]).toContain(inv.status);
      expectLocked(await edit(waiterToken, o.id, o, { ops: [{ op: 'update', lineId: o.lines[0]!.id, quantity: 2 }] }), 'INVOICE_EXISTS');

      expect((await owner().post(`/admin/checkout/invoices/${inv.body.id as string}/void`, { reason: 'wrong order' })).status).toBe(201);
      const ok = await edit(waiterToken, o.id, o, { ops: [{ op: 'update', lineId: o.lines[0]!.id, quantity: 2 }] });
      expect(ok.status).toBe(200);
    });

    it('after an edit the kitchen can still accept, and sees the edited lines', async () => {
      const s = await newSession();
      const o = await sentOrder(s, [{ catalogItemId: teaId, quantity: 1 }]);
      expect((await edit(waiterToken, o.id, o, { ops: [{ op: 'add', line: { catalogItemId: soupId, quantity: 1 } }] })).status).toBe(200);
      const acc = await kitchen().post(`/admin/kitchen/${o.id}/accept`, {});
      expect(acc.status).toBe(201);
      const done = await get(o.id);
      expect(done.status).toBe('ACCEPTED');
      expect(active(done).map((l) => l.status)).toEqual(['PREPARING', 'PREPARING']);
      expect(done.editCount).toBe(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('concurrency', () => {
    it('a stale expectedVersion is a 409 VERSION_CONFLICT with the current version', async () => {
      const s = await newSession();
      const o = await sentOrder(s, [{ catalogItemId: teaId, quantity: 1 }]);
      expect((await edit(waiterToken, o.id, o, { ops: [{ op: 'update', lineId: o.lines[0]!.id, quantity: 2 }] })).status).toBe(200);
      const stale = await edit(waiterToken, o.id, o, { ops: [{ op: 'update', lineId: o.lines[0]!.id, quantity: 7 }] });
      expect(stale.status).toBe(409);
      expect(stale.body.error.code).toBe('VERSION_CONFLICT');
      expect(stale.body.error.details).toMatchObject({ expectedVersion: o.version, actualVersion: o.version + 1 });
      expect(active(await get(o.id))[0]!.quantity).toBe(2);
    });

    it('two waiters editing from the same version: exactly one wins, the other gets VERSION_CONFLICT, no 500', async () => {
      const s = await newSession();
      const o = await sentOrder(s, [{ catalogItemId: teaId, quantity: 1 }]);
      const results = await Promise.all(
        [2, 3, 4, 5].map((q) => edit(waiterToken, o.id, o, { ops: [{ op: 'update', lineId: o.lines[0]!.id, quantity: q }] })),
      );
      const codes = results.map((r) => r.status).sort();
      expect(codes).toEqual([200, 409, 409, 409]);
      for (const r of results.filter((x) => x.status === 409)) expect(r.body.error.code).toBe('VERSION_CONFLICT');
      const after = await get(o.id);
      expect(after.version).toBe(o.version + 1);
      expect(after.editCount).toBe(1);
      expect((await owner().get(`/admin/orders/${o.id}/edits`)).body.edits).toHaveLength(1);
    });

    it('edit racing the kitchen "accept": never a 500, never a half-applied edit', async () => {
      for (let i = 0; i < 6; i++) {
        const s = await newSession();
        const o = await sentOrder(s, [{ catalogItemId: teaId, quantity: 1 }]);
        const [e, a] = await Promise.all([
          edit(waiterToken, o.id, o, { ops: [{ op: 'add', line: { catalogItemId: soupId, quantity: 1 } }] }),
          kitchen().post(`/admin/kitchen/${o.id}/accept`, {}),
        ]);
        expect(a.status).toBe(201);
        expect([200, 409]).toContain(e.status);
        const after = await get(o.id);
        expect(after.status).toBe('ACCEPTED');
        const hist = (await owner().get(`/admin/orders/${o.id}/edits`)).body.edits as unknown[];
        if (e.status === 200) {
          // edit landed first: the accept covered the new line too
          expect(hist).toHaveLength(1);
          expect(active(after).map((l) => l.status)).toEqual(['PREPARING', 'PREPARING']);
        } else {
          expect(['ORDER_EDIT_LOCKED', 'VERSION_CONFLICT']).toContain(e.body.error.code);
          expect(hist).toHaveLength(0);
          expect(active(after)).toHaveLength(1);
        }
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('idempotency', () => {
    it('replaying the same key returns the order with replayed=true and changes nothing', async () => {
      const s = await newSession();
      const o = await sentOrder(s, [{ catalogItemId: teaId, quantity: 1 }]);
      const body = { idempotencyKey: uuid(), expectedVersion: o.version, ops: [{ op: 'update', lineId: o.lines[0]!.id, quantity: 3 }] };
      const first = await as(waiterToken).post(`/admin/orders/${o.id}/edit`, body);
      const second = await as(waiterToken).post(`/admin/orders/${o.id}/edit`, body); // same key, now-stale version
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(first.body.edit.replayed).toBe(false);
      expect(second.body.edit).toMatchObject({ id: first.body.edit.id, editNumber: 1, replayed: true });
      expect(second.body.version).toBe(o.version + 1);
      const after = await get(o.id);
      expect(after.editCount).toBe(1);
      expect(active(after)[0]!.quantity).toBe(3);
      expect((await owner().get(`/admin/orders/${o.id}/edits`)).body.edits).toHaveLength(1);
      const audit = await owner().get(`/admin/audit?action=service_request.edited&resourceId=${o.id}`);
      expect(audit.body.events as unknown[]).toHaveLength(1);
    });

    it('a replay still works after the kitchen started (the answer to a lost response is not an error)', async () => {
      const s = await newSession();
      const o = await sentOrder(s, [{ catalogItemId: teaId, quantity: 1 }]);
      const body = { idempotencyKey: uuid(), expectedVersion: o.version, ops: [{ op: 'update', lineId: o.lines[0]!.id, quantity: 2 }] };
      expect((await as(waiterToken).post(`/admin/orders/${o.id}/edit`, body)).status).toBe(200);
      await kitchen().post(`/admin/kitchen/${o.id}/accept`, {});
      const retry = await as(waiterToken).post(`/admin/orders/${o.id}/edit`, body);
      expect(retry.status).toBe(200);
      expect(retry.body.edit.replayed).toBe(true);
    });

    it('five identical requests racing apply exactly once', async () => {
      const s = await newSession();
      const o = await sentOrder(s, [{ catalogItemId: teaId, quantity: 1 }]);
      const body = { idempotencyKey: uuid(), expectedVersion: o.version, ops: [{ op: 'add', line: { catalogItemId: soupId, quantity: 1 } }] };
      const results = await Promise.all([1, 2, 3, 4, 5].map(() => as(waiterToken).post(`/admin/orders/${o.id}/edit`, body)));
      expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
      expect(results.filter((r) => r.body.edit.replayed === false)).toHaveLength(1);
      const after = await get(o.id);
      expect(active(after)).toHaveLength(2);
      expect(after.editCount).toBe(1);
      expect((await owner().get(`/admin/orders/${o.id}/edits`)).body.edits).toHaveLength(1);
    });

    it('the same key on another order is a 409 CONFLICT, not a silent replay', async () => {
      const s = await newSession();
      const a = await sentOrder(s, [{ catalogItemId: teaId, quantity: 1 }]);
      const b = await sentOrder(s, [{ catalogItemId: soupId, quantity: 1 }]);
      const key = uuid();
      expect((await as(waiterToken).post(`/admin/orders/${a.id}/edit`, { idempotencyKey: key, expectedVersion: a.version, ops: [{ op: 'update', lineId: a.lines[0]!.id, quantity: 2 }] })).status).toBe(200);
      const clash = await as(waiterToken).post(`/admin/orders/${b.id}/edit`, { idempotencyKey: key, expectedVersion: b.version, ops: [{ op: 'update', lineId: b.lines[0]!.id, quantity: 2 }] });
      expect(clash.status).toBe(409);
      expect(clash.body.error.details.reason).toBe('IDEMPOTENCY_KEY_REUSED');
      expect((await get(b.id)).version).toBe(b.version);
    });

    it('several sequential edits number 1..n and keep a complete trail', async () => {
      const s = await newSession();
      let o = await sentOrder(s, [{ catalogItemId: teaId, quantity: 1 }]);
      for (let q = 2; q <= 4; q++) {
        const r = await edit(waiterToken, o.id, o, { ops: [{ op: 'update', lineId: o.lines[0]!.id, quantity: q }] });
        expect(r.status).toBe(200);
        o = r.body as Order;
      }
      expect(o.editCount).toBe(3);
      const hist = (await owner().get(`/admin/orders/${o.id}/edits`)).body.edits as { editNumber: number; changes: { before: { quantity: number }; after: { quantity: number } }[] }[];
      expect(hist.map((h) => h.editNumber)).toEqual([1, 2, 3]);
      expect(hist.map((h) => [h.changes[0]!.before.quantity, h.changes[0]!.after.quantity])).toEqual([[1, 2], [2, 3], [3, 4]]);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('realtime + isolation', () => {
    it('an edit emits orders + kitchen change events for the business and nothing on a rejected edit', async () => {
      const bus = app.get(RealtimeBus);
      const s = await newSession();
      const o = await sentOrder(s, [{ catalogItemId: teaId, quantity: 1 }]);
      const seen: RealtimeEvent[] = [];
      const sub = bus.subscribe(bizId).subscribe((e) => seen.push(e));
      try {
        await edit(waiterToken, o.id, { ...o, version: 999 }, { ops: [{ op: 'update', lineId: o.lines[0]!.id, quantity: 2 }] }); // 409
        expect(seen).toHaveLength(0);
        expect((await edit(waiterToken, o.id, o, { ops: [{ op: 'update', lineId: o.lines[0]!.id, quantity: 2 }] })).status).toBe(200);
        expect(seen.map((e) => e.topic).sort()).toEqual(['kitchen', 'orders']);
        expect(seen.every((e) => e.locationId === locId)).toBe(true);
      } finally {
        sub.unsubscribe();
      }
    });

    it("another business cannot see or edit this business's order (404)", async () => {
      const s = await newSession();
      const o = await sentOrder(s, [{ catalogItemId: teaId, quantity: 1 }]);
      const biz2 = await as(platformToken).post('/internal/businesses', { name: `OE Other ${RUN}`, businessTypeKey: 'restaurant' });
      const email = `owner-oe2-${RUN}@test.local`;
      await as(platformToken).post(`/internal/businesses/${biz2.body.id as string}/provision`, { email, displayName: 'Other', password: 'Test!Password1' });
      const other = as(await loginAs(email, 'Test!Password1'));
      await as(platformToken).post(`/internal/businesses/${biz2.body.id as string}/modules/restaurant/activate`);
      await as(platformToken).post(`/internal/businesses/${biz2.body.id as string}/modules/restaurant/complete-setup`);
      const r = await other.post(`/admin/orders/${o.id}/edit`, { idempotencyKey: uuid(), expectedVersion: o.version, ops: [{ op: 'remove', lineId: o.lines[0]!.id }] });
      expect(r.status).toBe(404);
      expect((await other.get(`/admin/orders/${o.id}/edits`)).status).toBe(404);
    });
  });
});
