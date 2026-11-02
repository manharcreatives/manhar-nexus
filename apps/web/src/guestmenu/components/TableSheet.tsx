import { useEffect, useState } from 'react';
import { BellRing, Check, Droplets, Hourglass, Pencil, QrCode, Receipt, X } from 'lucide-react';
import { Sheet } from './ui';
import { formatBill, formatTime } from '../format';
import { STAGES, isAwaiting, isBillFinal, isBillPaid, isRejected, progressOf, stageOf, statusLabel, stepStates, taxLabel, wasAdjusted } from '../status';
import { T } from '../strings';
import type { BillState, MenuItem, StateOrder, TableState, WaiterReason } from '../types';

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
  /** orderId -> total this device submitted (to tell the guest when the waiter adjusted an order). */
  placedTotals: Record<string, number>;
  onWaiter: (reason: WaiterReason) => Promise<void>;
  onPay: () => void;
}

export function Tracker({ status, rejectReason }: { status: string; rejectReason?: string | null }) {
  const stage = stageOf(status);
  if (stage === 'cancelled') {
    const rejected = isRejected(status);
    return (
      <div className="gm-cancel" role="status" data-rejected={rejected || undefined}>
        <p><X size={16} aria-hidden="true" /> {rejected ? T.rejected : T.cancelled}</p>
        {rejected && rejectReason ? <p className="gm-cancel__reason"><span>{T.rejectedReason}</span> “{rejectReason}”</p> : null}
        {rejected ? <p className="gm-cancel__hint">{T.rejectedHint}</p> : null}
      </div>
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
      <p className="gm-track__now" role="status">
        {isAwaiting(status) ? <Hourglass size={14} aria-hidden="true" /> : null} {isAwaiting(status) ? T.awaitingLede : T.stageNow[stage]}
      </p>
    </div>
  );
}

function OrderCard({ order, n, items, currency, highlight, adjusted }: { order: StateOrder; n: number; items: Map<string, MenuItem>; currency: string; highlight: boolean; adjusted: boolean }) {
  const [open, setOpen] = useState(false);
  const rejected = isRejected(order.status);
  return (
    <li className="gm-order" data-new={highlight || undefined} data-status={order.status} data-mine={order.mine || undefined}>
      <div className="gm-order__head">
        <h3>{T.orderN(n)}</h3>
        {!order.mine ? <span className="gm-chip">{T.otherGuest}</span> : null}
        <span className="gm-order__time">{formatTime(order.placedAt)}</span>
      </div>
      <Tracker status={order.status} rejectReason={order.rejectReason} />
      {adjusted ? (
        <p className="gm-adjusted" role="status"><Pencil size={14} aria-hidden="true" /> <span><strong>{T.adjusted}</strong> {T.adjustedHint}</span></p>
      ) : null}
      <ul className="gm-order__lines" data-struck={rejected || undefined}>
        {order.lines.map((l, i) => {
          const name = l.name || (l.itemId ? items.get(l.itemId)?.name : undefined) || 'Item';
          const extra = [l.variantName, ...l.addOns].filter(Boolean).join(' · ');
          return (
            <li key={i}>
              <span className="tabular gm-order__qty">{l.qty}×</span>
              <span>{name}{extra ? <small> {extra}</small> : null}</span>
            </li>
          );
        })}
      </ul>
      {order.note ? <p className="gm-order__note">“{order.note}”</p> : null}
      {order.timeline.length ? (
        <div className="gm-order__tl">
          <button type="button" className="gm-link-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{T.timeline}</button>
          {open ? (
            <ol className="gm-tl">
              {order.timeline.map((e, i) => (
                <li key={i}><span className="tabular">{formatTime(e.at)}</span> {statusLabel(e.status)}</li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
      {!rejected ? <p className="gm-order__total tabular">{formatBill(order.totalMinor, currency)}</p> : null}
    </li>
  );
}

function BillView({ bill, currency }: { bill: BillState | null | undefined; currency: string }) {
  if (!bill || bill.totalMinor <= 0) return <p className="gm-empty">{T.billEmpty}</p>;
  const paid = isBillPaid(bill);
  const lede = paid ? T.billPaid : bill.status === 'FINAL' ? T.billFinal : T.billRunning;
  return (
    <div className="gm-bill" data-status={bill.status}>
      <p className="gm-bill__lede">{lede}</p>
      <dl className="gm-bill__rows">
        <div><dt>{T.subtotal}</dt><dd className="tabular">{formatBill(bill.subtotalMinor, currency)}</dd></div>
        {bill.taxLines.map((t, i) => (
          <div key={i}><dt>{taxLabel(t)}</dt><dd className="tabular">{formatBill(t.amountMinor, currency)}</dd></div>
        ))}
        <div className="gm-bill__total"><dt>{T.total}</dt><dd className="tabular">{formatBill(bill.totalMinor, currency)}</dd></div>
        {bill.paidMinor > 0 ? <div><dt>{T.paid}</dt><dd className="tabular">− {formatBill(bill.paidMinor, currency)}</dd></div> : null}
        {!paid ? <div className="gm-bill__due"><dt>{T.due}</dt><dd className="tabular">{formatBill(bill.dueMinor, currency)}</dd></div> : null}
      </dl>
      {bill.reference ? <p className="gm-bill__ref"><span>{T.billRef}</span> <code className="ticket-no">{bill.reference}</code></p> : null}
    </div>
  );
}

export function TableSheet(p: TableSheetProps) {
  const orders = p.state?.orders ?? [];
  const bill = p.state?.bill ?? null;
  const paid = isBillPaid(bill);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<WaiterReason | null>(null);
  const [cool, setCool] = useState(0);
  const call = p.state?.waiterCall;
  const openReason = call && call.open ? call.reason : null;

  useEffect(() => {
    if (cool <= 0) return;
    const t = setTimeout(() => setCool((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cool]);
  useEffect(() => {
    if (!p.open) setMsg(null);
  }, [p.open]);

  const ring = async (reason: WaiterReason) => {
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

  const payable = p.upiEnabled && isBillFinal(bill);
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
              <OrderCard key={o.id} order={o} n={orders.indexOf(o) + 1} items={p.items} currency={p.currency} highlight={o.id === p.highlightId} adjusted={wasAdjusted(o, p.placedTotals)} />
            ))}
          </ul>
        )}
      </div>
      <div role="tabpanel" id="gm-panel-bill" aria-labelledby="gm-tab-bill" hidden={p.tab !== 'bill'}>
        <BillView bill={bill} currency={p.currency} />
      </div>

      {p.tableOpen ? (
        <div className="gm-actions">
          {openReason ? (
            <p className="gm-waiter" role="status"><span className="gm-pulse" aria-hidden="true" /> {openReason === 'bill' ? T.billRequestedLive : T.waiterCalled}</p>
          ) : null}
          {msg && !openReason ? <p className="gm-note" role="status">{msg}</p> : null}
          {p.waiterEnabled ? (
            <div className="gm-actions__row">
              <button type="button" className="gm-ghost gm-press" disabled={busy !== null || cool > 0 || openReason === 'call'} onClick={() => void ring('call')}><BellRing size={17} aria-hidden="true" /> {T.callWaiter}</button>
              <button type="button" className="gm-ghost gm-press" disabled={busy !== null || cool > 0 || openReason === 'water'} onClick={() => void ring('water')}><Droplets size={17} aria-hidden="true" /> {T.water}</button>
              <button type="button" className="gm-ghost gm-press" disabled={busy !== null || cool > 0 || openReason === 'bill' || !bill || bill.totalMinor <= 0 || paid} onClick={() => void ring('bill')}><Receipt size={17} aria-hidden="true" /> {T.requestBill}</button>
            </div>
          ) : null}
          {payable && bill ? (
            <button type="button" className="gm-cta gm-press" onClick={p.onPay}><QrCode size={18} aria-hidden="true" /> <span>{T.payUpi}</span><span className="gm-cta__amt tabular">{formatBill(bill.dueMinor, p.currency)}</span></button>
          ) : p.upiEnabled && bill && bill.status === 'RUNNING' ? (
            <p className="gm-note">{T.payNeedBill}</p>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}
