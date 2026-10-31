import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { bootstrap, relaxLimits, uuid, type Fixture } from './guestmenu-harness';

relaxLimits();
process.env.GUESTMENU_LIMIT_STREAM_CONCURRENT_TOKEN = '3';
process.env.GUESTMENU_HUB_DEBOUNCE_MS = '40';
jest.setTimeout(240_000);

type Data = Record<string, unknown>;
interface SseEvent {
  event: string;
  data: Data;
}
interface Stream {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
  events: SseEvent[];
  raw: () => string;
  /** Waits for an event (after the first `from` events) matching `pred`. */
  waitFor: (name: string, pred?: (d: Data) => boolean, from?: number, ms?: number) => Promise<Data>;
  mark: () => number;
  ended: () => boolean;
  close: () => void;
}

/** A minimal EventSource: opens the stream on the real listening server and parses `event:`/`data:` frames. */
function openStream(port: number, token: string): Promise<Stream> {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: `/public/menu/${token}/stream`, headers: { accept: 'text/event-stream' } }, (res) => {
      const events: SseEvent[] = [];
      let buf = '';
      let all = '';
      let ended = false;
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        all += chunk;
        if (res.statusCode !== 200) return;
        buf += chunk;
        let i: number;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const frame = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const ev = /^event: (.+)$/m.exec(frame)?.[1];
          const data = /^data: (.+)$/m.exec(frame)?.[1];
          if (ev) events.push({ event: ev, data: data ? (JSON.parse(data) as Data) : {} });
        }
      });
      res.on('end', () => (ended = true));
      res.on('close', () => (ended = true));
      const s: Stream = {
        status: res.statusCode ?? 0,
        headers: res.headers,
        body: '',
        events,
        raw: () => all,
        mark: () => events.length,
        ended: () => ended,
        close: () => req.destroy(),
        waitFor: (name, pred, from = 0, ms = 6000) =>
          new Promise((ok, fail) => {
            const t0 = Date.now();
            const tick = setInterval(() => {
              const hit = events.slice(from).find((e) => e.event === name && (!pred || pred(e.data)));
              if (hit) {
                clearInterval(tick);
                ok(hit.data);
              } else if (Date.now() - t0 > ms) {
                clearInterval(tick);
                fail(new Error(`no "${name}" event within ${ms} ms; got ${JSON.stringify(events.slice(from))}`));
              }
            }, 25);
          }),
      };
      if (res.statusCode !== 200) {
        res.on('end', () => {
          s.body = all;
          resolve(s);
        });
      } else resolve(s);
    });
    req.on('error', reject);
  });
}

