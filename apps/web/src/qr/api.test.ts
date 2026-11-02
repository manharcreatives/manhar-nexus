import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assetUrl, qrApi, uploadImage } from './api';

interface Call {
  url: string;
  method: string;
  body: unknown;
  headers: Headers;
}
let calls: Call[] = [];
let answer: (c: Call) => Response;

const ok = (body: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  calls = [];
  answer = () => ok({});
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const call: Call = {
        url: String(input).replace(/^https?:\/\/[^/]+/, ''),
        method: init?.method ?? 'GET',
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
        headers: new Headers(init?.headers),
      };
      calls.push(call);
      return answer(call);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const table = { tableId: 'tbl-1', version: 4 };

describe('table endpoints', () => {
  it('lists /admin/qr/tables', async () => {
    answer = () => ok([{ tableId: 'tbl-1', code: 'T1', token: 'abc', enabled: true, orderingEnabled: true, version: 1, pendingGuestOrders: 0, waiterCall: null }]);
    const rows = await qrApi.tables();
    expect(calls[0]).toMatchObject({ url: '/admin/qr/tables', method: 'GET' });
    expect(rows[0]).toMatchObject({ tableId: 'tbl-1', code: 'T1', version: 1 });
  });
  it('rotate POSTs expectedVersion', async () => {
    answer = () => ok({ tableId: 'tbl-1', code: 'T1', token: 'new', version: 5, rotationCount: 1 });
    const out = await qrApi.rotate(table);
    expect(calls[0]).toMatchObject({ url: '/admin/qr/tables/tbl-1/rotate', method: 'POST', body: { expectedVersion: 4 } });
    expect(out).toMatchObject({ token: 'new', version: 5 });
  });
  it('enable and ordering are PATCHes with expectedVersion', async () => {
    await qrApi.setTableEnabled(table, false);
    await qrApi.setTableOrdering(table, false);
    expect(calls[0]).toMatchObject({ url: '/admin/qr/tables/tbl-1', method: 'PATCH', body: { enabled: false, expectedVersion: 4 } });
    expect(calls[1]).toMatchObject({ url: '/admin/qr/tables/tbl-1', method: 'PATCH', body: { orderingEnabled: false, expectedVersion: 4 } });
  });
  it('a stale version surfaces as a 409 VERSION_CONFLICT error', async () => {
    answer = () => ok({ error: { code: 'VERSION_CONFLICT', message: 'changed' } }, 409);
    await expect(qrApi.rotate(table)).rejects.toMatchObject({ status: 409, code: 'VERSION_CONFLICT' });
  });
});

describe('settings', () => {
  it('PATCHes only the changes plus expectedVersion', async () => {
    answer = () => ok({ enabled: true, ordering: 'auto', callWaiter: true, upi: false, tagline: '', accentColor: null, logoUrl: null, coverUrl: null, version: 3 });
    const out = await qrApi.saveSettings({ ordering: 'auto', tagline: 'Hi' }, 2);
    expect(calls[0]).toMatchObject({ url: '/admin/qr/settings', method: 'PATCH', body: { ordering: 'auto', tagline: 'Hi', expectedVersion: 2 } });
    expect(out.version).toBe(3);
  });
  it('removes logo and cover with DELETE', async () => {
    answer = () => ok(null, 204);
    await qrApi.removeBrandImage('logo');
    await qrApi.removeBrandImage('cover');
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(['DELETE /admin/qr/settings/logo', 'DELETE /admin/qr/settings/cover']);
  });
});

describe('photos and presentation', () => {
  it('deletes item and category pictures', async () => {
    answer = () => ok(null, 204);
    await qrApi.removeItemImage('it-1');
    await qrApi.removeCategoryImage('cat-1');
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(['DELETE /admin/menu/items/it-1/image', 'DELETE /admin/menu/categories/cat-1/image']);
  });
  it('PATCHes the presentation body the API validates', async () => {
    await qrApi.setItemPresentation('it-1', { dietType: 'VEG', menuTags: ['Bestseller'], spiceLevel: 2 });
    expect(calls[0]).toMatchObject({ url: '/admin/menu/items/it-1/presentation', method: 'PATCH', body: { dietType: 'VEG', menuTags: ['Bestseller'], spiceLevel: 2 } });
  });
});

describe('guest orders', () => {
  it('lists the awaiting orders and drops anything else', async () => {
    answer = () => ok([{ id: 'a', status: 'AWAITING_CONFIRMATION', lines: [] }, { id: 'b', status: 'CONFIRMED', lines: [] }]);
    const rows = await qrApi.pendingOrders();
    expect(calls[0].url).toBe('/admin/guest-orders?status=AWAITING_CONFIRMATION');
    expect(rows.map((o) => o.id)).toEqual(['a']);
  });
  it('confirm and reject are plain POSTs (naturally idempotent, no key needed)', async () => {
    answer = () => ok({ id: 'a', status: 'CONFIRMED', lines: [] });
    await qrApi.confirm('a');
    await qrApi.reject('a', 'Sold out');
    expect(calls[0]).toMatchObject({ url: '/admin/guest-orders/a/confirm', method: 'POST' });
    expect(calls[1]).toMatchObject({ url: '/admin/guest-orders/a/reject', method: 'POST', body: { reason: 'Sold out' } });
  });
  it('edit sends {lines:[{id,qty}],note} with an Idempotency-Key and returns the row', async () => {
    answer = () => ok({ id: 'a', status: 'AWAITING_CONFIRMATION', totalMinor: 100, lines: [{ id: 'l1', name: 'X', qty: 1, unitPriceMinor: 100, addOns: [] }] });
    const out = await qrApi.edit('a', { lines: [{ id: 'l1', qty: 0 }], note: null }, 'key-12345678');
    expect(calls[0]).toMatchObject({ url: '/admin/guest-orders/a/edit', method: 'POST', body: { lines: [{ id: 'l1', qty: 0 }], note: null } });
    expect(calls[0].headers.get('idempotency-key')).toBe('key-12345678');
    expect(out.totalMinor).toBe(100);
  });
  it('alerts: list and ack (204)', async () => {
    answer = (c) => (c.method === 'GET' ? ok([{ tableId: 't', tableCode: 'T1', reason: 'bill', at: '2026-01-01T00:00:00.000Z' }]) : ok(null, 204));
    expect((await qrApi.alerts())[0]).toMatchObject({ tableCode: 'T1', reason: 'bill' });
    await qrApi.ackAlert('t');
    expect(calls[1]).toMatchObject({ url: '/admin/guest-orders/alerts/t/ack', method: 'POST' });
  });
  it('a failing alerts call is an error, not an empty list', async () => {
    answer = () => ok({ error: { code: 'FORBIDDEN', message: 'no' } }, 403);
    await expect(qrApi.alerts()).rejects.toMatchObject({ status: 403 });
  });
});

describe('multipart upload', () => {
  class FakeXhr {
    static last: FakeXhr;
    upload: { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    withCredentials = false;
    status = 200;
    responseText = '';
    method = '';
    url = '';
    headers: Record<string, string> = {};
    body: FormData | null = null;
    reply = { status: 200, body: '{"imageUrl":"/media/b/x.webp","imageThumbUrl":null}' };
    constructor() {
      FakeXhr.last = this;
    }
    open(method: string, url: string) {
      this.method = method;
      this.url = url.replace(/^https?:\/\/[^/]+/, '');
    }
    setRequestHeader(k: string, v: string) {
      this.headers[k.toLowerCase()] = v;
    }
    send(body: FormData) {
      this.body = body;
      this.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 });
      queueMicrotask(() => {
        this.status = this.reply.status;
        this.responseText = this.reply.body;
        this.onload?.();
      });
    }
  }
  beforeEach(() => vi.stubGlobal('XMLHttpRequest', FakeXhr));

  it('posts the picture in the multipart field "file" and reports progress', async () => {
    const seen: number[] = [];
    const out = await qrApi.uploadItemImage('it-1', new Blob(['x'], { type: 'image/webp' }), { onProgress: (f) => seen.push(f) });
    const x = FakeXhr.last;
    expect(x.method).toBe('POST');
    expect(x.url).toBe('/admin/menu/items/it-1/image');
    expect(x.withCredentials).toBe(true);
    const file = x.body?.get('file') as File;
    expect(file).toBeInstanceOf(Blob);
    expect(file.name).toBe('dish.webp');
    expect(out).toEqual({ imageUrl: '/media/b/x.webp', imageThumbUrl: null });
    expect(seen).toEqual([0.5, 1]);
  });
  it('category and brand pictures use their own endpoints', async () => {
    await qrApi.uploadCategoryImage('cat-1', new Blob(['x'], { type: 'image/png' }));
    expect(FakeXhr.last.url).toBe('/admin/menu/categories/cat-1/image');
    expect((FakeXhr.last.body?.get('file') as File).name).toBe('category.png');
    await qrApi.uploadBrandImage('cover', new Blob(['x'], { type: 'image/jpeg' }));
    expect(FakeXhr.last.url).toBe('/admin/qr/settings/cover');
    expect((FakeXhr.last.body?.get('file') as File).name).toBe('cover.jpg');
  });
  it('rejections keep the API status and code', async () => {
    const p = uploadImage('/admin/menu/items/it-1/image', new Blob(['x']), 'dish.webp');
    FakeXhr.last.reply = { status: 415, body: '{"error":{"code":"UNSUPPORTED_MEDIA","message":"Only PNG, JPEG or WebP pictures are accepted."}}' };
    await expect(p).rejects.toMatchObject({ status: 415, code: 'UNSUPPORTED_MEDIA' });
  });
});

describe('assetUrl', () => {
  it('resolves API-relative media paths and leaves absolute urls alone', () => {
    expect(assetUrl('/media/b/x.webp')).toMatch(/^https?:\/\/.+\/media\/b\/x\.webp$/);
    expect(assetUrl('https://cdn.example.com/x.webp')).toBe('https://cdn.example.com/x.webp');
    expect(assetUrl('blob:abc')).toBe('blob:abc');
    expect(assetUrl(null)).toBeNull();
  });
});
