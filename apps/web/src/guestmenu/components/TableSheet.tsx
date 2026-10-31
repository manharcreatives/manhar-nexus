import { useEffect, useState } from 'react';
import { BellRing, Check, Droplets, Receipt, QrCode, X } from 'lucide-react';
import { Sheet } from './ui';
import { formatBill, formatTime } from '../format';
import { STAGES, isBillPaid, progressOf, stageOf, stepStates, taxLabel } from '../status';
import { T } from '../strings';
import type { MenuItem, StateOrder, TableState, WaiterReason } from '../types';

export interface TableSheetProps {
  open: boolean;
  onClose: () => void;
  tab: 'orders' | 'bill';
  onTab: (t: 'orders' | 'bill') => void;
  state: TableState | null;
  items: Map<string, MenuItem>;
  currency: string;
  waiterEnabled: boolean;
  upiEnabled: boolean;
  tableOpen: boolean;
  highlightId: string | null;
  onWaiter: (reason: WaiterReason) => Promise<void>;
  onPay: () => void;
}

const stageLabel = (status: string) => {
  const g = stageOf(status);
  return g === 'cancelled' ? T.cancelled : T.stage[g];
};

export function Tracker({ status }: { status: string }) {
  const stage = stageOf(status);
  if (stage === 'cancelled') {
    return (
      <p className="gm-cancel" role="status"><X size={16} aria-hidden="true" /> {T.cancelled}</p>
    );
  }
  const steps = stepStates(stage);
  return (
    <div className="gm-track">
      <ol className="gm-track__list" style={{ ['--p' as string]: progressOf(stage) }}>
        {STAGES.map((s, i) => (
          <li key={s} data-state={steps[i]} aria-current={steps[i] === 'current' ? 'step' : undefined}>
            <span className="gm-track__dot" aria-hidden="true">{steps[i] === 'done' ? <Check size={12} strokeWidth={3.2} /> : null}</span>
            <span className="gm-track__label">{T.stage[s]}</span>
          </li>
        ))}
      </ol>
      <p className="gm-track__now" role="status">{T.stageNow[stage]}</p>
    </div>
  );
}

