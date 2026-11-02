import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, loadApi, type MenuApi, type MockOptions } from './api';
import { keys, readJson, removeKey, writeJson } from './storage';
import type { GuestSession, MenuPayload, PayIntent, PlaceOrderBody, PlaceOrderResult, StreamEventName, TableState, WaiterReason } from './types';

export type Phase = 'loading' | 'ready' | 'not-found' | 'disabled' | 'unreachable';
export type Conn = 'live' | 'polling' | 'offline';

interface CachedMenu { etag: string; data: MenuPayload }

export interface Session {
  phase: Phase;
  menu: MenuPayload | null;
  /** True while showing a cached menu that has not been confirmed with the server yet. */
  stale: boolean;
  conn: Conn;
  state: TableState | null;
  /** The table is open and the restaurant allows guest orders. */
  canOrder: boolean;
  mock: boolean;
  retry(): void;
  /** Re-read the menu, then the table state (after an error that suggests the menu moved on). */
  refreshMenu(): Promise<void>;
  refreshState(): Promise<void>;
  placeOrder(body: PlaceOrderBody, idempotencyKey: string): Promise<PlaceOrderResult>;
  callWaiter(reason: WaiterReason): Promise<void>;
  payIntent(): Promise<PayIntent>;
}

const GUEST_SLACK_MS = 60_000;
const usable = (g: GuestSession | null): g is GuestSession =>
  !!g?.guestToken && (!g.expiresAt || Date.parse(g.expiresAt) - Date.now() > GUEST_SLACK_MS || Number.isNaN(Date.parse(g.expiresAt)));

/**
 * Owns everything that talks to the server: menu (ETag + cache), guest identity, table state, live stream
 * with polling fallback. Components get plain data and a few promise-returning actions.
 *
 * Live updates: the stream carries hints only (ids/statuses), so every hint triggers a re-read of /state (or the
 * menu). Polling runs underneath as a safety net: slowly while the stream is up, quickly while it is down.
 */
