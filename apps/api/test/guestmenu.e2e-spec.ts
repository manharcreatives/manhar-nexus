import request from 'supertest';
import { bootstrap, relaxLimits, uuid, type Fixture } from './guestmenu-harness';

relaxLimits();
jest.setTimeout(240_000);

/**
 * QR digital menu (ADR-035) - public side: menu, guest identity, ordering (confirm + auto), pricing, idempotency,
 * state + bill, waiter call, UPI intent; staff side: QR codes, settings, guest-order inbox; security + privacy.
 */
describe('QR digital menu (e2e)', () => {
  let f: Fixture;
  let L: Fixture['ids'];

  beforeAll(async () => {
    f = await bootstrap('gm');
    L = f.ids;
  });
  afterAll(async () => {
    await f.close();
  });

  const setMode = async (ordering: 'off' | 'confirm' | 'auto') => {
    const r = await f.patch(f.ownerToken, '/admin/qr/settings', { ordering });
    expect(r.status).toBe(200);
  };
  const menuWithEtag = (qr: string, etag: string) => f.pub.get(qr).set('if-none-match', etag);

  // ───────────────────────────────────────────────────────────────────────────
  describe('QR codes (staff)', () => {
    it('lists every table with a 192-bit token and a /m/<token> path; tokens are stable and unique', async () => {
      const a = await f.table('Q1', { open: false });
      const b = await f.table('Q2', { open: false });
      const first = await f.get(f.ownerToken, '/admin/qr/tables');
      expect(first.status).toBe(200);
      const rows = first.body as { tableId: string; code: string; token: string; path: string; enabled: boolean; orderingEnabled: boolean; version: number }[];
      const ra = rows.find((r) => r.tableId === a.tableId)!;
      const rb = rows.find((r) => r.tableId === b.tableId)!;
      expect(ra.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
      expect(Buffer.from(ra.token, 'base64url')).toHaveLength(24);
      expect(ra.token).not.toBe(rb.token);
      expect(ra.path).toBe(`/m/${ra.token}`);
      expect(ra).toMatchObject({ code: a.code, enabled: true, orderingEnabled: true });
      const second = await f.get(f.ownerToken, '/admin/qr/tables');
      expect((second.body as { tableId: string; token: string }[]).find((r) => r.tableId === a.tableId)!.token).toBe(ra.token);
    });

    it('is limited to people with restaurant.qr.manage and never crosses tenants', async () => {
      expect((await f.get(null, '/admin/qr/tables')).status).toBe(401);
      expect((await f.get(f.kitchenToken, '/admin/qr/tables')).status).toBe(403);
      expect((await f.get(f.waiterToken, '/admin/qr/tables')).status).toBe(403);
      expect((await f.get(f.hostToken, '/admin/qr/settings')).status).toBe(403);
      const t = await f.table('Q3', { open: false });
      const mine = await f.qrToken(t.tableId);
      const theirs = await f.get(f.other.ownerToken, '/admin/qr/tables');
      expect(theirs.status).toBe(200);
      expect((theirs.body as { tableId: string; token: string }[]).some((r) => r.tableId === t.tableId || r.token === mine)).toBe(false);
      expect((await f.post(f.other.ownerToken, `/admin/qr/tables/${t.tableId}/rotate`)).status).toBe(404);
      expect((await f.patch(f.other.ownerToken, `/admin/qr/tables/${t.tableId}`, { enabled: false })).status).toBe(404);
    });

    it('rotating replaces the token, kills the old link and revokes the guests of that table', async () => {
      const t = await f.table('ROT');
      const oldToken = await f.qrToken(t.tableId);
      const g = await f.guest(oldToken, 'Asha');
      expect((await f.pub.get(oldToken, '/state', g)).status).toBe(200);

      const rot = await f.post(f.ownerToken, `/admin/qr/tables/${t.tableId}/rotate`, {});
      expect(rot.status).toBe(200);
      expect(rot.body.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
      expect(rot.body.token).not.toBe(oldToken);
      expect(rot.body.rotationCount).toBe(1);

      expect((await f.pub.get(oldToken)).status).toBe(404);
      expect((await f.pub.get(rot.body.token)).status).toBe(200);
      const state = await f.pub.get(rot.body.token, '/state', g);
      expect(state.status).toBe(401);
      expect(state.body.error.code).toBe('GUEST_TOKEN_INVALID');

      const stale = await f.post(f.ownerToken, `/admin/qr/tables/${t.tableId}/rotate`, { expectedVersion: rot.body.version - 1 });
      expect(stale.status).toBe(409);
    });

    it('can switch a table off (menu 403) and its ordering off (menu readable, ordering refused)', async () => {
      await setMode('confirm');
      const t = await f.table('SW');
      const qr = await f.qrToken(t.tableId);
      const g = await f.guest(qr);

      expect((await f.patch(f.ownerToken, `/admin/qr/tables/${t.tableId}`, { orderingEnabled: false })).status).toBe(200);
      const menu = await f.pub.get(qr);
      expect(menu.status).toBe(200);
      expect(menu.body.settings.ordering).toBe('off');
      const refused = await f.order(qr, g, [{ itemId: L.burger, qty: 1 }]);
      expect(refused.status).toBe(403);
      expect(refused.body.error.code).toBe('ORDERING_OFF');
      expect((await f.patch(f.ownerToken, `/admin/qr/tables/${t.tableId}`, { orderingEnabled: true })).status).toBe(200);
      expect((await f.order(qr, g, [{ itemId: L.burger, qty: 1 }])).status).toBe(201);

      expect((await f.patch(f.ownerToken, `/admin/qr/tables/${t.tableId}`, { enabled: false })).status).toBe(200);
      const off = await f.pub.get(qr);
      expect(off.status).toBe(403);
      expect(off.body.error.code).toBe('MENU_DISABLED');
      expect((await f.patch(f.ownerToken, `/admin/qr/tables/${t.tableId}`, { enabled: true })).status).toBe(200);
      expect((await f.pub.get(qr)).status).toBe(200);
      expect((await f.patch(f.ownerToken, `/admin/qr/tables/${t.tableId}`, {})).status).toBe(400);
    });

    it('settings: get / patch with validation and optimistic version', async () => {
      const cur = await f.get(f.ownerToken, '/admin/qr/settings');
      expect(cur.status).toBe(200);
      expect(cur.body).toMatchObject({ enabled: true, callWaiter: true });
      expect((await f.patch(f.ownerToken, '/admin/qr/settings', { ordering: 'sometimes' })).status).toBe(400);
      expect((await f.patch(f.ownerToken, '/admin/qr/settings', { accentColor: 'red' })).status).toBe(400);
      expect((await f.patch(f.ownerToken, '/admin/qr/settings', { unknown: 1 })).status).toBe(400);
      const ok = await f.patch(f.ownerToken, '/admin/qr/settings', { tagline: 'Fresh daily', accentColor: '#1DBA3C', ordering: 'confirm' });
      expect(ok.status).toBe(200);
      expect(ok.body).toMatchObject({ tagline: 'Fresh daily', accentColor: '#1dba3c', ordering: 'confirm' });
      const stale = await f.patch(f.ownerToken, '/admin/qr/settings', { callWaiter: true, expectedVersion: ok.body.version - 1 });
      expect(stale.status).toBe(409);
      const menu = await f.pub.get(await f.qrToken((await f.table('SET', { open: false })).tableId));
      expect(menu.body.business).toMatchObject({ tagline: 'Fresh daily', accentColor: '#1dba3c' });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('public menu', () => {
    it('returns the contract shape with absolute prices, variants, add-on groups and sold-out flags', async () => {
      await setMode('confirm');
      const t = await f.table('MENU');
      const qr = await f.qrToken(t.tableId);
      const res = await f.pub.get(qr);
      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('private, no-cache');
      expect(res.headers.etag).toBeTruthy();
      const m = res.body;
      expect(m.etag).toBe(res.headers.etag);
      expect(m.table).toMatchObject({ label: t.code, open: true });
      expect(m.settings).toMatchObject({ ordering: 'confirm', callWaiter: true, payment: { upi: false } });
      expect(m.business.currency).toBe('INR');
      type Item = { id: string; priceMinor: number; soldOut: boolean; variants: { id: string; name: string; priceMinor: number }[]; addOnGroups: { min: number; max: number; options: { id: string; name: string; priceMinor: number }[] }[] };
      const item = (id: string) => (m.items as Item[]).find((i) => i.id === id)!;
      expect(item(L.burger)).toMatchObject({ priceMinor: 1000, soldOut: false, variants: [], addOnGroups: [] });
      expect(item(L.soldOut).soldOut).toBe(true);
      const pizza = item(L.pizza);
      expect(pizza.variants.map((v) => [v.name, v.priceMinor])).toEqual([
        ['Small', 8000],
        ['Large', 11000],
      ]);
      expect(pizza.addOnGroups).toHaveLength(1);
      expect(pizza.addOnGroups[0]).toMatchObject({ min: 1, max: 1 });
      expect(pizza.addOnGroups[0]!.options.map((o) => [o.name, o.priceMinor])).toEqual([
        ['Thin', 0],
        ['Thick', 500],
      ]);
      expect(m.categories.length).toBeGreaterThan(0);
    });

    it('honours If-None-Match (304) and changes the ETag when the menu changes (live edit)', async () => {
      const t = await f.table('ETAG', { open: false });
      const qr = await f.qrToken(t.tableId);
      const a = await f.pub.get(qr);
      expect((await menuWithEtag(qr, a.headers.etag as string)).status).toBe(304);
      const edit = await f.patch(f.ownerToken, `/admin/catalog/items/${L.tea}`, { basePriceMinorUnits: 350 });
      expect(edit.status).toBe(200);
      const b = await menuWithEtag(qr, a.headers.etag as string);
      expect(b.status).toBe(200);
      expect(b.headers.etag).not.toBe(a.headers.etag);
      expect((b.body.items as { id: string; priceMinor: number }[]).find((i) => i.id === L.tea)!.priceMinor).toBe(350);
      expect((await f.patch(f.ownerToken, `/admin/catalog/items/${L.tea}`, { basePriceMinorUnits: 300 })).status).toBe(200);
    });

    it('404 for an unknown or malformed token and never reveals which part was wrong', async () => {
      const unknown = await f.pub.get('A'.repeat(32));
      expect(unknown.status).toBe(404);
      const junk = await f.pub.get('not-a-token');
      expect(junk.status).toBe(404);
      expect(unknown.body.error.code).toBe(junk.body.error.code);
      expect(unknown.body.error.message).toBe(junk.body.error.message);
    });

    it('a closed table still shows the menu but marks the table as not open', async () => {
      const t = await f.table('CLOSED', { open: false });
      const res = await f.pub.get(await f.qrToken(t.tableId));
      expect(res.status).toBe(200);
      expect(res.body.table.open).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('guest identity', () => {
    it('issues a 256-bit token for an open visit only', async () => {
      const open = await f.table('GOPEN');
      const closed = await f.table('GCLOSED', { open: false });
      const qrOpen = await f.qrToken(open.tableId);
      const qrClosed = await f.qrToken(closed.tableId);
      const r = await f.pub.post(qrOpen, '/guest', { displayName: '  Asha\n  K  ' });
      expect(r.status).toBe(201);
      expect(r.headers['cache-control']).toBe('no-store');
      expect(r.body.guestToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(new Date(r.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
      const none = await f.pub.post(qrClosed, '/guest', {});
      expect(none.status).toBe(409);
      expect(none.body.error.code).toBe('TABLE_CLOSED');
      expect((await f.pub.post(qrOpen, '/guest', { displayName: 'x', admin: true })).status).toBe(400);
    });

    it('a token only works on its own table and visit', async () => {
      const a = await f.table('GA');
      const b = await f.table('GB');
      const qa = await f.qrToken(a.tableId);
      const qb = await f.qrToken(b.tableId);
      const g = await f.guest(qa);
      expect((await f.pub.get(qa, '/state', g)).status).toBe(200);
      expect((await f.pub.get(qb, '/state', g)).status).toBe(401);
      expect((await f.pub.get(qa, '/state')).status).toBe(401);
      expect((await f.pub.get(qa, '/state', 'x'.repeat(43))).status).toBe(401);
      expect((await f.post(f.ownerToken, `/admin/sessions/${a.sessionId}/close`, {})).status).toBeLessThan(300);
      const afterClose = await f.pub.get(qa, '/state', g);
      expect(afterClose.status).toBe(200);
      expect(afterClose.body).toMatchObject({ orders: [], bill: null, waiterCall: { open: false } });
      expect((await f.post(f.ownerToken, `/admin/dining/tables/${a.tableId}/reset`, {})).status).toBe(204);
      const reopen = await f.post(f.ownerToken, '/admin/sessions', { locationId: f.locId, diningTableId: a.tableId, partySize: 2 });
      expect(reopen.status).toBe(201);
      expect((await f.pub.get(qa, '/state', g)).status).toBe(401);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('placing orders', () => {
    let qr: string;
    let g: string;
    beforeAll(async () => {
      await setMode('confirm');
      const t = await f.table('ORD');
      qr = await f.qrToken(t.tableId);
      g = await f.guest(qr, 'Meera');
    });

    it('prices on the server: ignores any client price, applies variant + add-on, returns paise', async () => {
      const bad = await f.order(qr, g, [{ itemId: L.burger, qty: 1, priceMinor: 1 }]);
      expect(bad.status).toBe(400);
      const r = await f.order(
        qr,
        g,
        [
          { itemId: L.burger, qty: 2 },
          { itemId: L.pizza, variantId: L.large, addOnOptionIds: [L.thick], qty: 1, note: 'extra cheese' },
        ],
        { note: 'birthday table' },
      );
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({ status: 'AWAITING_CONFIRMATION', totalMinor: 2 * 1000 + 8000 + 3000 + 500 });
      expect(r.body.orderId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('is idempotent: same key + same body replays, same key + different body conflicts, no key is refused', async () => {
      const key = uuid();
      const lines = [{ itemId: L.tea, qty: 1 }];
      const a = await f.order(qr, g, lines, { key });
      expect(a.status).toBe(201);
      const b = await f.order(qr, g, lines, { key });
      expect(b.status).toBe(200);
      expect(b.headers['idempotent-replay']).toBe('true');
      expect(b.body.orderId).toBe(a.body.orderId);
      const c = await f.order(qr, g, [{ itemId: L.tea, qty: 2 }], { key });
      expect(c.status).toBe(409);
      expect(c.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
      const none = await f.pub.post(qr, '/orders', { lines }, { 'x-guest-token': g });
      expect(none.status).toBe(400);
      expect(none.body.error.details.reason).toBe('IDEMPOTENCY_KEY_REQUIRED');
    });

    it('ten identical in-flight requests create exactly one order', async () => {
      const t = await f.table('RACE');
      const q = await f.qrToken(t.tableId);
      const gg = await f.guest(q);
      const key = uuid();
      const results = await Promise.all(Array.from({ length: 10 }, () => f.order(q, gg, [{ itemId: L.burger, qty: 1 }], { key })));
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.every((r) => r.status === 201 || r.status === 200)).toBe(true);
      expect(new Set(results.map((r) => r.body.orderId)).size).toBe(1);
      const list = await f.get(f.waiterToken, '/admin/guest-orders?status=AWAITING_CONFIRMATION');
      expect((list.body as { tableId: string }[]).filter((o) => o.tableId === t.tableId)).toHaveLength(1);
    });

    it('refuses what cannot be served: sold out, missing/unavailable option, unknown item, absurd quantities', async () => {
      const soldOut = await f.order(qr, g, [{ itemId: L.soldOut, qty: 1 }]);
      expect(soldOut.status).toBe(409);
      expect(soldOut.body.error.code).toBe('SOLD_OUT');
      const noVariant = await f.order(qr, g, [{ itemId: L.pizza, qty: 1, addOnOptionIds: [L.thin] }]);
      expect(noVariant.status).toBe(400);
      expect(noVariant.body.error.details.reason).toBe('VARIANT_REQUIRED');
      const gone = await f.order(qr, g, [{ itemId: L.pizza, variantId: L.family, addOnOptionIds: [L.thin], qty: 1 }]);
      expect(gone.status).toBe(409);
      expect(gone.body.error.code).toBe('SOLD_OUT');
      const goneOpt = await f.order(qr, g, [{ itemId: L.pizza, variantId: L.small, addOnOptionIds: [L.truffle], qty: 1 }]);
      expect(goneOpt.status).toBe(409);
      const missingAddOn = await f.order(qr, g, [{ itemId: L.pizza, variantId: L.small, qty: 1 }]);
      expect(missingAddOn.status).toBe(400);
      expect((await f.order(qr, g, [{ itemId: uuid(), qty: 1 }])).status).toBe(400);
      expect((await f.order(qr, g, [{ itemId: L.burger, qty: 0 }])).status).toBe(400);
      expect((await f.order(qr, g, [{ itemId: L.burger, qty: 1000 }])).status).toBe(400);
      expect((await f.order(qr, g, [])).status).toBe(400);
      expect((await f.order(qr, g, Array.from({ length: 60 }, () => ({ itemId: L.burger, qty: 1 })))).status).toBe(400);
      expect((await f.order(qr, g, [{ itemId: L.burger, qty: 1, note: 'x'.repeat(2000) }])).status).toBe(400);
    });

    it('an item of another restaurant is not orderable from this menu', async () => {
      const otherCat = (await f.post(f.other.ownerToken, '/admin/catalog/categories', { name: `X ${f.RUN}`, sortOrder: 0 })).body.id as string;
      const foreign = (await f.post(f.other.ownerToken, '/admin/catalog/items', { categoryId: otherCat, name: 'Foreign', basePriceMinorUnits: 100, isAvailable: true })).body.id as string;
      const r = await f.order(qr, g, [{ itemId: foreign, qty: 1 }]);
      expect(r.status).toBe(400);
      expect(r.body.error.details.reason).toBe('ITEM_NOT_ON_MENU');
    });

    it('needs a valid guest token and an open table', async () => {
      const lines = [{ itemId: L.burger, qty: 1 }];
      expect((await f.pub.post(qr, '/orders', { lines }, { 'idempotency-key': uuid() })).status).toBe(401);
      expect((await f.order(qr, 'y'.repeat(43), lines)).status).toBe(401);
      const closed = await f.table('NOSEAT', { open: false });
      const cq = await f.qrToken(closed.tableId);
      const r = await f.pub.post(cq, '/orders', { lines }, { 'x-guest-token': g, 'idempotency-key': uuid() });
      expect(r.status).toBe(409);
      expect(r.body.error.code).toBe('TABLE_CLOSED');
    });

    it('the pending-order cap protects the waiter from a flood', async () => {
      const t = await f.table('CAP');
      const q = await f.qrToken(t.tableId);
      const gg = await f.guest(q);
      let blocked = 0;
      for (let i = 0; i < 12; i++) {
        const r = await f.order(q, gg, [{ itemId: L.tea, qty: 1 }]);
        if (r.status === 429) {
          blocked++;
          expect(r.body.error.details.reason).toBe('PENDING_ORDERS');
        } else expect(r.status).toBe(201);
      }
      expect(blocked).toBeGreaterThan(0);
    });

    it('state: a guest sees their own pending order; other devices do not; nothing identifies staff or other guests', async () => {
      const t = await f.table('STATE');
      const q = await f.qrToken(t.tableId);
      const g1 = await f.guest(q, 'Onetwo');
      const g2 = await f.guest(q, 'Threefour');
      const placed = await f.order(q, g1, [{ itemId: L.burger, qty: 3 }]);
      expect(placed.status).toBe(201);
      const s1 = await f.pub.get(q, '/state', g1);
      expect(s1.status).toBe(200);
      expect(s1.headers['cache-control']).toBe('no-store');
      expect(s1.body.orders).toHaveLength(1);
      expect(s1.body.orders[0]).toMatchObject({ id: placed.body.orderId, status: 'AWAITING_CONFIRMATION', mine: true, totalMinor: 3000 });
      expect(s1.body.orders[0].lines[0]).toMatchObject({ name: 'Burger', qty: 3, lineTotalMinor: 3000 });
      expect(s1.body.orders[0].timeline[0].status).toBe('AWAITING_CONFIRMATION');
      expect(s1.body.bill).toBeNull();
      const s2 = await f.pub.get(q, '/state', g2);
      expect(s2.body.orders).toHaveLength(0);
      expect(JSON.stringify(s1.body)).not.toMatch(/Onetwo|Threefour|Person|@test\.local|actor|userId/i);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('guest-order inbox (staff)', () => {
    let qr: string;
    let g: string;
    const place = async (lines: object[], key = uuid()) => {
      const r = await f.order(qr, g, lines, { key });
      expect(r.status).toBe(201);
      return r.body.orderId as string;
    };
    beforeAll(async () => {
      await setMode('confirm');
      const t = await f.table('INBOX');
      qr = await f.qrToken(t.tableId);
      g = await f.guest(qr, 'Ravi');
    });

    it('lists waiting orders for people with the permission only (waiter yes, kitchen no, other tenant sees none)', async () => {
      const id = await place([{ itemId: L.burger, qty: 1 }]);
      expect((await f.get(null, '/admin/guest-orders')).status).toBe(401);
      expect((await f.get(f.kitchenToken, '/admin/guest-orders')).status).toBe(403);
      expect((await f.get(f.hostToken, '/admin/guest-orders')).status).toBe(403);
      const list = await f.get(f.waiterToken, '/admin/guest-orders?status=AWAITING_CONFIRMATION');
      expect(list.status).toBe(200);
      const row = (list.body as { id: string; status: string; guestName: string; totalMinor: number; source: string; mode: string }[]).find((o) => o.id === id)!;
      expect(row).toMatchObject({ status: 'AWAITING_CONFIRMATION', guestName: 'Ravi', source: 'GUEST', mode: 'confirm', totalMinor: 1000 });
      const theirs = await f.get(f.other.ownerToken, '/admin/guest-orders');
      expect((theirs.body as { id: string }[]).some((o) => o.id === id)).toBe(false);
      expect((await f.get(f.waiterToken, '/admin/guest-orders?status=BOGUS')).status).toBe(400);
    });

    it('confirm makes it a normal sent order (numbered), is idempotent and cannot cross tenants', async () => {
      const id = await place([{ itemId: L.burger, qty: 2 }]);
      expect((await f.post(f.other.ownerToken, `/admin/guest-orders/${id}/confirm`)).status).toBe(404);
      expect((await f.post(f.kitchenToken, `/admin/guest-orders/${id}/confirm`)).status).toBe(403);
      const c1 = await f.post(f.waiterToken, `/admin/guest-orders/${id}/confirm`);
      expect(c1.status).toBe(200);
      expect(c1.body).toMatchObject({ status: 'CONFIRMED', requestStatus: 'SENT' });
      expect(c1.body.requestNumber).toBeTruthy();
      const c2 = await f.post(f.waiterToken, `/admin/guest-orders/${id}/confirm`);
      expect(c2.status).toBe(200);
      expect(c2.body.requestNumber).toBe(c1.body.requestNumber);
      const two = [await place([{ itemId: L.tea, qty: 1 }]), await place([{ itemId: L.tea, qty: 2 }])];
      const both = await Promise.all(two.flatMap((o) => [f.post(f.waiterToken, `/admin/guest-orders/${o}/confirm`), f.post(f.ownerToken, `/admin/guest-orders/${o}/confirm`)]));
      expect(both.every((r) => r.status === 200)).toBe(true);
      expect(new Set(both.map((r) => r.body.requestNumber)).size).toBe(2);
      const s = await f.pub.get(qr, '/state', g);
      expect(s.body.orders.find((o: { id: string }) => o.id === id).status).toBe('CONFIRMED');
    });

    it('reject records a reason, tells the guest, and blocks a later confirm', async () => {
      const id = await place([{ itemId: L.burger, qty: 1 }]);
      expect((await f.post(f.waiterToken, `/admin/guest-orders/${id}/reject`, {})).status).toBe(400);
      const r = await f.post(f.waiterToken, `/admin/guest-orders/${id}/reject`, { reason: 'Out of buns' });
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ status: 'REJECTED', rejectReason: 'Out of buns' });
      expect((await f.post(f.waiterToken, `/admin/guest-orders/${id}/reject`, { reason: 'again' })).status).toBe(200);
      const confirm = await f.post(f.waiterToken, `/admin/guest-orders/${id}/confirm`);
      expect(confirm.status).toBe(409);
      expect(confirm.body.error.details.reason).toBe('ALREADY_REJECTED');
      const s = await f.pub.get(qr, '/state', g);
      const mine = s.body.orders.find((o: { id: string }) => o.id === id);
      expect(mine).toMatchObject({ status: 'REJECTED', rejectReason: 'Out of buns' });
      expect(mine.totalMinor).toBe(1000); // the rejected total, not 0
      expect(mine.lines).toHaveLength(1);
      const adminRow = (await f.get(f.waiterToken, '/admin/guest-orders?status=REJECTED')).body.find((o: { id: string }) => o.id === id);
      expect(adminRow).toMatchObject({ status: 'REJECTED', totalMinor: 1000 });
    });

    it('a rejected order that was edited first reports what was refused (lines the waiter dropped stay out)', async () => {
      const id = await place([
        { itemId: L.burger, qty: 3 },
        { itemId: L.tea, qty: 2 },
      ]);
      const lines = ((await f.get(f.waiterToken, '/admin/guest-orders?status=AWAITING_CONFIRMATION')).body as { id: string; lines: { id: string; name: string }[] }[]).find((o) => o.id === id)!.lines;
      const tea = lines.find((l) => l.name === 'Masala Tea')!.id;
      expect((await f.post(f.waiterToken, `/admin/guest-orders/${id}/edit`, { lines: [{ id: tea, qty: 0 }] })).status).toBe(200);
      expect((await f.post(f.waiterToken, `/admin/guest-orders/${id}/reject`, { reason: 'Kitchen closed' })).status).toBe(200);
      const mine = (await f.pub.get(qr, '/state', g)).body.orders.find((o: { id: string }) => o.id === id);
      expect(mine).toMatchObject({ status: 'REJECTED', totalMinor: 3000 });
      expect(mine.lines.map((l: { name: string }) => l.name)).toEqual(['Burger']);
      expect(mine.lines.reduce((n: number, l: { lineTotalMinor: number }) => n + l.lineTotalMinor, 0)).toBe(mine.totalMinor);
    });

    it('edit changes quantities / removes lines / sets the note before confirmation, then locks', async () => {
      const id = await place([
        { itemId: L.burger, qty: 3 },
        { itemId: L.tea, qty: 2 },
      ]);
      const listed = (await f.get(f.waiterToken, '/admin/guest-orders?status=AWAITING_CONFIRMATION')).body as { id: string; lines: { id: string; name: string }[] }[];
      const lines = listed.find((o) => o.id === id)!.lines;
      const burgerLine = lines.find((l) => l.name === 'Burger')!.id;
      const teaLine = lines.find((l) => l.name === 'Masala Tea')!.id;
      expect((await f.post(f.waiterToken, `/admin/guest-orders/${id}/edit`, { lines: [{ id: uuid(), qty: 1 }] })).status).toBe(400);
      const e = await f.post(f.waiterToken, `/admin/guest-orders/${id}/edit`, { lines: [{ id: burgerLine, qty: 1 }, { id: teaLine, qty: 0 }], note: 'No onions' });
      expect(e.status).toBe(200);
      expect(e.body.totalMinor).toBe(1000);
      expect(e.body.note).toBe('No onions');
      const s = await f.pub.get(qr, '/state', g);
      expect(s.body.orders.find((o: { id: string }) => o.id === id)).toMatchObject({ edited: false, totalMinor: 1000 }); // pre-confirmation edits are not kitchen-visible, so not flagged
      const empty = await f.post(f.waiterToken, `/admin/guest-orders/${id}/edit`, { lines: [{ id: burgerLine, qty: 0 }] });
      expect(empty.status).toBe(400);
      expect(empty.body.error.details.reason).toBe('EMPTY_ORDER');
      expect((await f.post(f.waiterToken, `/admin/guest-orders/${id}/confirm`)).status).toBe(200);
      const late = await f.post(f.waiterToken, `/admin/guest-orders/${id}/edit`, { lines: [{ id: burgerLine, qty: 2 }] });
      expect(late.status).toBe(409);
      expect(late.body.error.details.reason).toBe('NOT_AWAITING_CONFIRMATION');
    });

    it('edit honours Idempotency-Key: a replay answers the original 200 even after the line was removed or the order confirmed', async () => {
      const id = await place([
        { itemId: L.burger, qty: 3 },
        { itemId: L.tea, qty: 2 },
      ]);
      const lines = ((await f.get(f.waiterToken, '/admin/guest-orders?status=AWAITING_CONFIRMATION')).body as { id: string; lines: { id: string; name: string }[] }[]).find((o) => o.id === id)!.lines;
      const burgerLine = lines.find((l) => l.name === 'Burger')!.id;
      const teaLine = lines.find((l) => l.name === 'Masala Tea')!.id;
      const edit = (key: string | null, body: object) => {
        const r = request(f.http()).post(`/admin/guest-orders/${id}/edit`).set('authorization', `Bearer ${f.waiterToken}`);
        return (key ? r.set('idempotency-key', key) : r).send(body);
      };
      const key = uuid();
      const body = { lines: [{ id: teaLine, qty: 0 }], note: 'No tea' };
      const first = await edit(key, body);
      expect(first.status).toBe(200);
      expect(first.body.totalMinor).toBe(3000);
      // The same request again: the tea line no longer exists, yet the answer is the original 200 (not 400 LINE_NOT_FOUND).
      const replay = await edit(key, body);
      expect(replay.status).toBe(200);
      expect(replay.body).toMatchObject({ id, totalMinor: 3000, note: 'No tea' });
      expect(replay.body.version).toBe(first.body.version); // nothing was applied twice
      // A different key for the same stale line is still validated.
      const stale = await edit(uuid(), body);
      expect(stale.status).toBe(400);
      expect(stale.body.error.details.reason).toBe('LINE_NOT_FOUND');
      // After confirmation the replay is still the original answer; a fresh key gets the usual lock.
      expect((await f.post(f.waiterToken, `/admin/guest-orders/${id}/confirm`)).status).toBe(200);
      const afterConfirm = await edit(key, body);
      expect(afterConfirm.status).toBe(200);
      expect(afterConfirm.body.status).toBe('CONFIRMED');
      expect((await edit(uuid(), { lines: [{ id: burgerLine, qty: 1 }] })).status).toBe(409);
      // Without a key the edit still works (a fresh key is generated).
      const id2 = await place([{ itemId: L.burger, qty: 2 }]);
      const l2 = ((await f.get(f.waiterToken, '/admin/guest-orders?status=AWAITING_CONFIRMATION')).body as { id: string; lines: { id: string }[] }[]).find((o) => o.id === id2)!.lines[0]!.id;
      expect((await f.post(f.waiterToken, `/admin/guest-orders/${id2}/edit`, { lines: [{ id: l2, qty: 1 }] })).status).toBe(200);
    });

    it('the running bill equals the invoice, ordering locks once a bill exists, UPI intent follows the final amount', async () => {
      const t = await f.table('BILL');
      const q = await f.qrToken(t.tableId);
      const gg = await f.guest(q);
      const o1 = await f.order(q, gg, [
        { itemId: L.burger, qty: 2 },
        { itemId: L.pizza, variantId: L.large, addOnOptionIds: [L.thick], qty: 1 },
      ]);
      expect(o1.status).toBe(201);
      expect((await f.post(f.waiterToken, `/admin/guest-orders/${o1.body.orderId}/confirm`)).status).toBe(200);

      const st = await f.pub.get(q, '/state', gg);
      // 2000 + 11500 = 13500; GST 5% per line: 100 + 575 = 675
      expect(st.body.bill).toMatchObject({ subtotalMinor: 13500, totalMinor: 14175, paidMinor: 0, dueMinor: 14175, status: 'RUNNING' });
      const taxLines = st.body.bill.taxLines as { amountMinor: number; label: string }[];
      expect(taxLines.reduce((s, l) => s + l.amountMinor, 0)).toBe(675);
      expect(taxLines.map((l) => l.label)).toEqual(['CGST', 'SGST']);

      expect((await f.pub.post(q, '/pay-intent', { method: 'upi' }, { 'x-guest-token': gg })).status).toBe(409);

      const inv = await f.post(f.ownerToken, `/admin/checkout/sessions/${t.sessionId}/invoice`, {});
      expect(inv.status).toBe(201);
      expect(inv.body.grandTotalMinorUnits).toBe(st.body.bill.totalMinor);
      expect(inv.body.subtotalMinorUnits).toBe(st.body.bill.subtotalMinor);

      const locked = await f.order(q, gg, [{ itemId: L.tea, qty: 1 }]);
      expect(locked.status).toBe(409);
      expect(locked.body.error.code).toBe('ORDERING_LOCKED');

      const off = await f.pub.post(q, '/pay-intent', { method: 'upi' }, { 'x-guest-token': gg });
      expect(off.status).toBe(409);
      expect(off.body.error.code).toBe('UPI_UNAVAILABLE');
      expect((await f.patch(f.ownerToken, '/admin/qr/settings', { upi: true })).status).toBe(200);
      const noVpa = await f.pub.post(q, '/pay-intent', { method: 'upi' }, { 'x-guest-token': gg });
      expect(noVpa.body.error.code).toBe('UPI_UNAVAILABLE');
      expect((await f.put(f.ownerToken, '/admin/settings/checkout/upi_vpa', { value: 'riverside@okhdfcbank' })).status).toBe(200);
      expect((await f.put(f.ownerToken, '/admin/settings/checkout/upi_payee_name', { value: 'Riverside Kitchen' })).status).toBe(200);
      expect((await f.pub.get(q)).body.settings.payment.upi).toBe(true);

      const notFinal = await f.pub.post(q, '/pay-intent', { method: 'upi' }, { 'x-guest-token': gg });
      expect(notFinal.status).toBe(409);
      expect(notFinal.body.error.code).toBe('BILL_NOT_READY');
      expect((await f.post(f.ownerToken, `/admin/checkout/invoices/${inv.body.id}/finalise`, {})).status).toBe(201);

      const fin = await f.pub.get(q, '/state', gg);
      expect(fin.body.bill).toMatchObject({ totalMinor: inv.body.grandTotalMinorUnits, dueMinor: inv.body.grandTotalMinorUnits, status: 'FINAL' });
      expect(fin.body.bill.reference).toBeTruthy();

      const pay = await f.pub.post(q, '/pay-intent', { method: 'upi' }, { 'x-guest-token': gg });
      expect(pay.status).toBe(200);
      expect(pay.headers['cache-control']).toBe('no-store');
      expect(pay.body.amountMinor).toBe(inv.body.grandTotalMinorUnits);
      const u = new URL(pay.body.upiUri);
      expect(u.protocol).toBe('upi:');
      expect(u.searchParams.get('pa')).toBe('riverside@okhdfcbank');
      expect(u.searchParams.get('pn')).toBe('Riverside Kitchen');
      expect(u.searchParams.get('am')).toBe('141.75');
      expect(u.searchParams.get('cu')).toBe('INR');
      expect(pay.body.qrPayload).toBe(pay.body.upiUri);
      expect(pay.body.reference).toBeTruthy();
      expect((await f.pub.post(q, '/pay-intent', { method: 'card' }, { 'x-guest-token': gg })).status).toBe(400);
      expect((await f.pub.post(q, '/pay-intent', { method: 'upi' })).status).toBe(401);
      await f.patch(f.ownerToken, '/admin/qr/settings', { upi: false });
    });

    it('auto mode: the order goes straight to the kitchen queue (numbered), nothing waits for the waiter', async () => {
      await setMode('auto');
      try {
        const t = await f.table('AUTO');
        const q = await f.qrToken(t.tableId);
        const gg = await f.guest(q);
        const r = await f.order(q, gg, [{ itemId: L.burger, qty: 1 }]);
        expect(r.status).toBe(201);
        expect(r.body.status).toBe('CONFIRMED');
        const mine = (await f.get(f.waiterToken, '/admin/guest-orders?status=CONFIRMED')).body as { id: string; mode: string; requestNumber: string | null; decision: string }[];
        const row = mine.find((o) => o.id === r.body.orderId)!;
        expect(row).toMatchObject({ mode: 'auto', decision: 'AUTO_CONFIRMED' });
        expect(row.requestNumber).toBeTruthy();
        const waiting = (await f.get(f.waiterToken, '/admin/guest-orders?status=AWAITING_CONFIRMATION')).body as { id: string }[];
        expect(waiting.some((o) => o.id === r.body.orderId)).toBe(false);
        expect((await f.pub.get(q, '/state', gg)).body.bill).toMatchObject({ subtotalMinor: 1000, status: 'RUNNING' });
      } finally {
        await setMode('confirm');
      }
    });

    it('restaurant-wide "off" refuses orders but keeps the menu and the waiter call', async () => {
      await setMode('off');
      try {
        const t = await f.table('OFF');
        const q = await f.qrToken(t.tableId);
        const gg = await f.guest(q);
        expect((await f.pub.get(q)).body.settings.ordering).toBe('off');
        const r = await f.order(q, gg, [{ itemId: L.burger, qty: 1 }]);
        expect(r.status).toBe(403);
        expect(r.body.error.code).toBe('ORDERING_OFF');
        expect((await f.pub.post(q, '/waiter', { reason: 'call' }, { 'x-guest-token': gg })).status).toBe(202);
      } finally {
        await setMode('confirm');
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('waiter calls', () => {
    it('creates one open call per reason (idempotent), lists it for staff, acknowledges it, and works before the table is opened', async () => {
      const t = await f.table('CALL');
      const q = await f.qrToken(t.tableId);
      const gg = await f.guest(q);
      const a = await f.pub.post(q, '/waiter', { reason: 'bill' }, { 'x-guest-token': gg });
      expect(a.status).toBe(202);
      expect(a.body).toMatchObject({ open: true, reason: 'bill' });
      const b = await f.pub.post(q, '/waiter', { reason: 'bill' }, { 'x-guest-token': gg });
      expect(b.status).toBe(202);
      expect(b.body.at).toBe(a.body.at);
      expect((await f.pub.post(q, '/waiter', { reason: 'dance' }, { 'x-guest-token': gg })).status).toBe(400);
      expect((await f.pub.get(q, '/state', gg)).body.waiterCall).toMatchObject({ open: true, reason: 'bill' });

      const tables = (await f.get(f.ownerToken, '/admin/qr/tables')).body as { tableId: string; waiterCall: { open: boolean; reason: string } | null }[];
      expect(tables.find((x) => x.tableId === t.tableId)!.waiterCall).toMatchObject({ open: true, reason: 'bill' });
      const alerts = await f.get(f.waiterToken, '/admin/guest-orders/alerts');
      expect(alerts.status).toBe(200);
      expect((alerts.body as { tableId: string; reason: string; tableCode: string }[]).find((x) => x.tableId === t.tableId)).toMatchObject({ reason: 'bill', tableCode: t.code });
      expect((await f.get(f.other.ownerToken, '/admin/guest-orders/alerts')).body).toEqual([]);

      expect((await f.post(f.other.ownerToken, `/admin/guest-orders/alerts/${t.tableId}/ack`)).status).toBe(404);
      expect((await f.post(f.kitchenToken, `/admin/guest-orders/alerts/${t.tableId}/ack`)).status).toBe(403);
      expect((await f.post(f.waiterToken, `/admin/guest-orders/alerts/${t.tableId}/ack`)).status).toBe(204);
      expect((await f.post(f.waiterToken, `/admin/guest-orders/alerts/${t.tableId}/ack`)).status).toBe(204);
      expect((await f.pub.get(q, '/state', gg)).body.waiterCall).toEqual({ open: false });

      const idle = await f.table('CALL2', { open: false });
      const anon = await f.pub.post(await f.qrToken(idle.tableId), '/waiter', { reason: 'call' });
      expect(anon.status).toBe(202);
    });

    it('can be switched off by the restaurant', async () => {
      expect((await f.patch(f.ownerToken, '/admin/qr/settings', { callWaiter: false })).status).toBe(200);
      try {
        const t = await f.table('NOCALL');
        const q = await f.qrToken(t.tableId);
        expect((await f.pub.get(q)).body.settings.callWaiter).toBe(false);
        expect((await f.pub.post(q, '/waiter', { reason: 'call' })).status).toBe(403);
      } finally {
        await f.patch(f.ownerToken, '/admin/qr/settings', { callWaiter: true });
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  describe('privacy and security', () => {
    it('public responses never contain internal ids, staff, emails or other tables', async () => {
      const t = await f.table('PRIV');
      const other = await f.table('PRIV2');
      const q = await f.qrToken(t.tableId);
      const oq = await f.qrToken(other.tableId);
      const gg = await f.guest(q, 'Zed');
      const placed = await f.order(q, gg, [{ itemId: L.burger, qty: 1 }]);
      expect(placed.status).toBe(201);
      const bodies = [
        JSON.stringify((await f.pub.get(q)).body),
        JSON.stringify((await f.pub.get(q, '/state', gg)).body),
        JSON.stringify(placed.body),
        JSON.stringify((await f.pub.post(q, '/waiter', { reason: 'call' }, { 'x-guest-token': gg })).body),
      ];
      for (const b of bodies) {
        expect(b).not.toContain(f.bizId);
        expect(b).not.toContain(f.locId);
        expect(b).not.toContain(oq);
        expect(b).not.toContain(other.code);
        expect(b).not.toMatch(/@test\.local|passwordHash|sessionId|businessId|locationId|diningTableId|guestTokenId/);
      }
      expect(bodies[1]).not.toContain(gg);
    });

    it('errors are JSON and never echo a token', async () => {
      const t = await f.table('HDR');
      const q = await f.qrToken(t.tableId);
      const gg = await f.guest(q);
      const wrong = await f.pub.get(q, '/state', 'z'.repeat(43));
      expect(wrong.status).toBe(401);
      expect(JSON.stringify(wrong.body)).not.toContain('z'.repeat(43));
      const nf = await f.pub.get('B'.repeat(32), '/state', gg);
      expect(nf.status).toBe(404);
      expect(JSON.stringify(nf.body)).not.toContain('B'.repeat(32));
    });

    it('the public menu cannot be written to or traversed', async () => {
      const t = await f.table('WR');
      const q = await f.qrToken(t.tableId);
      expect((await f.post(null, `/public/menu/${q}`, {})).status).toBe(404);
      expect((await f.patch('x', `/public/menu/${q}`, {})).status).toBeGreaterThanOrEqual(400);
      expect((await f.get(null, `/public/menu/${q}/..%2F..%2Fadmin/qr/tables`)).status).toBeGreaterThanOrEqual(400);
    });
  });
});
