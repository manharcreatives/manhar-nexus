/**
 * Contract tests for the QR menu client. The fixtures in __fixtures__/real-api.json are RESPONSES RECORDED FROM THE REAL API
 * (apps/api/src/guestmenu, demo seed), not hand-written mocks: if the backend changes shape, re-record and these fail loudly.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import raw from './__fixtures__/real-api.json';
import { ApiError, backoffMs, createHttpApi, normalizeMenu, normalizeState, openEventStream, type EventSourceLike } from './api';
import { cartSignature, cartTotals, checkSelection, lineTotalMinor, reconcileCart, toOrderBody, type CartState } from './cart';
import { orderFailure } from './errors';
import { isMockMode } from './path';
import { isActive, isAwaiting, isBillFinal, isBillPaid, isRejected, stageOf, statusLabel, taxLabel, wasAdjusted } from './status';
import type { MenuPayload, TableState } from './types';

interface Rec { status: number; headers: Record<string, string>; body: unknown }
const rec = (raw as unknown as { rec: Record<string, Rec & { raw?: string }> }).rec;
const R = (name: string): Rec => {
  const r = rec[name];
  if (!r) throw new Error(`no fixture ${name}`);
  return r;
};

/** A fetch that answers with a recorded response and remembers what it was asked. */
function fakeFetch(name: string) {
  const r = R(name);
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(r.status === 304 ? null : JSON.stringify(r.body), { status: r.status, headers: r.headers });
  });
  vi.stubGlobal('fetch', fn);
  return calls;
}
afterEach(() => vi.unstubAllGlobals());

const api = () => createHttpApi('TABLETOKEN', 'http://x/api');
const menu = R('menu').body as MenuPayload;
const hdr = (c: { init: RequestInit }) => c.init.headers as Record<string, string>;

describe('menu (recorded GET /public/menu/:t)', () => {
  it('is normalised without losing anything the page needs', async () => {
    fakeFetch('menu');
    const r = await api().getMenu();
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.data.etag).toMatch(/^W\//);
    expect(r.data.business).toMatchObject({ name: 'The Pilot Kitchen', currency: 'INR' });
    expect(r.data.table.open).toBe(true);
    expect(r.data.settings).toMatchObject({ ordering: 'confirm', callWaiter: true });
    expect(r.data.items.length).toBeGreaterThan(8);
    for (const i of r.data.items) {
      expect(Array.isArray(i.tags) && Array.isArray(i.variants) && Array.isArray(i.addOnGroups)).toBe(true);
      if (i.imageUrl) expect(i.imageUrl).toMatch(/^https?:\/\/.+\/media\/[0-9a-f-]{36}\/[0-9a-f]{40}\.webp$/);
    }
  });
  it('sends If-None-Match and treats 304 as "unchanged"', async () => {
    const calls = fakeFetch('menu304');
    const r = await api().getMenu(R('menu').headers.etag);
    expect(r).toEqual({ status: 'not-modified' });
    expect(hdr(calls[0]!)['If-None-Match']).toBe(R('menu').headers.etag);
  });
  it('never sends credentials or a guest token for the menu', async () => {
    const calls = fakeFetch('menu');
    await api().getMenu();
    expect(calls[0]!.init.credentials).toBe('omit');
    expect(hdr(calls[0]!)['X-Guest-Token']).toBeUndefined();
  });
  it('survives missing arrays (old cache, odd proxy)', () => {
    const m = normalizeMenu({ ...menu, items: [{ ...menu.items[0]!, tags: undefined, variants: undefined, addOnGroups: undefined } as never], categories: undefined as never }, 'W/"h"');
    expect(m.items[0]!.tags).toEqual([]);
    expect(m.categories).toEqual([]);
  });
});