export function useSession(tableToken: string, mock: MockOptions | null): Session {
  const [phase, setPhase] = useState<Phase>('loading');
  const [menu, setMenu] = useState<MenuPayload | null>(null);
  const [stale, setStale] = useState(false);
  const [conn, setConn] = useState<Conn>('polling');
  const [state, setState] = useState<TableState | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [epoch, setEpoch] = useState(0);

  const apiRef = useRef<MenuApi | null>(null);
  const etagRef = useRef<string | null>(null);
  const guestRef = useRef<string | null>(null);
  const guestPromise = useRef<Promise<string | null> | null>(null);
  const guestFailUntil = useRef(0);
  const menuRef = useRef<MenuPayload | null>(null);
  const phaseRef = useRef<Phase>('loading');
  const liveRef = useRef(false);
  const failures = useRef(0);
  const stateSeq = useRef(0);
  const awaitingRef = useRef(false);
  const loadMenuRef = useRef<() => Promise<void>>(async () => undefined);
  phaseRef.current = phase;
  // The API sends no event when a waiter edits an order before confirming it, so while one of ours waits for the
  // waiter we re-read the state every 10 s even though the stream is up.
  awaitingRef.current = !!state?.orders.some((o) => o.mine && o.status === 'AWAITING_CONFIRMATION');

  // 1. Create the api and paint the cached menu at once (stale-while-revalidate).
  useEffect(() => {
    let dead = false;
    const cached = readJson<CachedMenu>(keys.menu(tableToken));
    const g = readJson<GuestSession>(keys.guest(tableToken));
    guestRef.current = usable(g) ? g.guestToken : null;
    if (cached?.data?.items && cached.data.categories) {
      menuRef.current = cached.data;
      etagRef.current = cached.etag;
      setMenu(cached.data);
      setStale(true);
      setPhase('ready');
    }
    void loadApi(tableToken, mock).then((api) => {
      if (!dead) {
        apiRef.current = api;
        setAttempt((n) => n + 1);
      }
    });
    return () => {
      dead = true;
    };
  }, [tableToken]);

  const ensureGuest = useCallback(
    async (force = false): Promise<string | null> => {
      const api = apiRef.current;
      if (!api) return null;
      if (guestRef.current && !force) return guestRef.current;
      if (!force && Date.now() < guestFailUntil.current) return null;
      if (!guestPromise.current) {
        guestPromise.current = api
          .createGuest()
          .then((g) => {
            guestRef.current = g.guestToken;
            guestFailUntil.current = 0;
            writeJson(keys.guest(tableToken), g);
            return g.guestToken;
          })
          .catch((e: unknown) => {
            // 409 TABLE_CLOSED: the menu we show is stale. 429: wait as told. Anything else: try again shortly.
            const wait = e instanceof ApiError && e.retryAfterSec ? e.retryAfterSec * 1000 : 8000;
            guestFailUntil.current = Date.now() + wait;
            if (e instanceof ApiError && e.code === 'TABLE_CLOSED') void loadMenuRef.current();
            return null;
          })
          .finally(() => {
            guestPromise.current = null;
          });
      }
      return guestPromise.current;
    },
    [tableToken],
  );

  const dropGuest = useCallback(() => {
    guestRef.current = null;
    removeKey(keys.guest(tableToken));
  }, [tableToken]);

  const refreshState = useCallback(async () => {
    const api = apiRef.current;
    const m = menuRef.current;
    if (!api || !m || !m.table.open) return;
    const seq = ++stateSeq.current;
    const apply = (s: TableState) => {
      if (seq === stateSeq.current) setState(s); // a slower, older answer must not overwrite a newer one
    };
    try {
      let token = await ensureGuest();
      if (!token) return;
      try {
        apply(await api.getState(token));
      } catch (e) {
        if (e instanceof ApiError && e.kind === 'auth') {
          // 401 GUEST_TOKEN_INVALID: the visit ended, the QR was rotated or the token expired. Issue a new one.
          dropGuest();
          token = await ensureGuest(true);
          if (token) apply(await api.getState(token));
        } else throw e;
      }
      failures.current = 0;
      // A request that succeeded proves we are online, whatever navigator.onLine claims (it is unreliable).
      setConn((c) => (c === 'offline' ? (liveRef.current ? 'live' : 'polling') : c));
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.kind === 'not-found' || e.kind === 'disabled') void loadMenuRef.current();
        else if (e.transient) failures.current += 1;
      }
    }
  }, [ensureGuest, dropGuest]);

  const loadMenu = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;
    try {
      const r = await api.getMenu(etagRef.current);
      if (r.status === 'ok') {
        etagRef.current = r.data.etag;
        menuRef.current = r.data;
        setMenu(r.data);
        writeJson(keys.menu(tableToken), { etag: r.data.etag, data: r.data });
        if (!r.data.table.open) setState(null);
      }
      setStale(false);
      setPhase('ready');
      failures.current = 0;
      // A request that succeeded proves we are online, whatever navigator.onLine claims (it is unreliable).
      setConn((c) => (c === 'offline' ? (liveRef.current ? 'live' : 'polling') : c));
    } catch (e) {
      if (e instanceof ApiError && (e.kind === 'not-found' || e.kind === 'disabled')) {
        // 404: unknown or ROTATED QR. 403 MENU_DISABLED: the restaurant or this table switched the menu off.
        removeKey(keys.menu(tableToken));
        removeKey(keys.guest(tableToken));
        menuRef.current = null;
        etagRef.current = null;
        setMenu(null);
        setState(null);
        setPhase(e.kind);
        return;
      }
      failures.current += 1;
      setConn('offline');
      setPhase((p) => (menuRef.current ? p : 'unreachable'));
    }
  }, [tableToken]);
  loadMenuRef.current = loadMenu;

  const refreshMenu = useCallback(async () => {
    await loadMenu();
    await refreshState();
  }, [loadMenu, refreshState]);

  // 2. First fetch (and again on retry).
  useEffect(() => {
    if (!apiRef.current) return;
    void refreshMenu();
  }, [attempt, refreshMenu]);

  // 3. Live stream (hints) with reconnect/backoff inside the client; polling below is the fallback.
  const streaming = phase === 'ready';
  useEffect(() => {
    const api = apiRef.current;
    if (!api || !streaming) return;
    let errors = 0;
    let t: ReturnType<typeof setTimeout> | undefined;
    const soon = (fn: () => void) => {
      clearTimeout(t);
      t = setTimeout(fn, 250);
    };
    const onEvent = (name: StreamEventName, data: unknown) => {
      switch (name) {
        case 'menu.changed':
        case 'table.updated':
          soon(() => void refreshMenu());
          break;
        case 'order.updated':
        case 'bill.updated':
        case 'waiter.call':
        case 'waiter.ack':
          soon(() => void refreshState());
          break;
        case 'bye': {
          // 'refresh' = routine recycle (the client reopens at once). Anything else: the token changed or the menu
          // went away, so find out what the menu says now (404/403 flips the page to its error state).
          const reason = (data as { reason?: string } | null)?.reason;
          if (reason !== 'refresh') soon(() => void refreshMenu());
          break;
        }
        default:
          break;
      }
    };
    const close = api.openStream({
      onOpen: () => {
        errors = 0;
        liveRef.current = true;
        setConn(navigator.onLine === false ? 'offline' : 'live');
        soon(() => void refreshState()); // anything that happened while the stream was down
      },
      onEvent,
      onError: () => {
        errors += 1;
        if (errors >= 2) {
          liveRef.current = false;
          setConn(navigator.onLine === false ? 'offline' : 'polling');
        }
      },
    });
    return () => {
      clearTimeout(t);
      liveRef.current = false;
      close();
    };
  }, [attempt, epoch, streaming, refreshMenu, refreshState]);

  // 4. Safety-net polling (fast when the stream is down), plus refresh on focus / reconnect.
  useEffect(() => {
    if (!apiRef.current) return;
    let tick = 0;
    let hiddenAt = 0;
    const id = setInterval(() => {
      if (document.hidden) return;
      const p = phaseRef.current;
      if (p === 'not-found') return; // a rotated QR stays dead: the guest has to scan the new one
      tick += 1;
      const everyState = liveRef.current && !awaitingRef.current ? 9 : 2; // x5 s
      const everyMenu = p === 'disabled' ? 12 : liveRef.current ? 24 : 6;
      if (p === 'ready' && tick % everyState === 0) void refreshState();
      if (tick % everyMenu === 0 || (!menuRef.current && p === 'unreachable' && tick % 2 === 0)) void loadMenu();
    }, 5000);
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        return;
      }
      if (phaseRef.current === 'not-found') return;
      // A phone that slept has probably lost the socket without being told: reopen the stream and re-read everything.
      if (hiddenAt && Date.now() - hiddenAt > 30_000) setEpoch((n) => n + 1);
      hiddenAt = 0;
      void refreshMenu();
    };
    const goOffline = () => setConn('offline');
    const goOnline = () => {
      setConn(liveRef.current ? 'live' : 'polling');
      setEpoch((n) => n + 1);
      void refreshMenu();
      setTimeout(() => void refreshMenu(), 1500); // a request that started while offline may still fail after this
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    if (navigator.onLine === false) setConn('offline');
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [attempt, loadMenu, refreshMenu, refreshState]);

  const retry = useCallback(() => {
    setPhase((p) => (p === 'ready' ? p : 'loading'));
    setAttempt((n) => n + 1);
  }, []);

  const placeOrder = useCallback(
    async (body: PlaceOrderBody, key: string) => {
      const api = apiRef.current;
      if (!api) throw new ApiError('network', 0, 'Still connecting. Try again in a moment.');
      let token = await ensureGuest();
      if (!token) throw new ApiError('network', 0, 'Could not start your table session. Check your connection and try again.');
      try {
        return await api.placeOrder(token, body, key);
      } catch (e) {
        if (e instanceof ApiError && e.kind === 'auth') {
          dropGuest();
          token = await ensureGuest(true);
          // The first attempt was refused before anything was stored, so repeating it with the same key is safe.
          if (token) return api.placeOrder(token, body, key);
        }
        throw e;
      }
    },
    [ensureGuest, dropGuest],
  );

  const callWaiter = useCallback(
    async (reason: WaiterReason) => {
      const api = apiRef.current;
      if (!api) throw new ApiError('network', 0, 'Still connecting.');
      await api.callWaiter(await ensureGuest(), reason); // identity is optional for the waiter call
      await refreshState();
    },
    [ensureGuest, refreshState],
  );

  const payIntent = useCallback(async () => {
    const api = apiRef.current;
    if (!api) throw new ApiError('network', 0, 'Still connecting.');
    try {
      return await api.payIntent(await ensureGuest());
    } catch (e) {
      if (e instanceof ApiError && e.kind === 'auth') {
        dropGuest();
        return api.payIntent(await ensureGuest(true));
      }
      throw e;
    }
  }, [ensureGuest, dropGuest]);

  const canOrder = !!menu && menu.table.open && menu.settings.ordering !== 'off';

  return useMemo(
    () => ({ phase, menu, stale, conn, state, canOrder, mock: !!mock, retry, refreshMenu, refreshState, placeOrder, callWaiter, payIntent }),
    [phase, menu, stale, conn, state, canOrder, mock, retry, refreshMenu, refreshState, placeOrder, callWaiter, payIntent],
  );
}
