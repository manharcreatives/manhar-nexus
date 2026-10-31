import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';

/**
 * Shared fixture of the QR digital menu e2e specs (ADR-035): one restaurant with a location, a dining area, a small menu
 * (plain item, item with variants + a required add-on group, a sold-out item), staff of several roles and a second
 * business for tenant-isolation checks. Not a spec itself (the e2e config only runs *.e2e-spec.ts).
 */
export const PW = 'Test!Password1';

export const uuid = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

export interface Fixture {
  app: INestApplication;
  RUN: string;
  http: () => ReturnType<INestApplication['getHttpServer']>;
  bizId: string;
  locId: string;
  areaId: string;
  ownerToken: string;
  waiterToken: string;
  kitchenToken: string;
  hostToken: string;
  other: { bizId: string; ownerToken: string; locId: string; areaId: string };
  ids: { burger: string; pizza: string; small: string; large: string; family: string; thin: string; thick: string; truffle: string; tea: string; soldOut: string; cat: string; taxId: string };
  get: (tok: string | null, path: string) => request.Test;
  post: (tok: string | null, path: string, body?: object) => request.Test;
  put: (tok: string, path: string, body?: object) => request.Test;
  patch: (tok: string, path: string, body?: object) => request.Test;
  del: (tok: string, path: string) => request.Test;
  /** Creates a table (owner), returns ids; `open` also seats a party (a visit starts). */
  table: (code: string, opts?: { open?: boolean; owner?: string; area?: string; loc?: string }) => Promise<{ tableId: string; sessionId: string | null; code: string }>;
  /** The table's QR token (staff list). */
  qrToken: (tableId: string) => Promise<string>;
  /** Public GET/POST helpers (no auth). */
  pub: { get: (token: string, sub?: string, guest?: string) => request.Test; post: (token: string, sub: string, body?: object, headers?: Record<string, string>) => request.Test };
  guest: (qr: string, displayName?: string) => Promise<string>;
  order: (qr: string, guestToken: string, lines: object[], opts?: { key?: string; note?: string }) => request.Test;
  close: () => Promise<void>;
}

