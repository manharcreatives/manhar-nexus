import { useState } from 'react';
import { AlertCircle, Loader2, MessageSquarePlus, Send } from 'lucide-react';
import { Sheet, Stepper, VegMark } from './ui';
import { MAX_NOTE, lineTotalMinor, type CartLine, type CartTotals } from '../cart';
import { formatPrice } from '../format';
import { T } from '../strings';
import type { MenuItem, OrderingMode } from '../types';

export interface CartSheetProps {
  open: boolean;
  onClose: () => void;
  lines: CartLine[];
  items: Map<string, MenuItem>;
  currency: string;
  orderNote: string;
  onOrderNote: (v: string) => void;
  onQty: (key: string, qty: number) => void;
  onNote: (key: string, note: string) => void;
  totals: CartTotals;
  mode: OrderingMode;
  canOrder: boolean;
  sending: boolean;
  error: string | null;
  notice: string | null;
  onSend: () => void;
}

function describe(item: MenuItem, line: CartLine): string {
  const parts: string[] = [];
  const v = item.variants.find((x) => x.id === line.variantId);
  if (v) parts.push(v.name);
  if (line.addOnOptionIds.length) {
    const names = item.addOnGroups.flatMap((g) => g.options).filter((o) => line.addOnOptionIds.includes(o.id)).map((o) => o.name);
    parts.push(...names);
  }
  return parts.join(' · ');
}

function Line({ line, item, currency, onQty, onNote }: { line: CartLine; item: MenuItem; currency: string; onQty: CartSheetProps['onQty']; onNote: CartSheetProps['onNote'] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(line.note ?? '');
  const detail = describe(item, line);
  return (
    <li className="gm-line">
      <div className="gm-line__main">
        <div className="gm-line__name">
          <VegMark kind={item.veg} />
          <span>{item.name}</span>
        </div>
        {detail ? <p className="gm-line__detail">{detail}</p> : null}
        {line.note && !editing ? <p className="gm-line__note">“{line.note}”</p> : null}
        {editing ? (
          <form
            className="gm-line__edit"
            onSubmit={(e) => {
              e.preventDefault();
              onNote(line.key, draft);
              setEditing(false);
            }}
          >
            <input data-autofocus value={draft} maxLength={MAX_NOTE} placeholder={T.notePlaceholder} aria-label={T.noteLabel} onChange={(e) => setDraft(e.target.value)} />
            <button type="submit" className="gm-link-btn gm-press">OK</button>
          </form>
        ) : (
          <button type="button" className="gm-link-btn" onClick={() => { setDraft(line.note ?? ''); setEditing(true); }}>
            <MessageSquarePlus size={14} aria-hidden="true" /> {line.note ? 'Edit note' : 'Add note'}
          </button>
        )}
      </div>
      <div className="gm-line__side">
        <p className="gm-price tabular">{formatPrice(lineTotalMinor(item, line), currency)}</p>
        <Stepper qty={line.qty} min={0} onChange={(n) => onQty(line.key, n)} label={item.name} size="sm" removeIcon />
      </div>
    </li>
  );
}

export function CartSheet(p: CartSheetProps) {
  const empty = p.lines.length === 0;
  return (
    <Sheet
      open={p.open}
      onClose={p.onClose}
      title={T.yourOrder}
      tall
      footer={
        empty ? null : (
          <div className="gm-cartfoot">
            {p.error ? (
              <p className="gm-alert" role="alert"><AlertCircle size={16} aria-hidden="true" /> {p.error}</p>
            ) : null}
            <div className="gm-cartfoot__sum">
              <span>{T.estimate}</span>
              <strong className="tabular">{formatPrice(p.totals.totalMinor, p.currency)}</strong>
            </div>
            <p className="gm-cartfoot__hint">{T.taxesNote} {p.mode === 'auto' ? T.autoHint : T.confirmHint}</p>
            <button type="button" className="gm-cta gm-press" disabled={!p.canOrder || p.sending} onClick={p.onSend}>
              {p.sending ? <Loader2 size={18} className="gm-spin" aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
              <span>{p.sending ? T.sending : T.sendOrder}</span>
              <span className="gm-cta__amt tabular">{formatPrice(p.totals.totalMinor, p.currency)}</span>
            </button>
          </div>
        )
      }
    >
      {p.notice ? <p className="gm-note" role="status">{p.notice}</p> : null}
      {empty ? (
        <p className="gm-empty">{T.emptyCart}</p>
      ) : (
        <>
          <ul className="gm-lines">
            {p.lines.map((l) => {
              const item = p.items.get(l.itemId);
              return item ? <Line key={l.key} line={l} item={item} currency={p.currency} onQty={p.onQty} onNote={p.onNote} /> : null;
            })}
          </ul>
          <label className="gm-field">
            <span>{T.orderNote}</span>
            <textarea value={p.orderNote} maxLength={200} rows={2} placeholder={T.notePlaceholder} onChange={(e) => p.onOrderNote(e.target.value)} />
          </label>
        </>
      )}
    </Sheet>
  );
}
