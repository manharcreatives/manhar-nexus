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
  refreshState(): Promise<void>;
  placeOrder(body: PlaceOrderBody, idempotencyKey: string): Promise<PlaceOrderResult>;
  callWaiter(reason: WaiterReason): Promise<void>;
  payIntent(): Promise<PayIntent>;
}

/**
 * Owns everything that talks to the server: menu (ETag + cache), guest identity, table state, live stream
 * with polling fallback. Components get plain data and a few promise-returning actions.
 */
export function useSession(tableToken: string, mock: MockOptions | null): Session {
  const [phase, setPhase] = useState<Phase>('loading');
  const [menu, setMenu] = useState<MenuPayload | null>(null);
  const [stale, setStale] = useState(false);
  const [conn, setConn] = useState<Conn>('polling');
  const [state, setState] = useState<TableState | null>(null);
  const [attempt, setAttempt] = useState(0);

  const apiRef = useRef<MenuApi | null>(null);
  const etagRef = useRef<string | null>(null);
  const guestRef = useRef<string | null>(null);
  const guestPromise = useRef<Promise<string | null> | null>(null);
  const menuRef = useRef<MenuPayload | null>(null);
  const liveRef = useRef(false);
  const failures = useRef(0);

  // 1. Create the api and paint the cached menu at once (stale-while-revalidate).
  useEffect(() => {
    let dead = false;
    const cached = readJson<CachedMenu>(keys.menu(tableToken));
    const g = readJson<GuestSession>(keys.guest(tableToken));
    guestRef.current = g?.guestToken ?? null;
    if (cached?.data?.items) {
      menuRef.current = cached.data;
      etagRef.current = cached.etag;
      setMenu(cached.data);
      setStale(true);
      setPhase('ready');
    }
    loadApi(tableToken, mock).then((api) => {
      if (!dead) {
        apiRef.current = api;
        setAttempt((n) => n + 1);
      }
    });
    return () => {
      dead = true;
    };
  }, [tableToken]);

  const ensureGuest = useCallback(async (force = false): Promise<string | null> => {
    const api = apiRef.current;
    if (!api) return null;
    if (guestRef.current && !force) return guestRef.current;
    if (!guestPromise.current) {
      guestPromise.current = api
        .createGuest()
        .then((g) => {
          guestRef.current = g.guestToken;
          writeJson(keys.guest(tableToken), g);
          return g.guestToken;
        })
        .catch(() => null)
        .finally(() => {
          guestPromise.current = null;
        });
    }
    return guestPromise.current;
  }, [tableToken]);

  const refreshState = useCallback(async () => {
    const api = apiRef.current;
    const m = menuRef.current;
    if (!api || !m || !m.table.open) return;
    try {
      let token = await ensureGuest();
      if (!token) return;
      try {
        setState(await api.getState(token));
      } catch (e) {
        if (e instanceof ApiError && e.kind === 'auth') {
          removeKey(keys.guest(tableToken));
          token = await ensureGuest(true);
          if (token) setState(await api.getState(token));
        } else throw e;
      }
      failures.current = 0;
    } catch (e) {
      if (e instanceof ApiError && e.transient) failures.current += 1;
    }
  }, [ensureGuest, tableToken]);

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
      if (navigator.onLine !== false) setConn((c) => (c === 'offline' ? (liveRef.current ? 'live' : 'polling') : c));
    } catch (e) {
      if (e instanceof ApiError && (e.kind === 'not-found' || e.kind === 'disabled')) {
        removeKey(keys.menu(tableToken));
        setPhase(e.kind);
        return;
      }
      failures.current += 1;
      setConn('offline');
      setPhase((p) => (menuRef.current ? p : 'unreachable'));
    }
  }, [tableToken]);

  // 2. First fetch, and retries while there is nothing to show.
  useEffect(() => {
    if (!apiRef.current) return;
    void loadMenu().then(() => void refreshState());
  }, [attempt, loadMenu, refreshState]);

  // 3. Live stream with polling fallback.
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    let errors = 0;
    let t: ReturnType<typeof setTimeout> | undefined;
    const soon = (fn: () => void) => {
      clearTimeout(t);
      t = setTimeout(fn, 250);
    };
    const onEvent = (name: StreamEventName) => {
      if (name === 'menu.changed' || name === 'table.updated') {
        void loadMenu().then(() => void refreshState());
      } else soon(() => void refreshState());
    };
    const close = api.openStream({
      onOpen: () => {
        errors = 0;
        liveRef.current = true;
        setConn(navigator.onLine === false ? 'offline' : 'live');
        soon(() => void refreshState());
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
      close();
    };
  }, [attempt, loadMenu, refreshState]);

  // 4. Safety-net polling (fast when the stream is down), plus refresh on focus / reconnect.
  useEffect(() => {
    if (!apiRef.current) return;
    let tick = 0;
    const id = setInterval(() => {
      if (document.hidden) return;
      tick += 1;
      const everyState = liveRef.current ? 9 : 2; // x5s
      const everyMenu = liveRef.current ? 24 : 6;
      if (tick % everyState === 0) void refreshState();
      if (tick % everyMenu === 0 || (!menuRef.current && tick % 2 === 0)) void loadMenu();
    }, 5000);
    const wake = () => {
      if (document.hidden) return;
      void loadMenu().then(() => void refreshState());
    };
    const goOffline = () => setConn('offline');
    const goOnline = () => {
      setConn(liveRef.current ? 'live' : 'polling');
      wake();
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    if (navigator.onLine === false) setConn('offline');
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [attempt, loadMenu, refreshState]);

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
          token = await ensureGuest(true);
          if (token) return api.placeOrder(token, body, key); // same Idempotency-Key: safe to repeat
        }
        throw e;
      }
    },
    [ensureGuest],
  );

  const callWaiter = useCallback(
    async (reason: WaiterReason) => {
      const api = apiRef.current;
      if (!api) throw new ApiError('network', 0, 'Still connecting.');
      await api.callWaiter(await ensureGuest(), reason);
      await refreshState();
    },
    [ensureGuest, refreshState],
  );

  const payIntent = useCallback(async () => {
    const api = apiRef.current;
    if (!api) throw new ApiError('network', 0, 'Still connecting.');
    return api.payIntent(await ensureGuest());
  }, [ensureGuest]);

  const canOrder = !!menu && menu.table.open && menu.settings.ordering !== 'off';

  return useMemo(
    () => ({ phase, menu, stale, conn, state, canOrder, mock: !!mock, retry, refreshState, placeOrder, callWaiter, payIntent }),
    [phase, menu, stale, conn, state, canOrder, mock, retry, refreshState, placeOrder, callWaiter, payIntent],
  );
}
