import type {
  GuestSession, MenuPayload, PayIntent, PlaceOrderBody, PlaceOrderResult, StreamEventName, StreamHandlers,
  TableState, WaiterReason,
} from './types';
import { STREAM_EVENTS } from './types';

/** Same base the staff app uses (src/auth/api.ts). Duplicated on purpose: this chunk must not import auth code. */
export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

export type ApiErrorKind = 'network' | 'timeout' | 'not-found' | 'disabled' | 'auth' | 'rate' | 'invalid' | 'conflict' | 'server';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    readonly status: number,
    message: string,
    readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  /** Worth retrying automatically (no answer from the server yet). */
  get transient(): boolean {
    return this.kind === 'network' || this.kind === 'timeout' || this.kind === 'server' || this.kind === 'rate';
  }
}

export function classify(status: number): ApiErrorKind {
  if (status === 401) return 'auth';
  if (status === 403) return 'disabled';
  if (status === 404 || status === 410) return 'not-found';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate';
  if (status === 400 || status === 422) return 'invalid';
  return 'server';
}

function messageOf(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const m = b.message ?? (b.error as Record<string, unknown> | undefined)?.message;
    if (typeof m === 'string' && m) return m;
    if (Array.isArray(m) && typeof m[0] === 'string') return m[0];
  }
  return fallback;
}

export type MenuResult = { status: 'ok'; data: MenuPayload } | { status: 'not-modified' };

export interface MenuApi {
  readonly mock: boolean;
  getMenu(etag?: string | null, signal?: AbortSignal): Promise<MenuResult>;
  createGuest(displayName?: string): Promise<GuestSession>;
  getState(guestToken: string, signal?: AbortSignal): Promise<TableState>;
  placeOrder(guestToken: string, body: PlaceOrderBody, idempotencyKey: string): Promise<PlaceOrderResult>;
  callWaiter(guestToken: string | null, reason: WaiterReason): Promise<void>;
  payIntent(guestToken: string | null): Promise<PayIntent>;
  /** Opens the live stream; returns a closer. Events are hints: the client re-reads state after them. */
  openStream(handlers: StreamHandlers): () => void;
}

const TIMEOUT_MS = 15000;

async function request<T>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<{ status: number; body: T | null; headers: Headers }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort('timeout'), init.timeoutMs ?? TIMEOUT_MS);
  const outer = init.signal;
  const onOuter = () => ctl.abort('aborted');
  if (outer) {
    if (outer.aborted) ctl.abort('aborted');
    else outer.addEventListener('abort', onOuter, { once: true });
  }
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: ctl.signal, credentials: 'omit' });
  } catch (e) {
    if (outer?.aborted) throw e;
    if (ctl.signal.aborted) throw new ApiError('timeout', 0, 'The connection is slow.');
    throw new ApiError('network', 0, 'No connection.');
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onOuter);
  }
  if (res.status === 304) return { status: 304, body: null, headers: res.headers };
  let body: unknown = null;
  const text = await res.text().catch(() => '');
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  if (!res.ok) {
    const ra = Number(res.headers.get('Retry-After'));
    throw new ApiError(classify(res.status), res.status, messageOf(body, `Request failed (${res.status}).`), Number.isFinite(ra) && ra > 0 ? ra : undefined);
  }
  return { status: res.status, body: body as T, headers: res.headers };
}

export function createHttpApi(tableToken: string): MenuApi {
  const base = `${API_BASE}/public/menu/${encodeURIComponent(tableToken)}`;
  const jsonHeaders = (guest?: string | null, extra?: Record<string, string>): Record<string, string> => ({
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(guest ? { 'X-Guest-Token': guest } : {}),
    ...extra,
  });
  return {
    mock: false,
    async getMenu(etag, signal) {
      const r = await request<MenuPayload>(base, {
        method: 'GET',
        signal,
        headers: { Accept: 'application/json', ...(etag ? { 'If-None-Match': etag } : {}) },
      });
      if (r.status === 304 || !r.body) return { status: 'not-modified' };
      return { status: 'ok', data: { ...r.body, etag: r.body.etag ?? r.headers.get('ETag') ?? '' } };
    },
    async createGuest(displayName) {
      const r = await request<GuestSession>(`${base}/guest`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify(displayName ? { displayName } : {}),
      });
      if (!r.body?.guestToken) throw new ApiError('server', 500, 'Could not start your table session.');
      return r.body;
    },
    async getState(guestToken, signal) {
      const r = await request<Partial<TableState>>(`${base}/state`, { method: 'GET', signal, headers: jsonHeaders(guestToken) });
      return { orders: r.body?.orders ?? [], bill: r.body?.bill ?? null, waiterCall: r.body?.waiterCall ?? null };
    },
    async placeOrder(guestToken, body, idempotencyKey) {
      const r = await request<PlaceOrderResult>(`${base}/orders`, {
        method: 'POST',
        headers: jsonHeaders(guestToken, { 'Idempotency-Key': idempotencyKey }),
        body: JSON.stringify(body),
      });
      if (!r.body) throw new ApiError('server', 500, 'The restaurant did not confirm your order. Check "Your table" before retrying.');
      return r.body;
    },
    async callWaiter(guestToken, reason) {
      await request(`${base}/waiter`, { method: 'POST', headers: jsonHeaders(guestToken), body: JSON.stringify({ reason }) });
    },
    async payIntent(guestToken) {
      const r = await request<PayIntent>(`${base}/pay-intent`, {
        method: 'POST',
        headers: jsonHeaders(guestToken),
        body: JSON.stringify({ method: 'upi' }),
      });
      if (!r.body?.upiUri) throw new ApiError('server', 500, 'UPI is not available right now.');
      return r.body;
    },
    openStream(h) {
      if (typeof EventSource === 'undefined') {
        h.onError();
        return () => undefined;
      }
      const es = new EventSource(`${base}/stream`);
      es.onopen = () => h.onOpen();
      es.onerror = () => h.onError();
      const parse = (e: MessageEvent): unknown => {
        try {
          return JSON.parse(e.data as string);
        } catch {
          return null;
        }
      };
      for (const name of STREAM_EVENTS) es.addEventListener(name, (e) => h.onEvent(name, parse(e as MessageEvent)));
      // Servers that send unnamed `data: {"type": "..."}` frames.
      es.onmessage = (e) => {
        const d = parse(e) as { type?: string; event?: string } | null;
        const name = (d?.type ?? d?.event) as StreamEventName | undefined;
        if (name && STREAM_EVENTS.includes(name)) h.onEvent(name, d);
      };
      return () => es.close();
    },
  };
}

export interface MockOptions { mode: 'confirm' | 'auto' | 'off' | 'closed'; fast: boolean; slowMs: number; offline: boolean }

export function parseMockOptions(search: string): MockOptions {
  const q = new URLSearchParams(search);
  const m = q.get('mode');
  return {
    mode: m === 'auto' || m === 'off' || m === 'closed' ? m : 'confirm',
    fast: q.get('fast') === '1',
    slowMs: Number(q.get('slow')) || 0,
    offline: q.get('offline') === '1',
  };
}

/** The mock lives in its own lazy chunk: production visitors never download it. */
export async function loadApi(tableToken: string, mock: MockOptions | null): Promise<MenuApi> {
  if (mock) {
    const { createMockApi } = await import('./mock');
    return createMockApi(mock);
  }
  return createHttpApi(tableToken);
}

export type { StreamEventName };