describe('error envelope -> ApiError', () => {
  const cases: Array<[string, () => Promise<unknown>, string, string]> = [
    ['menu404', () => api().getMenu(), 'not-found', 'NOT_FOUND'],
    ['menu404malformed', () => api().getMenu(), 'not-found', 'NOT_FOUND'],
    ['menuTableDisabled', () => api().getMenu(), 'disabled', 'MENU_DISABLED'],
    ['guestClosed', () => api().createGuest(), 'conflict', 'TABLE_CLOSED'],
    ['stateBadToken', () => api().getState('x'), 'auth', 'GUEST_TOKEN_INVALID'],
    ['payBillNotReady', () => api().payIntent('g'), 'conflict', 'BILL_NOT_READY'],
    ['payAlready', () => api().payIntent('g'), 'conflict', 'BILL_NOT_READY'],
    ['waiterSwitchedOff', () => api().callWaiter('g', 'call'), 'ordering-off', 'ORDERING_OFF'],
    ['waiterBadReason', () => api().callWaiter('g', 'call'), 'invalid', 'VALIDATION'],
  ];
  it.each(cases)('%s', async (name, run, kind, code) => {
    fakeFetch(name);
    const e = await run().catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    const err = e as ApiError;
    expect(err.status).toBe(R(name).status);
    expect(err.kind).toBe(kind);
    if (name !== 'menu404' && name !== 'menu404malformed') expect(err.code).toBe(code);
    expect(err.message.length).toBeGreaterThan(3);
  });
  it('429 carries Retry-After (header, else details)', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ statusCode: 429, error: { code: 'RATE_LIMITED', message: 'slow down', details: { retryAfterSeconds: 42, reason: 'PENDING_ORDERS' } } }), { status: 429 }));
    const e = (await api().placeOrder('g', { lines: [] }, 'idem-12345678').catch((x: unknown) => x)) as ApiError;
    expect(e.kind).toBe('rate');
    expect(e.retryAfterSec).toBe(42);
    expect(e.reason).toBe('PENDING_ORDERS');
    expect(e.transient).toBe(true);
  });
  it('UPI_UNAVAILABLE (documented envelope; not in the recording because UPI was already enabled in the scratch DB)', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ statusCode: 409, error: { code: 'UPI_UNAVAILABLE', message: 'UPI payment is not available at this restaurant. Please ask your waiter.' } }), { status: 409 }));
    const e = (await api().payIntent('g').catch((x: unknown) => x)) as ApiError;
    expect(e).toMatchObject({ kind: 'conflict', code: 'UPI_UNAVAILABLE' });
  });
  it('a proxy error page (not JSON) is a transient server error', async () => {
    vi.stubGlobal('fetch', async () => new Response('<html>Bad gateway</html>', { status: 502 }));
    const e = (await api().getMenu().catch((x: unknown) => x)) as ApiError;
    expect(e.kind).toBe('server');
    expect(e.transient).toBe(true);
  });
  it('a dropped connection is a transient network error', async () => {
    vi.stubGlobal('fetch', async () => { throw new TypeError('Failed to fetch'); });
    const e = (await api().getMenu().catch((x: unknown) => x)) as ApiError;
    expect(e.kind).toBe('network');
    expect(e.transient).toBe(true);
  });
});

