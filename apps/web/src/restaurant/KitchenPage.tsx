import { useCallback, useEffect, useRef, useState } from 'react';
import { type ServiceRequest, formatMinorUnits, kitchenApi, timeAgo } from './api';

type KitchenStatus = 'SENT' | 'ACCEPTED' | 'PREPARING' | 'READY';

const STATUS_LABEL: Record<KitchenStatus, string> = {
  SENT: 'New',
  ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY: 'Ready',
};

const STATUS_COLOR: Record<KitchenStatus, string> = {
  SENT: 'border-blue-300 bg-blue-50',
  ACCEPTED: 'border-violet-300 bg-violet-50',
  PREPARING: 'border-orange-300 bg-orange-50',
  READY: 'border-green-300 bg-green-50',
};

const STATUS_BADGE: Record<KitchenStatus, string> = {
  SENT: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-violet-100 text-violet-700',
  PREPARING: 'bg-orange-100 text-orange-700',
  READY: 'bg-green-100 text-green-700',
};

function KitchenTicket({
  order,
  onAction,
}: {
  order: ServiceRequest;
  onAction: (id: string, action: 'accept' | 'prepare' | 'ready') => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const status = order.status as KitchenStatus;
  const elapsed = order.sentAt ? timeAgo(order.sentAt) : 'just now';

  async function act(action: 'accept' | 'prepare' | 'ready') {
    setBusy(true);
    try { await onAction(order.id, action); }
    finally { setBusy(false); }
  }

  const subtotal = order.lines.reduce(
    (sum, l) => sum + l.unitPriceMinorUnits * l.quantity,
    0,
  );

  return (
    <div className={`rounded-xl border-2 ${STATUS_COLOR[status]} flex flex-col gap-3 p-4`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold">
            {order.requestNumber ? `#${order.requestNumber}` : `Round ${order.roundNumber}`}
          </p>
          <p className="text-xs text-slate-500">{elapsed}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${STATUS_BADGE[status]}`}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      <div className="space-y-1">
        {order.lines
          .filter((l) => l.status !== 'CANCELLED')
          .map((line) => (
            <div key={line.id} className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">
                  <span className="font-bold">{line.quantity}×</span> {line.itemNameSnapshot}
                </p>
                {line.variantNameSnapshot && (
                  <p className="text-xs text-slate-500">{line.variantNameSnapshot}</p>
                )}
                {line.modifiers.map((m) => (
                  <p key={m.id} className="text-xs text-slate-400">+ {m.optionNameSnapshot}</p>
                ))}
                {line.notes && <p className="text-xs italic text-slate-500">"{line.notes}"</p>}
              </div>
              <p className="shrink-0 text-xs text-slate-400">
                {formatMinorUnits(line.unitPriceMinorUnits * line.quantity)}
              </p>
            </div>
          ))}
      </div>

      {order.notes && (
        <p className="rounded-md bg-yellow-50 px-2 py-1 text-xs text-yellow-800 border border-yellow-200">
          Note: {order.notes}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-600">{formatMinorUnits(subtotal)}</span>
        {status === 'SENT' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void act('accept')}
            className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {busy ? '…' : 'Accept'}
          </button>
        )}
        {status === 'ACCEPTED' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void act('prepare')}
            className="rounded-md bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {busy ? '…' : 'Start Preparing'}
          </button>
        )}
        {status === 'PREPARING' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void act('ready')}
            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {busy ? '…' : 'Mark Ready'}
          </button>
        )}
        {status === 'READY' && (
          <span className="text-xs font-semibold text-green-700">Waiting for pickup</span>
        )}
      </div>
    </div>
  );
}

export function KitchenPage() {
  const [queue, setQueue] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await kitchenApi.queue();
      setQueue(data);
      setLastRefresh(new Date());
      setError('');
    } catch {
      setError('Failed to load kitchen queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    intervalRef.current = setInterval(() => void load(), 15_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  async function handleAction(id: string, action: 'accept' | 'prepare' | 'ready') {
    try {
      let updated: ServiceRequest;
      if (action === 'accept') updated = await kitchenApi.accept(id);
      else if (action === 'prepare') updated = await kitchenApi.prepare(id);
      else updated = await kitchenApi.ready(id);
      setQueue((prev) => prev.map((o) => (o.id === id ? updated : o)));
    } catch {
      // Refresh on failure to sync state
      await load();
    }
  }

  const byStatus = (status: KitchenStatus) =>
    queue.filter((o) => o.status === status);

  const columns: KitchenStatus[] = ['SENT', 'ACCEPTED', 'PREPARING', 'READY'];

  if (loading) return <p className="text-sm text-slate-400">Loading kitchen queue…</p>;

  const total = queue.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kitchen Display</h1>
          <p className="mt-1 text-xs text-slate-400">
            {total} active ticket{total !== 1 ? 's' : ''} · Last updated {lastRefresh.toLocaleTimeString()}
          </p>
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {columns.map((status) => {
          const tickets = byStatus(status);
          return (
            <div key={status}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">{STATUS_LABEL[status]}</h2>
                {tickets.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                    {tickets.length}
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {tickets.map((order) => (
                  <KitchenTicket key={order.id} order={order} onAction={handleAction} />
                ))}
                {tickets.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center">
                    <p className="text-xs text-slate-400">Empty</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
