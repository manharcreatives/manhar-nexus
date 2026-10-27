import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';
import { RealtimeBus } from '../src/realtime/realtime.bus';

jest.setTimeout(120_000);

/**
 * Realtime SSE stream (ADR-032). Uses a real listening server and node:http so
 * the actual wire format, headers and socket teardown are exercised.
 */

interface SseEvent {
  event: string;
  data: string;
}

class SseClient {
  readonly events: SseEvent[] = [];
  readonly raw: string[] = [];
  status = 0;
  headers: http.IncomingHttpHeaders = {};
  ended = false;
  private buf = '';
  private req!: http.ClientRequest;
  private waiters: Array<() => void> = [];

  static open(baseUrl: string, path: string, token: string): Promise<SseClient> {
    const c = new SseClient();
    return new Promise((resolve, reject) => {
      c.req = http.get(baseUrl + path, { headers: { authorization: `Bearer ${token}` } }, (res) => {
        c.status = res.statusCode ?? 0;
        c.headers = res.headers;
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => c.onChunk(chunk));
        res.on('end', () => {
          c.ended = true;
          c.notify();
        });
        res.on('close', () => {
          c.ended = true;
          c.notify();
        });
        if (c.status !== 200) {
          res.on('end', () => resolve(c));
          return;
        }
        // Resolve once the hello frame is in.
        c.waitFor((e) => e.event === 'hello', 3000).then(() => resolve(c), reject);
      });
      c.req.on('error', (e) => {
        if (!c.ended) reject(e);
      });
    });
  }

  private onChunk(chunk: string): void {
    this.buf += chunk;
    let idx: number;
    while ((idx = this.buf.indexOf('\n\n')) >= 0) {
      const frame = this.buf.slice(0, idx);
      this.buf = this.buf.slice(idx + 2);
      this.raw.push(frame);
      const lines = frame.split('\n');
      if (lines.every((l) => l.startsWith(':'))) continue; // comment / heartbeat
      const event = lines.find((l) => l.startsWith('event: '))?.slice(7) ?? 'message';
      const data = lines.find((l) => l.startsWith('data: '))?.slice(6) ?? '';
      this.events.push({ event, data });
    }
    this.notify();
  }

  private notify(): void {
    const w = this.waiters;
    this.waiters = [];
    w.forEach((f) => f());
  }

  changes(): Array<{ topic: string; locationId: string | null }> {
    return this.events.filter((e) => e.event === 'change').map((e) => JSON.parse(e.data));
  }

  topics(): string[] {
    return this.changes().map((c) => c.topic);
  }

  async waitFor(pred: (e: SseEvent) => boolean, timeoutMs = 2000): Promise<SseEvent> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const hit = this.events.find(pred);
      if (hit) return hit;
      const left = deadline - Date.now();
      if (left <= 0) throw new Error(`SSE timeout; saw ${JSON.stringify(this.events)}`);
      await new Promise<void>((r) => {
        const t = setTimeout(r, left);
        this.waiters.push(() => {
          clearTimeout(t);
          r();
        });
      });
    }
  }

  waitTopic(topic: string, timeoutMs = 2000): Promise<SseEvent> {
    return this.waitFor((e) => e.event === 'change' && JSON.parse(e.data).topic === topic, timeoutMs);
  }

  async waitEnd(timeoutMs = 4000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!this.ended) {
      if (Date.now() > deadline) throw new Error('stream did not end');
      await new Promise<void>((r) => {
        const t = setTimeout(r, 50);
        this.waiters.push(() => {
          clearTimeout(t);
          r();
        });
      });
    }
  }

  close(): void {
    this.req.destroy();
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Realtime SSE stream (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let bus: RealtimeBus;
  let platformToken: string;

  let bizAId: string;
  let bizBId: string;
  let locA1: string;
  let locA2: string;
  let ownerA: string;
  let ownerB: string;
  let scopedA1: string; // location-manager restricted to locA1
  let tableA1: string;
  let tableA2: string;
  let itemId: string;

  const RUN = Date.now().toString(36);
  const PW = 'Test!Password1';
  const clients: SseClient[] = [];
  const open = async (path: string, token: string): Promise<SseClient> => {
    const c = await SseClient.open(baseUrl, path, token);
    clients.push(c);
    return c;
  };
  const srv = () => app.getHttpServer();
  const post = (tok: string, path: string, body: object = {}) =>
    request(srv()).post(path).set('authorization', `Bearer ${tok}`).send(body);
  const uuid = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  const login = async (email: string, password = PW): Promise<string> => {
    const r = await request(srv()).post('/auth/login').send({ email, password });
    expect(r.status).toBe(200);
    return r.body.accessToken as string;
  };
  const activate = async (bizId: string, key: string) => {
    const a = await post(platformToken, `/internal/businesses/${bizId}/modules/${key}/activate`);
    expect([201, 409]).toContain(a.status);
    const s = await post(platformToken, `/internal/businesses/${bizId}/modules/${key}/complete-setup`);
    expect([200, 201]).toContain(s.status);
  };
  const provisionOwner = async (bizId: string, tag: string): Promise<string> => {
    const email = `rt-owner-${tag}-${RUN}@test.local`;
    const r = await post(platformToken, `/internal/businesses/${bizId}/provision`, {
      email,
      displayName: `Owner ${tag}`,
      password: PW,
    });
    expect(r.status).toBe(201);
    return login(email);
  };
  const makeTable = async (locationId: string, areaId: string, code: string): Promise<string> => {
    const r = await post(ownerA, '/admin/dining/tables', {
      diningAreaId: areaId,
      locationId,
      code: `${code}-${RUN}`,
      capacity: 4,
      isActive: true,
    });
    expect(r.status).toBe(201);
    return r.body.id as string;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    applyHttpDefaults(app);
    await app.init();
    await app.listen(0);
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    bus = app.get(RealtimeBus);

    platformToken = (
      await request(srv())
        .post('/auth/login')
        .send({
          email: process.env.PLATFORM_BOOTSTRAP_EMAIL ?? 'platform@manhar.local',
          password: process.env.PLATFORM_BOOTSTRAP_PASSWORD ?? 'ChangeMe!Dev12345',
        })
    ).body.accessToken as string;

    const mk = async (name: string) => {
      const b = await post(platformToken, '/internal/businesses', { name, businessTypeKey: 'restaurant' });
      expect(b.status).toBe(201);
      return b.body.id as string;
    };
    bizAId = await mk(`RT BizA ${RUN}`);
    bizBId = await mk(`RT BizB ${RUN}`);
    for (const key of ['restaurant', 'catalog', 'checkout']) await activate(bizAId, key);

    const l1 = await post(platformToken, `/internal/businesses/${bizAId}/locations`, { name: `L1 ${RUN}`, timezone: 'Asia/Kolkata' });
    const l2 = await post(platformToken, `/internal/businesses/${bizAId}/locations`, { name: `L2 ${RUN}`, timezone: 'Asia/Kolkata' });
    expect(l1.status).toBe(201);
    expect(l2.status).toBe(201);
    locA1 = l1.body.id as string;
    locA2 = l2.body.id as string;

    ownerA = await provisionOwner(bizAId, 'A');
    ownerB = await provisionOwner(bizBId, 'B');

    // Location-restricted user (location-manager limited to L1).
    const email = `rt-lm-${RUN}@test.local`;
    const cu = await post(ownerA, '/admin/users', { email, password: PW, displayName: 'lm', roleKeys: ['location-manager'] });
    expect(cu.status).toBe(201);
    const users = await request(srv()).get('/admin/users').set('authorization', `Bearer ${ownerA}`);
    const lmId = users.body.find((u: { email: string }) => u.email === email).id as string;
    const roles = await request(srv()).get('/admin/roles').set('authorization', `Bearer ${ownerA}`);
    const lmRole = roles.body.find((r: { key: string }) => r.key === 'location-manager').id as string;
    const assign = await post(ownerA, `/admin/users/${lmId}/roles`, { roleId: lmRole, allLocations: false, locationIds: [locA1] });
    expect(assign.status).toBe(204);
    scopedA1 = await login(email);

    // Catalog + dining
    const tax = await post(ownerA, '/admin/catalog/tax-categories', { name: `GST ${RUN}`, rate: 0.05, isActive: true });
    const cat = await post(ownerA, '/admin/catalog/categories', { name: `Food ${RUN}`, isActive: true, sortOrder: 0 });
    const item = await post(ownerA, '/admin/catalog/items', {
      name: `Dish ${RUN}`,
      categoryId: cat.body.id,
      taxCategoryId: tax.body.id,
      basePriceMinorUnits: 10000,
      isActive: true,
      isAvailable: true,
      sortOrder: 0,
    });
    expect(item.status).toBe(201);
    itemId = item.body.id as string;
    const a1 = await post(ownerA, '/admin/dining/areas', { locationId: locA1, name: `Hall1 ${RUN}`, isActive: true, sortOrder: 0 });
    const a2 = await post(ownerA, '/admin/dining/areas', { locationId: locA2, name: `Hall2 ${RUN}`, isActive: true, sortOrder: 0 });
    tableA1 = await makeTable(locA1, a1.body.id as string, 'T1');
    tableA2 = await makeTable(locA2, a2.body.id as string, 'T2');
  }, 120_000);

  afterAll(async () => {
    clients.forEach((c) => c.close());
    await sleep(100);
    await app.close();
  });

  describe('auth and handshake', () => {
    it('401 without a token', async () => {
      const res = await request(srv()).get('/admin/realtime/stream');
      expect(res.status).toBe(401);
    });

    it('platform realm is refused with 403', async () => {
      const c = await open('/admin/realtime/stream', platformToken);
      expect(c.status).toBe(403);
    });

    it('rejects a malformed or foreign locationId', async () => {
      expect((await open('/admin/realtime/stream?locationId=nope', ownerA)).status).toBe(400);
      expect((await open(`/admin/realtime/stream?locationId=${uuid()}`, ownerA)).status).toBe(404);
      // Scoped user may not subscribe to a location outside their scope.
      expect((await open(`/admin/realtime/stream?locationId=${locA2}`, scopedA1)).status).toBe(403);
    });

    it('sends proper SSE headers and a hello frame first', async () => {
      const c = await open('/admin/realtime/stream', ownerA);
      expect(c.status).toBe(200);
      expect(c.headers['content-type']).toContain('text/event-stream');
      expect(c.headers['cache-control']).toBe('no-cache, no-transform');
      expect(c.headers['x-accel-buffering']).toBe('no');
      expect(c.headers['connection']).toBe('keep-alive');
      expect(c.events[0]?.event).toBe('hello');
      const hello = JSON.parse(c.events[0]!.data);
      expect(hello.heartbeatSeconds).toBe(20);
      expect(Number.isNaN(Date.parse(hello.serverTime))).toBe(false);
      c.close();
    });
  });

  describe('change events, tenancy and location scoping', () => {
    let aAll: SseClient;
    let aL2: SseClient;
    let aScoped: SseClient;
    let bAll: SseClient;
    let sessionId: string;
    let orderId: string;
    let invoiceId: string;

    beforeAll(async () => {
      aAll = await open('/admin/realtime/stream', ownerA);
      aL2 = await open(`/admin/realtime/stream?locationId=${locA2}`, ownerA);
      aScoped = await open('/admin/realtime/stream', scopedA1);
      bAll = await open('/admin/realtime/stream', ownerB);
    });

    it('opening a session emits sessions+tables to same-location subscribers only', async () => {
      const r = await post(ownerA, '/admin/sessions', { locationId: locA1, diningTableId: tableA1, partySize: 2 });
      expect(r.status).toBe(201);
      sessionId = r.body.id as string;
      const ev = await aAll.waitTopic('sessions');
      expect(JSON.parse(ev.data)).toMatchObject({ topic: 'sessions', locationId: locA1 });
      await aAll.waitTopic('tables');
      await aScoped.waitTopic('sessions');
      await sleep(250);
      expect(aL2.changes()).toHaveLength(0); // stream pinned to the other location
      expect(bAll.changes()).toHaveLength(0); // other tenant
    });

    it('sending an order emits orders and kitchen', async () => {
      const d = await post(ownerA, '/admin/orders', {
        sessionId,
        idempotencyKey: uuid(),
        lines: [{ catalogItemId: itemId, quantity: 1, modifiers: [] }],
      });
      expect(d.status).toBe(201);
      orderId = d.body.id as string;
      await aAll.waitTopic('orders');
      const before = aAll.topics().filter((t) => t === 'kitchen').length;
      const s = await post(ownerA, `/admin/orders/${orderId}/send`);
      expect(s.status).toBe(201);
      await aScoped.waitFor(() => aScoped.topics().includes('kitchen'));
      expect(aAll.topics().filter((t) => t === 'kitchen').length).toBeGreaterThan(before);
    });

    it('kitchen advance emits kitchen', async () => {
      const n = aAll.topics().filter((t) => t === 'kitchen').length;
      const r = await post(ownerA, `/admin/kitchen/${orderId}/accept`);
      expect(r.status).toBe(201);
      await aAll.waitFor(() => aAll.topics().filter((t) => t === 'kitchen').length > n);
    });

    it('a failed mutation emits nothing', async () => {
      const n = aAll.changes().length;
      const r = await post(ownerA, `/admin/orders/${orderId}/send`); // already SENT
      expect(r.status).toBeGreaterThanOrEqual(400);
      await sleep(250);
      expect(aAll.changes().length).toBe(n);
    });

    it('invoice then payment emits invoices and payments', async () => {
      await post(ownerA, `/admin/kitchen/${orderId}/prepare`);
      await post(ownerA, `/admin/kitchen/${orderId}/ready`);
      await post(ownerA, `/admin/orders/${orderId}/serve`);
      const inv = await post(ownerA, `/admin/checkout/sessions/${sessionId}/invoice`);
      expect(inv.status).toBe(201);
      invoiceId = inv.body.id as string;
      await aAll.waitTopic('invoices');
      const fin = await post(ownerA, `/admin/checkout/invoices/${invoiceId}/finalise`);
      expect([200, 201]).toContain(fin.status);
      const n = aAll.topics().filter((t) => t === 'payments').length;
      const pay = await post(ownerA, `/admin/checkout/invoices/${invoiceId}/payments`, {
        method: 'CASH',
        amountMinorUnits: 10500,
        cashReceivedMinorUnits: 10500,
        idempotencyKey: uuid(),
      });
      expect([200, 201]).toContain(pay.status);
      await aAll.waitFor(() => aAll.topics().filter((t) => t === 'payments').length > n);
      await aScoped.waitTopic('payments');
      expect(bAll.changes()).toHaveLength(0);
    });

    it('closing the session and resetting the table emit tables', async () => {
      const count = (c: SseClient) => c.topics().filter((t) => t === 'tables').length;
      const n = count(aAll);
      const close = await post(ownerA, `/admin/sessions/${sessionId}/close`);
      expect(close.status).toBe(201);
      const reset = await post(ownerA, `/admin/dining/tables/${tableA1}/reset`);
      expect(reset.status).toBe(204);
      // close emits one tables event, reset another: both subscribers must see both.
      await aAll.waitFor(() => count(aAll) >= n + 2);
      await aScoped.waitFor(() => count(aScoped) >= n + 2);
    });

    it('location scoping: events for L2 reach L2 stream and owner, not the L1-scoped user', async () => {
      const scopedBefore = aScoped.changes().length;
      const r = await post(ownerA, '/admin/sessions', { locationId: locA2, diningTableId: tableA2, partySize: 2 });
      expect(r.status).toBe(201);
      await aL2.waitTopic('sessions');
      expect(JSON.parse((await aL2.waitTopic('sessions')).data).locationId).toBe(locA2);
      await sleep(250);
      expect(aScoped.changes().slice(scopedBefore)).toEqual([]);
      // L2-pinned stream never saw the earlier L1 traffic.
      expect(aL2.changes().every((c) => c.locationId === locA2 || c.locationId === null)).toBe(true);
    });

    it('events without a location go to every subscriber of the tenant, never another tenant', async () => {
      const bBefore = bAll.changes().length;
      bus.emit(bizAId, 'notifications');
      await aAll.waitTopic('notifications');
      await aL2.waitTopic('notifications');
      await aScoped.waitTopic('notifications');
      await sleep(200);
      expect(bAll.changes().length).toBe(bBefore);
      bus.emit(bizBId, 'expenses');
      await bAll.waitTopic('expenses');
    });
  });

  describe('lifecycle', () => {
    it('token expiry ends the stream with an expired event', async () => {
      // Re-sign the owner claims with a 2 second lifetime (same secret).
      const claims = JSON.parse(Buffer.from(ownerA.split('.')[1]!, 'base64url').toString('utf8')) as Record<string, unknown>;
      delete claims.exp;
      delete claims.iat;
      const short = app
        .get(JwtService)
        .sign(claims, { algorithm: 'HS256', secret: app.get(ConfigService).get<string>('JWT_ACCESS_SECRET')!, expiresIn: 2 });
      const c = await open('/admin/realtime/stream', short);
      expect(c.status).toBe(200);
      await c.waitFor((e) => e.event === 'expired', 4000);
      await c.waitEnd();
    });

    it('caps concurrent streams per user at 5; the oldest is replaced', async () => {
      const email = `rt-cap-${RUN}@test.local`;
      const cu = await post(ownerA, '/admin/users', { email, password: PW, displayName: 'cap', roleKeys: ['location-manager'] });
      expect(cu.status).toBe(201);
      const tok = await login(email);
      const list: SseClient[] = [];
      for (let i = 0; i < 6; i++) list.push(await open('/admin/realtime/stream', tok));
      await list[0]!.waitFor((e) => e.event === 'replaced');
      await list[0]!.waitEnd();
      await sleep(100);
      expect(list.slice(1).every((c) => !c.ended)).toBe(true);
    });

    it('releases every subscription when clients disconnect', async () => {
      clients.forEach((c) => c.close());
      const deadline = Date.now() + 3000;
      while (bus.subscriberCount() > 0 && Date.now() < deadline) await sleep(50);
      expect(bus.subscriberCount()).toBe(0);
    });
  });
});