describe('order submit', () => {
  const lines = { lines: [{ itemId: 'a', qty: 1 }] };
  it('sends Idempotency-Key + X-Guest-Token and reports a fresh order', async () => {
    const calls = fakeFetch('order');
    const r = await api().placeOrder('GUESTTOKEN', lines, 'key-abcdef12');
    expect(hdr(calls[0]!)['Idempotency-Key']).toBe('key-abcdef12');
    expect(hdr(calls[0]!)['X-Guest-Token']).toBe('GUESTTOKEN');
    expect(calls[0]!.url).toBe('http://x/api/public/menu/TABLETOKEN/orders');
    expect(r).toMatchObject({ status: 'AWAITING_CONFIRMATION', replayed: false });
    expect(typeof r.orderId).toBe('string');
  });
  it('a replay (200 + Idempotent-Replay) is reported as replayed with the SAME order id', async () => {
    fakeFetch('orderReplay');
    const r = await api().placeOrder('GUESTTOKEN', lines, 'key-abcdef12');
    expect(r.replayed).toBe(true);
    expect(r.orderId).toBe((R('order').body as { orderId: string }).orderId);
  });
  it('the cart maths equals the total the server computed from the same lines', () => {
    const plain = menu.items.find((i) => i.name === 'Gulab Jamun')!;
    const withVar = menu.items.find((i) => i.name === 'Cold Coffee')!;
    const cart: CartState = {
      note: '',
      lines: [
        { key: 'a', itemId: plain.id, addOnOptionIds: [], qty: 2 },
        { key: 'b', itemId: withVar.id, variantId: withVar.variants[0]!.id, addOnOptionIds: [], qty: 1 },
      ],
    };
    const t = cartTotals(cart, new Map(menu.items.map((i) => [i.id, i])));
    expect(t.totalMinor).toBe((R('order').body as { totalMinor: number }).totalMinor);
    expect(lineTotalMinor(withVar, cart.lines[1]!)).toBe(withVar.variants[0]!.priceMinor); // variants are absolute prices
    const body = JSON.stringify(toOrderBody(cart));
    expect(body).not.toMatch(/price|total|amount/i);
    expect(cartSignature(cart)).toBe(cartSignature({ ...cart }));
  });
  it('variant-required items fail the client check before the server has to say so', () => {
    const withVar = menu.items.find((i) => i.variants.length > 0)!;
    expect(checkSelection(withVar, undefined, []).variantMissing).toBe(true);
    expect(checkSelection(withVar, withVar.variants[0]!.id, []).ok).toBe(true);
  });
  it('a sold-out dish is dropped from the cart (recorded sold-out menu)', () => {
    const sold = (R('menuSoldOut').body as MenuPayload).items.find((i) => i.soldOut)!;
    const r = reconcileCart({ note: '', lines: [{ key: 'k', itemId: sold.id, addOnOptionIds: [], qty: 1 }] }, (R('menuSoldOut').body as MenuPayload).items);
    expect(r.removed).toEqual([sold.name]);
    expect(r.state.lines).toHaveLength(0);
  });
  const failures: Array<[string, string, Partial<ReturnType<typeof orderFailure>>]> = [
    ['orderSoldOut', 'SOLD_OUT', { refreshMenu: true, newKey: true }],
    ['orderLocked', 'ORDERING_LOCKED', { refreshMenu: false }],
    ['orderOrderingOff', 'ORDERING_OFF', { refreshMenu: true }],
    ['orderReuse', 'IDEMPOTENCY_KEY_REUSED', { newKey: true }],
    ['orderVariantRequired', 'VALIDATION', { refreshMenu: true, newKey: true }],
    ['orderBadToken', 'GUEST_TOKEN_INVALID', {}],
  ];
  it.each(failures)('%s -> %s is handled', async (name, code, expected) => {
    fakeFetch(name);
    const e = (await api().placeOrder('g', lines, 'key-abcdef12').catch((x: unknown) => x)) as ApiError;
    expect(e.code).toBe(code);
    const f = orderFailure(e, 'FALLBACK', 'OFFLINE');
    expect(f).toMatchObject(expected);
    expect(f.message.length).toBeGreaterThan(5);
  });
  it('a lost connection keeps the key and says the order is saved', () => {
    const f = orderFailure(new ApiError('network', 0, 'No connection.'), 'FALLBACK', 'OFFLINE');
    expect(f).toEqual({ message: 'OFFLINE', refreshMenu: false, newKey: false });
  });
  it('too many waiting orders gets its own message', () => {
    const f = orderFailure(new ApiError('rate', 429, 'x', 60, 'RATE_LIMITED', { reason: 'PENDING_ORDERS' }), 'F', 'O');
    expect(f.message).toMatch(/waiting for the waiter/);
  });
});