function OrderCard({ order, n, items, currency, highlight }: { order: StateOrder; n: number; items: Map<string, MenuItem>; currency: string; highlight: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="gm-order" data-new={highlight || undefined}>
      <div className="gm-order__head">
        <h3>{T.orderN(n)}</h3>
        <span className="gm-order__time">{formatTime(order.placedAt)}</span>
      </div>
      <Tracker status={order.status} />
      <ul className="gm-order__lines">
        {order.lines.map((l, i) => {
          const name = l.name ?? (l.itemId ? items.get(l.itemId)?.name : undefined) ?? 'Item';
          const extra = [l.variantName, ...(l.addOns ?? []).map((a) => (typeof a === 'string' ? a : a.name))].filter(Boolean).join(' · ');
          return (
            <li key={i}>
              <span className="tabular gm-order__qty">{l.qty}×</span>
              <span>{name}{extra ? <small> {extra}</small> : null}</span>
            </li>
          );
        })}
      </ul>
      {order.timeline?.length ? (
        <div className="gm-order__tl">
          <button type="button" className="gm-link-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{T.timeline}</button>
          {open ? (
            <ol className="gm-tl">
              {order.timeline.map((e, i) => (
                <li key={i}><span className="tabular">{formatTime(e.at)}</span> {stageLabel(e.status)}</li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
      {typeof order.totalMinor === 'number' ? <p className="gm-order__total tabular">{formatBill(order.totalMinor, currency)}</p> : null}
    </li>
  );
}

function BillView({ state, currency }: { state: TableState | null; currency: string }) {
  const b = state?.bill;
  if (!b || b.totalMinor <= 0) return <p className="gm-empty">{T.billEmpty}</p>;
  const paid = isBillPaid(b);
  return (
    <div className="gm-bill">
      <p className="gm-bill__lede">{paid ? T.billPaid : T.billRunning}</p>
      <dl className="gm-bill__rows">
        <div><dt>{T.subtotal}</dt><dd className="tabular">{formatBill(b.subtotalMinor, currency)}</dd></div>
        {b.taxLines.map((t, i) => (
          <div key={i}><dt>{taxLabel(t)}</dt><dd className="tabular">{formatBill(t.amountMinor, currency)}</dd></div>
        ))}
        <div className="gm-bill__total"><dt>{T.total}</dt><dd className="tabular">{formatBill(b.totalMinor, currency)}</dd></div>
        {b.paidMinor > 0 ? <div><dt>{T.paid}</dt><dd className="tabular">− {formatBill(b.paidMinor, currency)}</dd></div> : null}
        {!paid ? <div className="gm-bill__due"><dt>{T.due}</dt><dd className="tabular">{formatBill(b.dueMinor, currency)}</dd></div> : null}
      </dl>
    </div>
  );
}

export function TableSheet(p: TableSheetProps) {
  const orders = p.state?.orders ?? [];
  const bill = p.state?.bill;
  const paid = isBillPaid(bill);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<WaiterReason | null>(null);
  const [cool, setCool] = useState(0);
  const waiterOpen = !!p.state?.waiterCall?.open;

  useEffect(() => {
    if (cool <= 0) return;
    const t = setTimeout(() => setCool((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cool]);
  useEffect(() => {
    if (!p.open) setMsg(null);
  }, [p.open]);

  const call = async (reason: WaiterReason) => {
    setBusy(reason);
    setMsg(null);
    try {
      await p.onWaiter(reason);
      setMsg(reason === 'bill' ? T.billRequested : T.waiterCalled);
      setCool(20);
    } catch {
      setMsg(T.waiterFailed);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open={p.open} onClose={p.onClose} title={T.yourTable} tall>
      <div className="gm-tabs" role="tablist" aria-label={T.yourTable}>
        {(['orders', 'bill'] as const).map((t) => (
          <button key={t} type="button" role="tab" id={`gm-tab-${t}`} aria-selected={p.tab === t} aria-controls={`gm-panel-${t}`} className="gm-tab gm-press" onClick={() => p.onTab(t)}>
            {t === 'orders' ? T.tabOrders : T.tabBill}
            {t === 'orders' && orders.length ? <b className="tabular">{orders.length}</b> : null}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="gm-panel-orders" aria-labelledby="gm-tab-orders" hidden={p.tab !== 'orders'}>
        {orders.length === 0 ? <p className="gm-empty">{T.noOrders}</p> : (
          <ul className="gm-orders">
            {[...orders].reverse().map((o) => (
              <OrderCard key={o.id} order={o} n={orders.indexOf(o) + 1} items={p.items} currency={p.currency} highlight={o.id === p.highlightId} />
            ))}
          </ul>
        )}
      </div>
      <div role="tabpanel" id="gm-panel-bill" aria-labelledby="gm-tab-bill" hidden={p.tab !== 'bill'}>
        <BillView state={p.state} currency={p.currency} />
      </div>

      {p.tableOpen ? (
        <div className="gm-actions">
          {waiterOpen ? <p className="gm-waiter" role="status"><span className="gm-pulse" aria-hidden="true" /> {T.waiterCalled}</p> : null}
          {msg && !waiterOpen ? <p className="gm-note" role="status">{msg}</p> : null}
          {p.waiterEnabled ? (
            <div className="gm-actions__row">
              <button type="button" className="gm-ghost gm-press" disabled={busy !== null || cool > 0} onClick={() => void call('call')}><BellRing size={17} aria-hidden="true" /> {T.callWaiter}</button>
              <button type="button" className="gm-ghost gm-press" disabled={busy !== null || cool > 0} onClick={() => void call('water')}><Droplets size={17} aria-hidden="true" /> {T.water}</button>
              <button type="button" className="gm-ghost gm-press" disabled={busy !== null || cool > 0 || !bill || bill.totalMinor <= 0 || paid} onClick={() => void call('bill')}><Receipt size={17} aria-hidden="true" /> {T.requestBill}</button>
            </div>
          ) : null}
          {p.upiEnabled && bill && bill.dueMinor > 0 && !paid ? (
            <button type="button" className="gm-cta gm-press" onClick={p.onPay}><QrCode size={18} aria-hidden="true" /> <span>{T.payUpi}</span><span className="gm-cta__amt tabular">{formatBill(bill.dueMinor, p.currency)}</span></button>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}
