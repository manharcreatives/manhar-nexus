import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ChevronRight, Info, ShoppingBag, WifiOff } from 'lucide-react';
import type { MockOptions } from './api';
import {
  EMPTY_CART, MAX_LINES, MAX_TOTAL_QTY, cartReducer, cartSignature, cartTotals, lineKey, newIdempotencyKey, qtyByItem, reconcileCart, toOrderBody,
  type CartState,
} from './cart';
import { orderFailure } from './errors';
import { formatPrice } from './format';
import { haptic, onScrollFrame, prefersReducedMotion } from './motion';
import { isActive, statusLabel } from './status';
import { keys, readJson, removeKey, writeJson } from './storage';
import { T } from './strings';
import { useSession } from './useSession';
import type { MenuItem, MenuPayload } from './types';
import { CartSheet } from './components/CartSheet';
import { DishCard } from './components/DishCard';
import { Hero, TopBar } from './components/Hero';
import { ItemSheet } from './components/ItemSheet';
import { Rail } from './components/Rail';
import { SignatureRing } from './components/SignatureRing';
import { TableSheet } from './components/TableSheet';

// QR rendering (the `qrcode` library) only loads when a customer opens "Pay by UPI".
const PaySheet = lazy(() => import('./components/PaySheet'));

const BAR_H = 56;
const RAIL_H = 56;

function Skeleton() {
  return (
    <div className="gm-skel" role="status" aria-label={T.loading}>
      <div className="gm-skel__hero"><span className="gm-skel__pulse" /></div>
      <div className="gm-skel__rows">
        {[0, 1, 2].map((i) => <span key={i} className="gm-skel__card" />)}
      </div>
    </div>
  );
}

function Fatal({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }) {
  return (
    <main className="gm-fatal">
      <p className="gm-eyebrow">Nexus Menu</p>
      <h1>{title}</h1>
      <p className="gm-lede">{body}</p>
      {onRetry ? <button type="button" className="gm-cta gm-press" onClick={onRetry}>{T.retry}</button> : null}
    </main>
  );
}

function loadPlaced(token: string): Record<string, number> {
  const p = readJson<Record<string, number>>(keys.placed(token));
  return p && typeof p === 'object' ? p : {};
}

function loadCart(token: string): CartState {
  const c = readJson<CartState>(keys.cart(token));
  return c && Array.isArray(c.lines) ? { lines: c.lines, note: c.note ?? '' } : EMPTY_CART;
}