export async function bootstrap(label: string): Promise<Fixture> {
  const RUN = `${label}${Date.now().toString(36)}`;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  applyHttpDefaults(app);
  await app.init();
  const http = () => app.getHttpServer();

  const auth = (r: request.Test, tok: string | null): request.Test => (tok ? r.set('authorization', `Bearer ${tok}`) : r);
  const get: Fixture['get'] = (tok, path) => auth(request(http()).get(path), tok);
  const post: Fixture['post'] = (tok, path, body = {}) => auth(request(http()).post(path), tok).send(body);
  const put: Fixture['put'] = (tok, path, body = {}) => auth(request(http()).put(path), tok).send(body);
  const patch: Fixture['patch'] = (tok, path, body = {}) => auth(request(http()).patch(path), tok).send(body);
  const del: Fixture['del'] = (tok, path) => auth(request(http()).delete(path), tok);

  const loginRes = await request(http()).post('/auth/login').send({
    email: process.env.PLATFORM_BOOTSTRAP_EMAIL ?? 'platform@manhar.local',
    password: process.env.PLATFORM_BOOTSTRAP_PASSWORD ?? 'ChangeMe!Dev12345',
  });
  expect(loginRes.status).toBe(200);
  const platformToken = loginRes.body.accessToken as string;
  const pPost = (path: string, body: object = {}) => request(http()).post(path).set('authorization', `Bearer ${platformToken}`).send(body);

  const login = async (email: string): Promise<string> => {
    const res = await request(http()).post('/auth/login').send({ email, password: PW });
    expect(res.status).toBe(200);
    return res.body.accessToken as string;
  };
  const activate = async (id: string, moduleKey: string) => {
    expect([201, 409]).toContain((await pPost(`/internal/businesses/${id}/modules/${moduleKey}/activate`)).status);
    expect([200, 201]).toContain((await pPost(`/internal/businesses/${id}/modules/${moduleKey}/complete-setup`)).status);
  };
  const mkBiz = async (tag: string) => {
    const biz = await pPost('/internal/businesses', { name: `QR ${tag} ${RUN}`, businessTypeKey: 'restaurant' });
    expect(biz.status).toBe(201);
    const id = biz.body.id as string;
    const email = `owner-qr-${tag}-${RUN}@test.local`;
    expect((await pPost(`/internal/businesses/${id}/provision`, { email, displayName: `Owner ${tag}`, password: PW })).status).toBe(201);
    const ownerToken = await login(email);
    const locId = (await pPost(`/internal/businesses/${id}/locations`, { name: `Loc ${tag} ${RUN}`, timezone: 'Asia/Kolkata' })).body.id as string;
    for (const m of ['restaurant', 'catalog', 'checkout']) await activate(id, m);
    const areaId = (await post(ownerToken, '/admin/dining/areas', { locationId: locId, name: `Hall ${tag} ${RUN}`, sortOrder: 0 })).body.id as string;
    return { id, ownerToken, locId, areaId };
  };

  const A = await mkBiz('A');
  const B = await mkBiz('B');

  const created = async (path: string, body: object): Promise<string> => {
    const r = await post(A.ownerToken, path, body);
    expect(r.status).toBe(201);
    return r.body.id as string;
  };
  const taxId = await created('/admin/catalog/tax-categories', { name: 'GST 5%', rate: 0.05, isDefault: true });
  const cat = await created('/admin/catalog/categories', { name: `Mains ${RUN}`, sortOrder: 0 });
  const burger = await created('/admin/catalog/items', { categoryId: cat, name: 'Burger', description: 'Beef-free, house sauce', basePriceMinorUnits: 1000, taxCategoryId: taxId, isAvailable: true });
  const tea = await created('/admin/catalog/items', { categoryId: cat, name: 'Masala Tea', basePriceMinorUnits: 300, taxCategoryId: taxId, isAvailable: true });
  const pizza = await created('/admin/catalog/items', { categoryId: cat, name: 'Pizza', basePriceMinorUnits: 8000, taxCategoryId: taxId, isAvailable: true });
  const soldOut = await created('/admin/catalog/items', { categoryId: cat, name: 'Sold Out Soup', basePriceMinorUnits: 500, taxCategoryId: taxId, isAvailable: false });
  const small = await created(`/admin/catalog/items/${pizza}/variants`, { name: 'Small', priceAdjMinorUnits: 0 });
  const large = await created(`/admin/catalog/items/${pizza}/variants`, { name: 'Large', priceAdjMinorUnits: 3000 });
  const family = await created(`/admin/catalog/items/${pizza}/variants`, { name: 'Family', priceAdjMinorUnits: 6000, isAvailable: false });
  const crust = await created('/admin/catalog/modifier-groups', { name: `Crust ${RUN}`, selectionType: 'SINGLE', isRequired: true, minSelections: 1, maxSelections: 1 });
  const thin = await created(`/admin/catalog/modifier-groups/${crust}/options`, { name: 'Thin', priceAdjMinorUnits: 0 });
  const thick = await created(`/admin/catalog/modifier-groups/${crust}/options`, { name: 'Thick', priceAdjMinorUnits: 500 });
  const truffle = await created(`/admin/catalog/modifier-groups/${crust}/options`, { name: 'Truffle', priceAdjMinorUnits: 900, isAvailable: false });
  expect((await post(A.ownerToken, `/admin/catalog/items/${pizza}/modifier-groups`, { modifierGroupId: crust, sortOrder: 0 })).status).toBe(201);

  const mkUser = async (name: string, roleKey: string): Promise<string> => {
    const email = `${name}-qr-${RUN}@test.local`;
    const res = await post(A.ownerToken, '/admin/users', { email, password: PW, displayName: `${name} Person`, roleKeys: [roleKey] });
    expect(res.status).toBe(201);
    return login(email);
  };
  const waiterToken = await mkUser('waiter', 'service-team');
  const kitchenToken = await mkUser('kitchen', 'kitchen-team');
  const hostToken = await mkUser('host', 'host');

  const table: Fixture['table'] = async (code, opts = {}) => {
    const owner = opts.owner ?? A.ownerToken;
    const t = await post(owner, '/admin/dining/tables', { diningAreaId: opts.area ?? A.areaId, locationId: opts.loc ?? A.locId, code: `${code}-${RUN}`, capacity: 4 });
    expect(t.status).toBe(201);
    let sessionId: string | null = null;
    if (opts.open !== false) {
      const s = await post(owner, '/admin/sessions', { locationId: opts.loc ?? A.locId, diningTableId: t.body.id, partySize: 2 });
      expect(s.status).toBe(201);
      sessionId = s.body.id as string;
    }
    return { tableId: t.body.id as string, sessionId, code: `${code}-${RUN}` };
  };
  const qrToken: Fixture['qrToken'] = async (tableId) => {
    const r = await get(A.ownerToken, '/admin/qr/tables');
    expect(r.status).toBe(200);
    const row = (r.body as { tableId: string; token: string }[]).find((x) => x.tableId === tableId);
    expect(row).toBeDefined();
    return row!.token;
  };
  const pub: Fixture['pub'] = {
    get: (token, sub = '', guest) => {
      const r = request(http()).get(`/public/menu/${token}${sub}`);
      return guest ? r.set('x-guest-token', guest) : r;
    },
    post: (token, sub, body = {}, headers = {}) => {
      let r = request(http()).post(`/public/menu/${token}${sub}`);
      for (const [k, v] of Object.entries(headers)) r = r.set(k, v);
      return r.send(body);
    },
  };
  const guest: Fixture['guest'] = async (qr, displayName) => {
    const r = await pub.post(qr, '/guest', displayName ? { displayName } : {});
    expect(r.status).toBe(201);
    return r.body.guestToken as string;
  };
  const order: Fixture['order'] = (qr, g, lines, opts = {}) =>
    pub.post(qr, '/orders', { lines, ...(opts.note ? { note: opts.note } : {}) }, { 'x-guest-token': g, 'idempotency-key': opts.key ?? uuid() });

  return {
    app,
    RUN,
    http,
    bizId: A.id,
    locId: A.locId,
    areaId: A.areaId,
    ownerToken: A.ownerToken,
    waiterToken,
    kitchenToken,
    hostToken,
    other: { bizId: B.id, ownerToken: B.ownerToken, locId: B.locId, areaId: B.areaId },
    ids: { burger, pizza, small, large, family, thin, thick, truffle, tea, soldOut, cat, taxId },
    get,
    post,
    put,
    patch,
    del,
    table,
    qrToken,
    pub,
    guest,
    order,
    close: () => app.close(),
  };
}

/** Raises every guest-menu rate limit far above what a functional test needs (the limits spec uses the defaults). */
export function relaxLimits(): void {
  for (const k of ['MENU_IP', 'MENU_TOKEN', 'BAD_TOKEN_IP', 'GUEST_CREATE_IP', 'GUEST_CREATE_TOKEN', 'STATE_GUEST', 'STATE_IP', 'ORDER_GUEST', 'ORDER_TOKEN', 'ORDER_IP', 'WAITER_GUEST', 'WAITER_TOKEN', 'WAITER_IP', 'PAY_GUEST', 'PAY_IP', 'STREAM_OPEN_IP', 'STREAM_CONCURRENT_IP', 'STREAM_CONCURRENT_TOKEN', 'MEDIA_IP']) {
    process.env[`GUESTMENU_LIMIT_${k}`] = '100000';
  }
}
