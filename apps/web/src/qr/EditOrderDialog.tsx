import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../lib/money';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Textarea } from '../ui/Textarea';
import * as Icons from './icons';
import type { GuestOrder, GuestOrderEdit } from './types';

const lineUnit = (l: GuestOrder['lines'][number]) => l.unitPriceMinor + l.addOns.reduce((s, a) => s + a.priceMinor, 0);

/** Lines whose quantity changed, plus the note when it changed. Empty when nothing changed. */
export function buildEdit(order: GuestOrder, qty: Record<string, number>, note: string): GuestOrderEdit | null {
  const lines = order.lines.filter((l) => (qty[l.id] ?? l.qty) !== l.qty).map((l) => ({ id: l.id, qty: qty[l.id] }));
  const noteChanged = note.trim() !== (order.note ?? '');
  if (lines.length === 0 && !noteChanged) return null;
  return { lines, ...(noteChanged ? { note: note.trim() || null } : {}) };
}

/**
 * Minimal inline editor before accepting: change quantities (0 removes a line) and the order
 * note. The server recomputes prices; the total shown here is only a preview (before tax).
 * ASSUMPTION: a richer edit flow from the order-edit work (S2) can replace this later.
 */
export function EditOrderDialog({ order: fullOrder, busy, onSave, onClose }: { order: GuestOrder; busy: boolean; onSave: (edit: GuestOrderEdit | null) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const order = useMemo(() => ({ ...fullOrder, lines: fullOrder.lines.filter((l) => !l.cancelled) }), [fullOrder]);
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(order.lines.map((l) => [l.id, l.qty])));
  const [note, setNote] = useState(order.note ?? '');

  const total = useMemo(() => order.lines.reduce((s, l) => s + (qty[l.id] ?? l.qty) * lineUnit(l), 0), [order.lines, qty]);
  const remaining = order.lines.filter((l) => (qty[l.id] ?? l.qty) > 0).length;
  const edit = buildEdit(order, qty, note);
  const bump = (id: string, d: number) => setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(50, (q[id] ?? 0) + d)) }));

  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      title={t('qr.orders.editTitle', { table: order.tableCode })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t('qr.common.cancel')}
          </Button>
          <Button onClick={() => onSave(edit)} loading={busy} disabled={remaining === 0}>
            <Icons.Check className="size-4" aria-hidden />
            {edit ? t('qr.orders.saveAccept') : t('qr.orders.accept')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">{t('qr.orders.editBody')}</p>
        <ul className="divide-y divide-white/[0.07]">
          {order.lines.map((l) => {
            const q = qty[l.id] ?? l.qty;
            return (
              <li key={l.id} className="flex items-center gap-3 py-2.5">
                <div className={q === 0 ? 'min-w-0 flex-1 line-through opacity-50' : 'min-w-0 flex-1'}>
                  <p className="text-sm font-medium">
                    {l.name}
                    {l.variantName && <span className="font-normal text-muted"> · {l.variantName}</span>}
                  </p>
                  <p className="tabular text-xs text-muted">{formatMoney(lineUnit(l))}</p>
                </div>
                <div className="flex items-center gap-1" role="group" aria-label={t('qr.orders.qtyGroup', { name: l.name })}>
                  <Button variant="secondary" className="px-3" onClick={() => bump(l.id, -1)} disabled={busy || q === 0} aria-label={t('qr.orders.less', { name: l.name })}>
                    <Icons.Minus className="size-4" aria-hidden />
                  </Button>
                  <output aria-live="polite" className="tabular w-8 text-center text-base font-semibold" data-testid={`qty-${l.id}`}>{q}</output>
                  <Button variant="secondary" className="px-3" onClick={() => bump(l.id, 1)} disabled={busy || q >= 50} aria-label={t('qr.orders.more', { name: l.name })}>
                    <Icons.Plus className="size-4" aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
        {remaining === 0 && <p role="alert" className="rounded-control bg-warn-soft px-3 py-2 text-sm text-warn">{t('qr.orders.removeAll')}</p>}
        <Textarea label={t('qr.orders.orderNote')} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        <p className="flex items-baseline justify-between text-sm">
          <span className="text-muted">{t('qr.orders.previewTotal')}</span>
          <span className="tabular font-display text-lg font-semibold" data-testid="edit-total">{formatMoney(total)}</span>
        </p>
      </div>
    </Dialog>
  );
}