function matches(item: MenuItem, q: string): boolean {
  if (!q) return true;
  const hay = `${item.name} ${item.description ?? ''} ${item.tags.join(' ')}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
}

export default function GuestMenu({ token, mock }: { token: string; mock: MockOptions | null }) {
  const session = useSession(token, mock);
  const { menu } = session;
  useEffect(() => {
    if (menu?.business.name) document.title = `${menu.business.name} · Menu`;
  }, [menu?.business.name]);

  const [cart, dispatch] = useReducer(cartReducer, token, loadCart);
  useEffect(() => writeJson(keys.cart(token), cart), [cart, token]);

  const [placed, setPlaced] = useState<Record<string, number>>(() => loadPlaced(token));
  const [itemOpen, setItemOpen] = useState<MenuItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [tab, setTab] = useState<'orders' | 'bill'>('orders');
  const [payOpen, setPayOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [vegOnly, setVegOnly] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  const items = useMemo(() => new Map((menu?.items ?? []).map((i) => [i.id, i])), [menu]);
  const totals = useMemo(() => cartTotals(cart, items), [cart, items]);
  const perItem = useMemo(() => qtyByItem(cart), [cart]);
  const currency = menu?.business.currency ?? 'INR';
  const tableIsOpen = !!menu?.table.open;
  const mode = menu?.settings.ordering ?? 'off';
  const canOrder = session.canOrder;

  // Restaurant accent colour (lib/brand is tiny and already in the entry bundle).
  useEffect(() => {
    const hex = menu?.business.accentColor;
    if (!hex) return;
    let off: (() => void) | undefined;
    void import('../lib/brand').then(({ applyAccent }) => {
      applyAccent(hex);
      off = () => applyAccent(null);
    });
    return () => off?.();
  }, [menu?.business.accentColor]);

  // Items that disappeared / sold out are dropped from the cart, with a visible note.
  useEffect(() => {
    if (!menu) return;
    const r = reconcileCart(cart, menu.items);
    if (r.changed) {
      dispatch({ type: 'replace', state: r.state });
      setNotice(T.removed(r.removed));
    }
  }, [menu?.etag]);

  // Toast auto-hide.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1900);
    return () => clearTimeout(t);
  }, [toast]);

  // ── data shaping ──
  const sections = useMemo(() => {
    if (!menu) return [];
    return menu.categories
      .map((c) => ({ cat: c, items: menu.items.filter((i) => i.categoryId === c.id && matches(i, query) && (!vegOnly || i.veg === 'veg')) }))
      .filter((s) => s.items.length > 0);
  }, [menu, query, vegOnly]);
  const signatures = useMemo(() => {
    if (!menu) return [];
    const withPhoto = menu.items.filter((i) => i.imageUrl && !i.soldOut);
    const tagged = withPhoto.filter((i) => i.tags.some((t) => /signature|chef|special|must/i.test(t)));
    return (tagged.length >= 3 ? tagged : []).slice(0, 8);
  }, [menu]);

  // ── scroll: hero parallax, compact bar, scroll-spy ──
  const rootRef = useRef<HTMLDivElement>(null);
  const spyLock = useRef(0);
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const phaseReady = session.phase === 'ready' && !!menu;
  useEffect(() => {
    if (!phaseReady) return;
    const root = rootRef.current;
    if (!root) return;
    return onScrollFrame((y, vh) => {
      const hero = root.querySelector<HTMLElement>('.gm-hero');
      const h = hero?.offsetHeight ?? vh;
      const p = Math.max(0, Math.min(1, y / h));
      hero?.style.setProperty('--hp', p.toFixed(3));
      const compact = y > h - BAR_H - 24;
      if ((root.dataset.compact === '1') !== compact) root.dataset.compact = compact ? '1' : '0';
      if (performance.now() < spyLock.current) return;
      let cur: string | null = null;
      const line = BAR_H + RAIL_H + 32;
      for (const s of sectionsRef.current) {
        const el = document.getElementById(`cat-${s.cat.id}`);
        if (el && el.getBoundingClientRect().top <= line) cur = s.cat.id;
      }
      setActive((a) => (a === cur ? a : cur));
    });
  }, [phaseReady]);
  useEffect(() => {
    if (!active && sections[0]) setActive(sections[0].cat.id);
  }, [active, sections]);

  const smooth = (): ScrollBehavior => (prefersReducedMotion() ? 'auto' : 'smooth');
  const pickCategory = useCallback((id: string) => {
    spyLock.current = performance.now() + 900;
    setActive(id);
    document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: smooth(), block: 'start' });
  }, []);
  const explore = useCallback(() => {
    spyLock.current = performance.now() + 900;
    const target = document.getElementById(signatures.length ? 'gm-sig' : 'gm-menu');
    target?.scrollIntoView({ behavior: smooth(), block: 'start' });
  }, [signatures.length]);

  // ── cart actions ──
  const addItem = useCallback((item: MenuItem, sel: { variantId?: string; addOnOptionIds: string[]; qty: number; note?: string }) => {
    dispatch({ type: 'add', itemId: item.id, variantId: sel.variantId, addOnOptionIds: sel.addOnOptionIds, qty: sel.qty, note: sel.note });
    haptic();
    setToast(T.addedToast(item.name));
    setItemOpen(null);
  }, []);
  const quickAdd = useCallback((item: MenuItem) => {
    dispatch({ type: 'add', itemId: item.id, addOnOptionIds: [], qty: 1 });
    haptic();
    setToast(T.addedToast(item.name));
  }, []);
  const cartRef = useRef(cart);
  cartRef.current = cart;
  const setItemQty = useCallback((item: MenuItem, qty: number) => {
    const lines = cartRef.current.lines.filter((l) => l.itemId === item.id);
    const total = lines.reduce((s, l) => s + l.qty, 0);
    if (qty > total) dispatch({ type: 'add', itemId: item.id, addOnOptionIds: [], qty: qty - total });
    else {
      const base = lines.find((l) => l.key === lineKey(item.id, undefined, [])) ?? lines[lines.length - 1];
      if (base) dispatch({ type: 'qty', key: base.key, qty: base.qty - (total - qty) });
    }
    haptic(5);
  }, []);
  const openItem = useCallback((item: MenuItem) => setItemOpen(item), []);

  // ── order submit (Idempotency-Key survives retries of the SAME cart) ──
  const sendOrder = useCallback(async () => {
    if (sending || !cart.lines.length) return;
    setSending(true);
    setError(null);
    const sig = cartSignature(cart);
    let idem = readJson<{ sig: string; key: string }>(keys.idem(token));
    if (!idem || idem.sig !== sig) {
      idem = { sig, key: newIdempotencyKey() };
      writeJson(keys.idem(token), idem);
    }
    try {
      const r = await session.placeOrder(toOrderBody(cart), idem.key);
      removeKey(keys.idem(token));
      // Remember what we submitted: if the waiter edits the order before confirming, the table view says so.
      setPlaced((p) => {
        const next = { ...Object.fromEntries(Object.entries(p).slice(-30)), [r.orderId]: r.totalMinor };
        writeJson(keys.placed(token), next);
        return next;
      });
      dispatch({ type: 'clear' });
      setNotice(null);
      setCartOpen(false);
      setTab('orders');
      setHighlight(r.orderId);
      setTableOpen(true);
      haptic(14);
      void session.refreshState();
    } catch (e) {
      const f = orderFailure(e, T.sendFailed, T.sendFailedNet);
      setError(f.message);
      if (f.newKey) removeKey(keys.idem(token)); // the server judged this exact cart: a corrected cart is a new request
      if (f.refreshMenu) void session.refreshMenu(); // sold out / table closed / ordering off: show the truth, drop dead lines
    } finally {
      setSending(false);
    }
  }, [cart, sending, session, token]);

  const activeOrders = (session.state?.orders ?? []).filter(isActive).length;
  const latestActive = [...(session.state?.orders ?? [])].reverse().find(isActive);

  // Pull-up gesture on the dock opens the order sheet.
  const dragY = useRef<number | null>(null);
  const onDockDown = (e: React.PointerEvent) => { dragY.current = e.clientY; };
  const onDockMove = (e: React.PointerEvent) => {
    if (dragY.current !== null && dragY.current - e.clientY > 22) {
      dragY.current = null;
      setError(null);
      setCartOpen(true);
    }
  };
  const getIntent = useCallback(() => session.payIntent(), [session]);

  if (session.phase === 'not-found') return <Fatal title={T.notFoundTitle} body={T.notFoundBody} />;
  if (session.phase === 'disabled') return <Fatal title={T.disabledTitle} body={T.disabledBody} />;
  if (session.phase === 'unreachable' && !menu) return <Fatal title={T.unreachableTitle} body={T.unreachableBody} onRetry={session.retry} />;
  if (!menu) return <Skeleton />;

  const showDock = !cartOpen && !tableOpen && !itemOpen && !payOpen;
  return (
    <div ref={rootRef} className="gm-root" data-compact="0" data-mode={mode} data-closed={!tableIsOpen || undefined} style={{ ['--bar-h' as string]: `${BAR_H}px`, ['--rail-h' as string]: `${RAIL_H}px` }}>
      <a className="gm-skip" href="#gm-menu">Skip to menu</a>
      {session.conn === 'offline' ? (
        <p className="gm-conn" role="status"><WifiOff size={14} aria-hidden="true" /> {T.offline}</p>
      ) : null}
      <TopBar menu={menu} tableOpen={tableIsOpen} activeOrders={activeOrders} onTable={() => { setTab('orders'); setTableOpen(true); }} />
      <Hero menu={menu} onExplore={explore} />

      <main id="gm-main" className="gm-main">
        {!tableIsOpen ? (
          <div className="gm-banner" role="status">
            <Info size={18} aria-hidden="true" />
            <div><strong>{T.tableClosedTitle}</strong><p>{T.tableClosedBody}</p></div>
          </div>
        ) : mode === 'off' ? (
          <div className="gm-banner" role="status">
            <Info size={18} aria-hidden="true" />
            <div><strong>{T.orderingOffTitle}</strong><p>{T.orderingOffBody}</p></div>
          </div>
        ) : null}

        {signatures.length >= 3 && !query && !vegOnly ? (
          <div id="gm-sig">
            <SignatureRing items={signatures} currency={currency} onOpen={openItem} />
          </div>
        ) : null}

        <Rail
          categories={sections.map((s) => s.cat)}
          active={active}
          onPick={pickCategory}
          query={query}
          onQuery={setQuery}
          searchOpen={searchOpen}
          onSearchOpen={(o) => { setSearchOpen(o); if (!o) setQuery(''); }}
          vegOnly={vegOnly}
          onVegOnly={setVegOnly}
        />

        <div id="gm-menu" className="gm-menu">
          {sections.length === 0 ? <p className="gm-empty">{T.noResults}</p> : null}
          {sections.map((s, si) => (
            <section key={s.cat.id} id={`cat-${s.cat.id}`} className="gm-sec" aria-labelledby={`cat-h-${s.cat.id}`}>
              <header className="gm-sec-head">
                <p className="gm-eyebrow tabular">{String(si + 1).padStart(2, '0')}</p>
                <h2 id={`cat-h-${s.cat.id}`}>{s.cat.name}</h2>
                {s.cat.description ? <p className="gm-lede">{s.cat.description}</p> : null}
              </header>
              <div className="gm-grid">
                {s.items.map((it, i) => (
                  <DishCard
                    key={it.id}
                    item={it}
                    index={i}
                    currency={currency}
                    qty={perItem.get(it.id) ?? 0}
                    canOrder={canOrder}
                    onOpen={openItem}
                    onQuickAdd={quickAdd}
                    onSetQty={setItemQty}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <footer className="gm-foot">
        <p>{menu.business.name}</p>
        <p className="gm-foot__fine">Prices in ₹. Taxes are added on your bill. {T.poweredBy}</p>
      </footer>

      {showDock && (cart.lines.length > 0 || latestActive) ? (
        <div className="gm-dock" onPointerDown={onDockDown} onPointerMove={onDockMove} onPointerUp={() => { dragY.current = null; }}>
          {cart.lines.length > 0 ? (
            <button type="button" className="gm-dock__btn gm-press" onClick={() => { setError(null); setCartOpen(true); }}>
              <span className="gm-dock__icon"><ShoppingBag size={18} aria-hidden="true" /><b className="tabular">{totals.count}</b></span>
              <span className="gm-dock__label">{T.viewOrder}<small>{T.items(totals.count)}</small></span>
              <span className="gm-dock__amt tabular">{formatPrice(totals.totalMinor, currency)}</span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          ) : latestActive ? (
            <button type="button" className="gm-dock__btn gm-press" onClick={() => { setTab('orders'); setTableOpen(true); }}>
              <span className="gm-dock__dot" aria-hidden="true" />
              <span className="gm-dock__label">{T.yourTable}<small>{statusLabel(latestActive.status)}</small></span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="gm-toast" role="status" aria-live="polite">{toast}</div>

      <ItemSheet item={itemOpen} currency={currency} canOrder={canOrder} onClose={() => setItemOpen(null)} onAdd={addItem} />
      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        lines={cart.lines}
        items={items}
        currency={currency}
        orderNote={cart.note}
        onOrderNote={(v) => dispatch({ type: 'orderNote', note: v })}
        onQty={(key, qty) => dispatch({ type: 'qty', key, qty })}
        onNote={(key, note) => dispatch({ type: 'note', key, note })}
        totals={totals}
        mode={mode}
        canOrder={canOrder && cart.lines.length <= MAX_LINES && totals.count <= MAX_TOTAL_QTY}
        sending={sending}
        error={!canOrder ? (tableIsOpen ? T.orderingOffBody : T.tableClosedBody) : totals.count > MAX_TOTAL_QTY ? T.cartTooMany(MAX_TOTAL_QTY) : error}
        notice={notice}
        onSend={() => void sendOrder()}
      />
      <TableSheet
        open={tableOpen}
        onClose={() => { setTableOpen(false); setHighlight(null); }}
        tab={tab}
        onTab={setTab}
        state={session.state}
        items={items}
        currency={currency}
        waiterEnabled={menu.settings.callWaiter}
        upiEnabled={menu.settings.payment.upi}
        tableOpen={tableIsOpen}
        highlightId={highlight}
        placedTotals={placed}
        onWaiter={session.callWaiter}
        onPay={() => setPayOpen(true)}
      />
      {payOpen ? (
        <Suspense fallback={null}>
          <PaySheet open={payOpen} onClose={() => setPayOpen(false)} getIntent={getIntent} bill={session.state?.bill ?? null} currency={currency} />
        </Suspense>
      ) : null}
    </div>
  );
}

export type { MenuPayload };