/** QR digital menu: live updates over SSE (ADR-035 / ADR-032). */
describe('QR digital menu live stream (e2e)', () => {
  let f: Fixture;
  let port: number;
  const open: Stream[] = [];
  const stream = async (token: string) => {
    const s = await openStream(port, token);
    open.push(s);
    return s;
  };

  beforeAll(async () => {
    f = await bootstrap('gs');
    await f.app.listen(0, '127.0.0.1');
    port = (f.app.getHttpServer().address() as AddressInfo).port;
  });
  afterAll(async () => {
    for (const s of open) s.close();
    await f.close();
  });

  it('opens a text/event-stream with a hello event, retry hint and no caching', async () => {
    const t = await f.table('S1');
    const s = await stream(await f.qrToken(t.tableId));
    expect(s.status).toBe(200);
    expect(s.headers['content-type']).toMatch(/^text\/event-stream/);
    expect(s.headers['cache-control']).toMatch(/no-cache/);
    expect(s.headers['x-accel-buffering']).toBe('no');
    const hello = await s.waitFor('hello');
    expect(hello.heartbeatSeconds).toBeGreaterThan(0);
    expect(s.raw()).toContain('retry: ');
  });

  it('refuses an unknown token with a JSON 404 (not a stream) and disabled tables with 403', async () => {
    const miss = await stream('Q'.repeat(32));
    expect(miss.status).toBe(404);
    expect(miss.headers['content-type']).toMatch(/json/);
    const t = await f.table('S2');
    const qr = await f.qrToken(t.tableId);
    expect((await f.patch(f.ownerToken, `/admin/qr/tables/${t.tableId}`, { enabled: false })).status).toBe(200);
    const off = await stream(qr);
    expect(off.status).toBe(403);
  });

  it('pushes menu.changed after a catalog edit (price) with the new ETag', async () => {
    const t = await f.table('S3');
    const qr = await f.qrToken(t.tableId);
    const s = await stream(qr);
    await s.waitFor('hello');
    await new Promise((r) => setTimeout(r, 300)); // let the hub take its baseline snapshot
    const from = s.mark();
    expect((await f.patch(f.ownerToken, `/admin/catalog/items/${f.ids.burger}`, { basePriceMinorUnits: 1100 })).status).toBe(200);
    const ev = await s.waitFor('menu.changed', undefined, from);
    const fresh = await f.pub.get(qr);
    expect(ev.etag).toBe(fresh.body.etag);
    expect((fresh.body.items as { id: string; priceMinor: number }[]).find((i) => i.id === f.ids.burger)!.priceMinor).toBe(1100);
    expect((await f.patch(f.ownerToken, `/admin/catalog/items/${f.ids.burger}`, { basePriceMinorUnits: 1000 })).status).toBe(200);
  });

  it('pushes menu.changed for sold-out toggles and QR settings (tagline) too', async () => {
    const t = await f.table('S4');
    const qr = await f.qrToken(t.tableId);
    const s = await stream(qr);
    await s.waitFor('hello');
    await new Promise((r) => setTimeout(r, 300));
    let from = s.mark();
    expect((await f.patch(f.ownerToken, `/admin/catalog/items/${f.ids.tea}`, { isAvailable: false })).status).toBe(200);
    await s.waitFor('menu.changed', undefined, from);
    expect((await f.pub.get(qr)).body.items.find((i: { id: string; soldOut: boolean }) => i.id === f.ids.tea).soldOut).toBe(true);
    from = s.mark();
    expect((await f.patch(f.ownerToken, '/admin/qr/settings', { tagline: `Live ${f.RUN}` })).status).toBe(200);
    await s.waitFor('menu.changed', undefined, from);
    expect((await f.patch(f.ownerToken, `/admin/catalog/items/${f.ids.tea}`, { isAvailable: true })).status).toBe(200);
  });

  it('pushes order.updated through confirm, table.updated on close/open, bill.updated and waiter.ack - hints only, never names or amounts', async () => {
    const t = await f.table('S5');
    const qr = await f.qrToken(t.tableId);
    const g = await f.guest(qr, 'Privacy Pat');
    const s = await stream(qr);
    await s.waitFor('hello');
    await new Promise((r) => setTimeout(r, 300));

    let from = s.mark();
    const placed = await f.order(qr, g, [{ itemId: f.ids.burger, qty: 2 }]);
    expect(placed.status).toBe(201);
    await s.waitFor('order.updated', (d) => d.orderId === placed.body.orderId && d.status === 'AWAITING_CONFIRMATION', from);

    from = s.mark();
    expect((await f.post(f.waiterToken, `/admin/guest-orders/${placed.body.orderId}/confirm`)).status).toBe(200);
    await s.waitFor('order.updated', (d) => d.orderId === placed.body.orderId && d.status === 'CONFIRMED', from);
    await s.waitFor('bill.updated', undefined, from);

    from = s.mark();
    expect((await f.pub.post(qr, '/waiter', { reason: 'call' }, { 'x-guest-token': g })).status).toBe(202);
    await new Promise((r) => setTimeout(r, 400)); // the hub must see the call open before it can see it acknowledged
    expect((await f.post(f.waiterToken, `/admin/guest-orders/alerts/${t.tableId}/ack`)).status).toBe(204);
    await s.waitFor('waiter.ack', undefined, from);

    from = s.mark();
    expect((await f.post(f.ownerToken, `/admin/sessions/${t.sessionId}/close`, {})).status).toBeLessThan(300);
    await s.waitFor('table.updated', (d) => d.open === false, from);

    const wire = JSON.stringify(s.events);
    expect(wire).not.toMatch(/Burger|Privacy Pat|Person|@test\.local|guestToken/);
    expect(wire).not.toContain(g);
    expect(wire).not.toContain(f.bizId);
  });

  it('caps concurrent streams per table token and frees a slot when one closes', async () => {
    const t = await f.table('S6');
    const qr = await f.qrToken(t.tableId);
    const a = await stream(qr);
    const b = await stream(qr);
    const c = await stream(qr);
    expect([a.status, b.status, c.status]).toEqual([200, 200, 200]);
    const d = await stream(qr);
    expect(d.status).toBe(429);
    expect(d.headers['retry-after']).toBeTruthy();
    expect(JSON.parse(d.body).error.code).toBe('RATE_LIMITED');
    a.close();
    await new Promise((r) => setTimeout(r, 300));
    const e = await stream(qr);
    expect(e.status).toBe(200);
  });

  it('rotating the QR ends open streams with a goodbye, and the old link no longer opens one', async () => {
    const t = await f.table('S7');
    const qr = await f.qrToken(t.tableId);
    const s = await stream(qr);
    await s.waitFor('hello');
    await new Promise((r) => setTimeout(r, 300));
    const from = s.mark();
    expect((await f.post(f.ownerToken, `/admin/qr/tables/${t.tableId}/rotate`, {})).status).toBe(200);
    await s.waitFor('bye', undefined, from);
    await new Promise((r) => setTimeout(r, 200));
    expect(s.ended()).toBe(true);
    expect((await stream(qr)).status).toBe(404);
  });

  it('a stream in one restaurant never receives events of another', async () => {
    const t = await f.table('S8');
    const s = await stream(await f.qrToken(t.tableId));
    await s.waitFor('hello');
    await new Promise((r) => setTimeout(r, 300));
    const from = s.mark();
    const cat = (await f.post(f.other.ownerToken, '/admin/catalog/categories', { name: `Other ${uuid().slice(0, 6)}`, sortOrder: 1 })).body.id as string;
    expect((await f.post(f.other.ownerToken, '/admin/catalog/items', { categoryId: cat, name: 'Elsewhere', basePriceMinorUnits: 100, isAvailable: true })).status).toBe(201);
    await new Promise((r) => setTimeout(r, 600));
    expect(s.events.slice(from)).toEqual([]);
  });
});