describe('table state (recorded GET /state)', () => {
  const state = (n: string) => normalizeState(R(n).body as Partial<TableState>);
  it('no open visit: empty and not an error', () => {
    expect(state('stateClosed')).toEqual({ orders: [], bill: null, waiterCall: { open: false } });
  });
  it('AWAITING_CONFIRMATION is stage "received" and is shown as awaiting', () => {
    const o = state('stateAwaiting').orders[0]!;
    expect(o).toMatchObject({ status: 'AWAITING_CONFIRMATION', mine: true, edited: false });
    expect(stageOf(o.status)).toBe('received');
    expect(isAwaiting(o.status)).toBe(true);
    expect(statusLabel(o.status)).toBe('Awaiting confirmation');
    expect(isActive(o)).toBe(true);
    expect(state('stateAwaiting').bill).toBeNull();
  });
  it('a waiter edit before confirmation is NOT flagged by the API, so the client compares totals it submitted', () => {
    const before = (R('order').body as { totalMinor: number }).totalMinor;
    const o = state('stateEdited').orders[0]!;
    expect(o.edited).toBe(false);
    expect(o.totalMinor).not.toBe(before);
    expect(wasAdjusted(o, { [o.id]: before })).toBe(true);
    expect(wasAdjusted(o, { [o.id]: o.totalMinor })).toBe(false);
    expect(wasAdjusted(o, {})).toBe(false);
  });
  it('confirmed -> preparing walk the stages', () => {
    expect(stageOf(state('stateConfirmed').orders[0]!.status)).toBe('confirmed');
    expect(stageOf(state('statePreparing').orders[0]!.status)).toBe('preparing');
    expect(state('stateConfirmed').orders[0]!.timeline.map((t) => t.status)).toEqual(['AWAITING_CONFIRMATION', 'CONFIRMED']);
  });
  it('REJECTED carries the reason and ends the order', () => {
    const o = state('stateRejected').orders.find((x) => x.status === 'REJECTED')!;
    expect(o.rejectReason).toBe('Kitchen is closing early');
    expect(isRejected(o.status)).toBe(true);
    expect(stageOf(o.status)).toBe('cancelled');
    expect(isActive(o)).toBe(false);
    expect(wasAdjusted(o, { [o.id]: 12345 })).toBe(false);
  });
  it('another guest sees confirmed orders of the table (mine=false) and only their own pending ones', () => {
    const orders = state('stateOtherGuest').orders;
    expect(orders.find((o) => !o.mine)!.status).toBe('PREPARING');
    expect(orders.filter((o) => o.mine).every((o) => o.status === 'AWAITING_CONFIRMATION')).toBe(true);
  });
  it('waiter call: {open:false} or {open:true,reason,at}', () => {
    expect(state('stateWaiter').waiterCall).toMatchObject({ open: true, reason: 'call' });
    expect(state('stateAwaiting').waiterCall).toEqual({ open: false });
  });
  it('bill: RUNNING has CGST+SGST rows summing to the tax; FINAL is payable; PAID is not', () => {
    const run = state('stateBillRunning').bill!;
    expect(run.status).toBe('RUNNING');
    expect(run.reference).toBeNull();
    expect(isBillFinal(run)).toBe(false);
    expect(run.taxLines.map((t) => t.label).sort()).toEqual(['CGST', 'CGST', 'SGST', 'SGST']);
    expect(run.subtotalMinor + run.taxLines.reduce((s, t) => s + t.amountMinor, 0)).toBe(run.totalMinor);
    expect(taxLabel(run.taxLines[0]!)).toMatch(/^CGST \d/);
    const fin = state('stateBillFinal').bill!;
    expect(fin).toMatchObject({ status: 'FINAL', paidMinor: 0 });
    expect(fin.reference).toBeTruthy();
    expect(fin.dueMinor).toBe(fin.totalMinor);
    expect(isBillFinal(fin)).toBe(true);
    expect(fin.totalMinor).toBe(run.totalMinor); // the running bill equals the invoice
    const paid = state('stateBillPaid').bill!;
    expect(paid).toMatchObject({ status: 'PAID', dueMinor: 0 });
    expect(isBillPaid(paid)).toBe(true);
    expect(isBillFinal(paid)).toBe(false);
  });
});

describe('waiter + pay-intent', () => {
  it('waiter call posts the reason and accepts 202', async () => {
    const calls = fakeFetch('waiter');
    await api().callWaiter('GUESTTOKEN', 'call');
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ reason: 'call' });
  });
  it('pay-intent: UPI deep link for the amount still due', async () => {
    const calls = fakeFetch('payIntent');
    const p = await api().payIntent('GUESTTOKEN');
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ method: 'upi' });
    expect(p.upiUri).toMatch(/^upi:\/\/pay\?pa=/);
    expect(p.qrPayload).toBe(p.upiUri);
    const fin = normalizeState(R('stateBillFinal').body as Partial<TableState>).bill!;
    expect(p.amountMinor).toBe(fin.dueMinor);
    expect(new URL(p.upiUri.replace('upi://', 'http://')).searchParams.get('am')).toBe((p.amountMinor / 100).toFixed(2));
    expect(p.reference).toBe(fin.reference);
  });
});

