import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type CatalogCategory,
  type CatalogItem,
  type DiningArea,
  type DiningTable,
  type GuestSession,
  type Invoice,
  type ServiceRequest,
  catalogApi,
  checkoutApi,
  diningApi,
  formatMinorUnits,
  orderApi,
  sessionApi,
  timeAgo,
} from './api';

// ── Status badges ─────────────────────────────────────────────────────────────

function TableStatusBadge({ status }: { status: DiningTable['status'] }) {
  const cls =
    status === 'AVAILABLE'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'OCCUPIED'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-slate-100 text-slate-600';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${cls}`}>
      {status.toLowerCase()}
    </span>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-600',
    SENT: 'bg-blue-100 text-blue-700',
    ACCEPTED: 'bg-violet-100 text-violet-700',
    PREPARING: 'bg-orange-100 text-orange-700',
    READY: 'bg-green-100 text-green-700',
    SERVED: 'bg-teal-100 text-teal-700',
    CANCELLED: 'bg-red-100 text-red-600',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${map[status] ?? 'bg-slate-100'}`}>
      {status.toLowerCase()}
    </span>
  );
}

// ── Open Session Dialog ────────────────────────────────────────────────────────

function OpenSessionDialog({
  table,
  locationId,
  onConfirm,
  onCancel,
}: {
  table: DiningTable;
  locationId: string;
  onConfirm: (session: GuestSession) => void;
  onCancel: () => void;
}) {
  const [partySize, setPartySize] = useState(2);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const session = await sessionApi.open({ locationId, diningTableId: table.id, partySize, notes: notes || undefined });
      onConfirm(session);
    } catch {
      setError('Failed to open session. The table may already be occupied.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-1 text-lg font-semibold">Open Table {table.code}</h2>
        <p className="mb-4 text-sm text-slate-500">Capacity: {table.capacity}</p>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Party size</span>
          <input
            type="number"
            min={1}
            max={table.capacity}
            value={partySize}
            onChange={(e) => setPartySize(Number(e.target.value))}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>
        <label className="mt-3 block">
          <span className="text-sm font-medium text-slate-700">Notes (optional)</span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Birthday table"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {busy ? 'Opening…' : 'Open Session'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Order Builder ─────────────────────────────────────────────────────────────

function OrderBuilder({
  sessionId,
  categories,
  items,
  onSent,
  onCancel,
}: {
  sessionId: string;
  categories: CatalogCategory[];
  items: CatalogItem[];
  onSent: (order: ServiceRequest) => void;
  onCancel: () => void;
}) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const total = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = items.find((i) => i.id === id);
    return sum + (item?.basePriceMinorUnits ?? 0) * qty;
  }, 0);

  function adjust(itemId: string, delta: number) {
    setCart((prev) => {
      const next = { ...prev };
      const cur = (next[itemId] ?? 0) + delta;
      if (cur <= 0) delete next[itemId];
      else next[itemId] = cur;
      return next;
    });
  }

  async function sendToKitchen() {
    const lines = Object.entries(cart).map(([catalogItemId, quantity]) => ({ catalogItemId, quantity, modifiers: [] }));
    if (lines.length === 0) { setError('Add at least one item.'); return; }
    setBusy(true);
    setError('');
    try {
      const draft = await orderApi.create({ sessionId, idempotencyKey: crypto.randomUUID(), lines });
      const sent = await orderApi.send(draft.id);
      onSent(sent);
    } catch {
      setError('Failed to send order. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const grouped = categories
    .filter((c) => c.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((cat) => ({ cat, items: items.filter((i) => i.categoryId === cat.id && i.isActive) }))
    .filter((g) => g.items.length > 0);

  const uncategorised = items.filter((i) => i.isActive && !i.categoryId);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onCancel} />
      <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold">New Order</h2>
          <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {grouped.map(({ cat, items: catItems }) => (
            <div key={cat.id}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{cat.name}</p>
              <div className="space-y-1">
                {catItems.map((item) => (
                  <ItemRow key={item.id} item={item} qty={cart[item.id] ?? 0} onAdjust={(d) => adjust(item.id, d)} />
                ))}
              </div>
            </div>
          ))}
          {uncategorised.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Other</p>
              <div className="space-y-1">
                {uncategorised.map((item) => (
                  <ItemRow key={item.id} item={item} qty={cart[item.id] ?? 0} onAdjust={(d) => adjust(item.id, d)} />
                ))}
              </div>
            </div>
          )}
          {grouped.length === 0 && uncategorised.length === 0 && (
            <p className="text-sm text-slate-400">No catalog items available. Add items via the Catalog module.</p>
          )}
        </div>
        <div className="border-t border-slate-200 p-5">
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex items-center justify-between">
            <span className="font-semibold">{formatMinorUnits(total)}</span>
            <button
              type="button"
              onClick={() => void sendToKitchen()}
              disabled={busy || Object.keys(cart).length === 0}
              className="rounded-md bg-blue-700 px-5 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Send to Kitchen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemRow({ item, qty, onAdjust }: { item: CatalogItem; qty: number; onAdjust: (d: number) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-50">
      <div>
        <p className="text-sm font-medium text-slate-800">{item.name}</p>
        <p className="text-xs text-slate-500">{formatMinorUnits(item.basePriceMinorUnits)}</p>
      </div>
      <div className="flex items-center gap-2">
        {qty > 0 && (
          <>
            <button type="button" onClick={() => onAdjust(-1)} className="h-7 w-7 rounded-full border border-slate-300 text-sm hover:bg-slate-100">−</button>
            <span className="w-4 text-center text-sm font-semibold">{qty}</span>
          </>
        )}
        <button type="button" onClick={() => onAdjust(1)} className="h-7 w-7 rounded-full border border-blue-300 text-blue-700 text-sm hover:bg-blue-50">+</button>
      </div>
    </div>
  );
}

// ── Checkout Panel ────────────────────────────────────────────────────────────

function CheckoutPanel({
  session,
  onPaid,
  onCancel,
}: {
  session: GuestSession;
  onPaid: () => void;
  onCancel: () => void;
}) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [method, setMethod] = useState<'CASH' | 'UPI' | 'CARD'>('CASH');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stage, setStage] = useState<'loading' | 'review' | 'paid'>('loading');

  useEffect(() => {
    void (async () => {
      try {
        const inv = await checkoutApi.getOrCreateInvoice(session.id);
        const finalised = inv.status === 'FINALISED' || inv.status === 'PAID'
          ? inv
          : await checkoutApi.finalise(inv.id);
        setInvoice(finalised);
        setStage(finalised.status === 'PAID' ? 'paid' : 'review');
      } catch {
        setError('Failed to load invoice.');
        setStage('review');
      }
    })();
  }, [session.id]);

  async function pay() {
    if (!invoice) return;
    setBusy(true);
    setError('');
    try {
      await checkoutApi.pay(invoice.id, method, invoice.grandTotalMinorUnits);
      setStage('paid');
    } catch {
      setError('Payment failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onCancel} />
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold">Checkout — Table {session.diningTableId.slice(0, 6)}</h2>
          <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </div>

        {stage === 'loading' && <p className="p-5 text-sm text-slate-500">Loading invoice…</p>}

        {stage === 'paid' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center text-3xl">✓</div>
            <p className="text-xl font-semibold text-emerald-700">Payment Received</p>
            <p className="text-sm text-slate-500">{invoice && formatMinorUnits(invoice.grandTotalMinorUnits)}</p>
            <button
              type="button"
              onClick={onPaid}
              className="mt-2 rounded-md bg-blue-700 px-6 py-2 text-sm font-medium text-white hover:bg-blue-800"
            >
              Close Session
            </button>
          </div>
        )}

        {stage === 'review' && invoice && (
          <>
            <div className="flex-1 overflow-y-auto p-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                    <th className="pb-2 font-medium">Item</th>
                    <th className="pb-2 font-medium text-right">Qty</th>
                    <th className="pb-2 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.map((line) => (
                    <tr key={line.id} className="border-b border-slate-50">
                      <td className="py-2">
                        <p>{line.itemNameSnapshot}</p>
                        {line.variantNameSnapshot && <p className="text-xs text-slate-400">{line.variantNameSnapshot}</p>}
                      </td>
                      <td className="py-2 text-right">{line.quantity}</td>
                      <td className="py-2 text-right">{formatMinorUnits(line.totalMinorUnits)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 space-y-1 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span><span>{formatMinorUnits(invoice.subtotalMinorUnits)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Tax</span><span>{formatMinorUnits(invoice.taxMinorUnits)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold">
                  <span>Total</span><span>{formatMinorUnits(invoice.grandTotalMinorUnits)}</span>
                </div>
              </div>
            </div>
            <div className="border-t border-slate-200 p-5 space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Payment method</p>
                <div className="flex gap-2">
                  {(['CASH', 'UPI', 'CARD'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={`flex-1 rounded-md border py-2 text-sm font-medium transition-colors ${
                        method === m
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="button"
                onClick={() => void pay()}
                disabled={busy}
                className="w-full rounded-md bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? 'Processing…' : `Collect ${formatMinorUnits(invoice.grandTotalMinorUnits)}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Session Detail Panel ──────────────────────────────────────────────────────

function SessionPanel({
  session: initialSession,
  table,
  categories,
  items,
  onClose,
  onRefresh,
}: {
  session: GuestSession;
  table: DiningTable;
  categories: CatalogCategory[];
  items: CatalogItem[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [orders, setOrders] = useState<ServiceRequest[]>([]);
  const [showOrder, setShowOrder] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadOrders = useCallback(async () => {
    try {
      const list = await orderApi.list({ sessionId: initialSession.id });
      setOrders(list);
    } catch {
      // non-fatal
    }
  }, [initialSession.id]);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  async function closeSession() {
    setBusy(true);
    setError('');
    try {
      await sessionApi.close(initialSession.id);
      onRefresh();
      onClose();
    } catch {
      setError('Failed to close session.');
    } finally {
      setBusy(false);
    }
  }

  const hasActiveOrders = orders.some((o) =>
    ['DRAFT', 'SENT', 'ACCEPTED', 'PREPARING', 'READY'].includes(o.status),
  );

  return (
    <>
      <div className="fixed inset-0 z-40 flex">
        <div className="flex-1 bg-black/30" onClick={onClose} />
        <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold">Table {table.code}</h2>
              <p className="text-xs text-slate-500">
                {initialSession.partySize} guest{initialSession.partySize !== 1 ? 's' : ''} · Opened {timeAgo(initialSession.openedAt)}
              </p>
            </div>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {orders.length === 0 && (
              <p className="text-sm text-slate-400">No orders yet. Tap "New Order" to add items.</p>
            )}
            {orders.map((order) => (
              <div key={order.id} className="rounded-lg border border-slate-200 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">
                    Round {order.roundNumber}{order.requestNumber ? ` · #${order.requestNumber}` : ''}
                  </span>
                  <OrderStatusBadge status={order.status} />
                </div>
                <div className="space-y-1">
                  {order.lines.map((line) => (
                    <div key={line.id} className="flex justify-between text-sm">
                      <span className="text-slate-700">{line.quantity}× {line.itemNameSnapshot}</span>
                      <span className="text-slate-500">{formatMinorUnits(line.unitPriceMinorUnits * line.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 p-5 space-y-3">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowOrder(true)}
                className="flex-1 rounded-md bg-blue-700 py-2 text-sm font-medium text-white hover:bg-blue-800"
              >
                + New Order
              </button>
              <button
                type="button"
                onClick={() => setShowCheckout(true)}
                disabled={orders.length === 0}
                className="flex-1 rounded-md bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                Checkout
              </button>
            </div>
            {!hasActiveOrders && (
              <button
                type="button"
                onClick={() => void closeSession()}
                disabled={busy}
                className="w-full rounded-md border border-slate-300 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {busy ? 'Closing…' : 'Close Session'}
              </button>
            )}
          </div>
        </div>
      </div>

      {showOrder && (
        <OrderBuilder
          sessionId={initialSession.id}
          categories={categories}
          items={items}
          onSent={(order) => {
            setOrders((prev) => [order, ...prev]);
            setShowOrder(false);
          }}
          onCancel={() => setShowOrder(false)}
        />
      )}

      {showCheckout && (
        <CheckoutPanel
          session={initialSession}
          onPaid={async () => {
            setShowCheckout(false);
            await loadOrders();
            await closeSession();
          }}
          onCancel={() => setShowCheckout(false)}
        />
      )}
    </>
  );
}

// ── Floor View ────────────────────────────────────────────────────────────────

export function TablesPage() {
  const [areas, setAreas] = useState<DiningArea[]>([]);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [sessions, setSessions] = useState<GuestSession[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openingTable, setOpeningTable] = useState<DiningTable | null>(null);
  const [activeSession, setActiveSession] = useState<{ session: GuestSession; table: DiningTable } | null>(null);
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [areasData, tablesData, sessionsData, catsData, itemsData] = await Promise.all([
        diningApi.listAreas(),
        diningApi.listTables(),
        sessionApi.list({ status: 'OPEN' }),
        catalogApi.listCategories(),
        catalogApi.listItems(),
      ]);
      setAreas(areasData);
      setTables(tablesData);
      setSessions(sessionsData);
      setCategories(catsData);
      setCatalogItems(itemsData);
      setError('');
    } catch {
      setError('Failed to load floor data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    intervalRef.current = setInterval(() => void load(), 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  async function resetTable(tableId: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await diningApi.resetTable(tableId);
      await load();
    } catch {
      // non-fatal
    }
  }

  function handleTableClick(table: DiningTable) {
    if (!table.isActive) return;
    if (table.status === 'AVAILABLE') {
      setOpeningTable(table);
    } else if (table.status === 'OCCUPIED') {
      const session = sessions.find((s) => s.diningTableId === table.id);
      if (session) setActiveSession({ session, table });
    }
  }

  // First location from sessions/tables — used when opening a session
  const locationId = tables[0]?.locationId ?? sessions[0]?.locationId ?? '';

  const filteredTables = selectedArea === 'all'
    ? tables
    : tables.filter((t) => t.areaId === selectedArea);

  const tablesByArea = areas
    .filter((a) => a.isActive)
    .map((area) => ({
      area,
      tables: filteredTables.filter((t) => t.areaId === area.id),
    }))
    .filter((g) => g.tables.length > 0 || selectedArea === 'all');

  const uncategorisedTables = filteredTables.filter((t) => !areas.find((a) => a.id === t.areaId));

  if (loading) {
    return <p className="text-sm text-slate-400">Loading floor plan…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tables</h1>
          <p className="mt-1 text-sm text-slate-500">Click a table to open a session or view orders.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {areas.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedArea('all')}
            className={`rounded-full px-3 py-1 text-sm font-medium ${selectedArea === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            All areas
          </button>
          {areas.filter((a) => a.isActive).map((area) => (
            <button
              key={area.id}
              type="button"
              onClick={() => setSelectedArea(area.id)}
              className={`rounded-full px-3 py-1 text-sm font-medium ${selectedArea === area.id ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {area.name}
            </button>
          ))}
        </div>
      )}

      {tables.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 p-12 text-center">
          <p className="text-sm text-slate-500">No tables configured yet.</p>
          <p className="mt-1 text-xs text-slate-400">Add dining areas and tables via the Configuration section.</p>
        </div>
      )}

      {tablesByArea.map(({ area, tables: areaTableList }) => (
        <section key={area.id}>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{area.name}</h2>
          <FloorGrid tables={areaTableList} sessions={sessions} onTableClick={handleTableClick} onResetTable={resetTable} />
        </section>
      ))}

      {uncategorisedTables.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Other</h2>
          <FloorGrid tables={uncategorisedTables} sessions={sessions} onTableClick={handleTableClick} onResetTable={resetTable} />
        </section>
      )}

      {openingTable && (
        <OpenSessionDialog
          table={openingTable}
          locationId={locationId}
          onConfirm={(session) => {
            setSessions((prev) => [session, ...prev]);
            setTables((prev) =>
              prev.map((t) => (t.id === openingTable.id ? { ...t, status: 'OCCUPIED' } : t)),
            );
            setOpeningTable(null);
            setActiveSession({ session, table: openingTable });
          }}
          onCancel={() => setOpeningTable(null)}
        />
      )}

      {activeSession && (
        <SessionPanel
          session={activeSession.session}
          table={activeSession.table}
          categories={categories}
          items={catalogItems}
          onClose={() => setActiveSession(null)}
          onRefresh={() => void load()}
        />
      )}
    </div>
  );
}

function FloorGrid({
  tables,
  sessions,
  onTableClick,
  onResetTable,
}: {
  tables: DiningTable[];
  sessions: GuestSession[];
  onTableClick: (table: DiningTable) => void;
  onResetTable: (tableId: string, e: React.MouseEvent) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {tables.map((table) => {
        const session = sessions.find((s) => s.diningTableId === table.id);
        return (
          <button
            key={table.id}
            type="button"
            onClick={() => onTableClick(table)}
            disabled={!table.isActive}
            className={`group relative rounded-xl border-2 p-4 text-left transition-all ${
              table.status === 'AVAILABLE'
                ? 'border-emerald-200 bg-emerald-50 hover:border-emerald-400 hover:shadow-md'
                : table.status === 'OCCUPIED'
                  ? 'border-amber-200 bg-amber-50 hover:border-amber-400 hover:shadow-md'
                  : 'border-slate-200 bg-slate-50'
            } ${!table.isActive ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
          >
            <div className="mb-2 flex items-start justify-between">
              <span className="text-base font-bold text-slate-800">{table.code}</span>
              <TableStatusBadge status={table.status} />
            </div>
            <p className="text-xs text-slate-500">{table.capacity} seats</p>
            {session && (
              <p className="mt-1 text-xs text-amber-700">{session.partySize} guests · {timeAgo(session.openedAt)}</p>
            )}
            {table.status === 'CLEANING' && (
              <button
                type="button"
                onClick={(e) => onResetTable(table.id, e)}
                className="mt-2 w-full rounded-md bg-slate-600 px-2 py-1 text-xs text-white hover:bg-slate-700"
              >
                Mark Available
              </button>
            )}
          </button>
        );
      })}
    </div>
  );
}