describe('live stream (SSE)', () => {
  class FakeEs implements EventSourceLike {
    static all: FakeEs[] = [];
    readyState = 0;
    onopen: ((e: Event) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    private ls = new Map<string, Array<(e: MessageEvent) => void>>();
    closed = false;
    constructor(readonly url: string) { FakeEs.all.push(this); }
    addEventListener(t: string, l: (e: MessageEvent) => void) { this.ls.set(t, [...(this.ls.get(t) ?? []), l]); }
    close() { this.closed = true; this.readyState = 2; }
    emit(t: string, data: unknown) { (this.ls.get(t) ?? []).forEach((l) => l({ data: JSON.stringify(data) } as MessageEvent)); }
  }
  const setup = () => {
    FakeEs.all = [];
    const seen: Array<[string, unknown]> = [];
    let opens = 0; let errors = 0;
    const close = openEventStream('u', { onEvent: (n, d) => seen.push([n, d]), onOpen: () => { opens += 1; }, onError: () => { errors += 1; } }, (u) => new FakeEs(u), () => 0.5);
    return { seen, close, counts: () => ({ opens, errors }) };
  };
  it('parses the recorded wire format and delivers every named event', () => {
    const sse = (R('streamRaw') as unknown as { raw: string }).raw;
    const frames = [...sse.matchAll(/event: ([\w.]+)\ndata: (.*)\n/g)].map((m) => [m[1]!, JSON.parse(m[2]!)] as const);
    expect(frames.map((f) => f[0])).toEqual(['hello', 'order.updated', 'order.updated', 'bill.updated', 'menu.changed', 'bye']);
    const { seen, close } = setup();
    const es = FakeEs.all[0]!;
    for (const [n, d] of frames) es.emit(n, d);
    expect(seen.map((s) => s[0])).toEqual(frames.map((f) => f[0]));
    expect(seen[1]).toEqual(['order.updated', { orderId: expect.any(String), status: 'AWAITING_CONFIRMATION' }]);
    close();
  });
  it('hints carry no names or amounts', () => {
    const sse = (R('streamRaw') as unknown as { raw: string }).raw;
    expect(sse).not.toMatch(/Gulab|totalMinor|priceMinor|guestToken/);
  });
  it('bye "refresh" reopens at once; other reasons back off; close() stops everything', () => {
    vi.useFakeTimers();
    try {
      const { seen, close } = setup();
      FakeEs.all[0]!.emit('bye', { reason: 'refresh' });
      expect(FakeEs.all[0]!.closed).toBe(true);
      vi.advanceTimersByTime(1);
      expect(FakeEs.all).toHaveLength(2);
      FakeEs.all[1]!.emit('bye', { reason: 'token-changed' });
      vi.advanceTimersByTime(500);
      expect(FakeEs.all).toHaveLength(2); // still waiting
      vi.advanceTimersByTime(5000);
      expect(FakeEs.all).toHaveLength(3);
      expect(seen.filter((s) => s[0] === 'bye')).toHaveLength(2);
      close();
      FakeEs.all[2]!.emit('bye', { reason: 'refresh' });
      vi.advanceTimersByTime(60000);
      expect(FakeEs.all).toHaveLength(3);
    } finally {
      vi.useRealTimers();
    }
  });
  it('a hard failure (readyState CLOSED) reconnects with growing delays, reset after a successful open', () => {
    vi.useFakeTimers();
    try {
      const { close, counts } = setup();
      const fail = (i: number) => { const es = FakeEs.all[i]!; es.readyState = 2; es.onerror?.(new Event('error')); };
      fail(0); // jitter 0.5 -> exactly 1000 ms
      vi.advanceTimersByTime(999); expect(FakeEs.all).toHaveLength(1);
      vi.advanceTimersByTime(2); expect(FakeEs.all).toHaveLength(2);
      fail(1); // 2000 ms
      vi.advanceTimersByTime(1999); expect(FakeEs.all).toHaveLength(2);
      vi.advanceTimersByTime(2); expect(FakeEs.all).toHaveLength(3);
      FakeEs.all[2]!.onopen?.(new Event('open'));
      expect(counts()).toEqual({ opens: 1, errors: 2 });
      fail(2); // back to 1000 ms
      vi.advanceTimersByTime(1001); expect(FakeEs.all).toHaveLength(4);
      close();
    } finally {
      vi.useRealTimers();
    }
  });
  it('browser-managed retries (readyState CONNECTING) are left alone', () => {
    vi.useFakeTimers();
    try {
      const { close, counts } = setup();
      const es = FakeEs.all[0]!; es.readyState = 0; es.onerror?.(new Event('error'));
      vi.advanceTimersByTime(60000);
      expect(FakeEs.all).toHaveLength(1);
      expect(counts().errors).toBe(1);
      close();
    } finally {
      vi.useRealTimers();
    }
  });
  it('backoff doubles and is capped at 30 s (+-30 % jitter)', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map((n) => backoffMs(n, () => 0.5))).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
    expect(backoffMs(0, () => 0)).toBe(700);
    expect(backoffMs(0, () => 1)).toBe(1300);
  });
});

describe('mock mode can never reach production', () => {
  it('?mock=1 works only outside production builds', () => {
    expect(isMockMode('?mock=1', undefined, false)).toBe(true);
    expect(isMockMode('?mock=1', undefined, true)).toBe(false);
    expect(isMockMode('?mock=1&mode=auto', '', true)).toBe(false);
    expect(isMockMode('', undefined, false)).toBe(false);
  });
  it('only an explicit build flag enables it in production', () => {
    expect(isMockMode('', '1', true)).toBe(true);
    expect(isMockMode('', '0', true)).toBe(false);
  });
});
