import { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { Sheet, Spice, Stepper, VegMark, BlurImage } from './ui';
import { MAX_NOTE, checkSelection, defaultVariantId, toggleOption, unitPriceMinor } from '../cart';
import { formatDelta, formatPrice } from '../format';
import { T } from '../strings';
import type { AddOnGroup, MenuItem } from '../types';

export interface ItemSheetProps {
  item: MenuItem | null;
  currency: string;
  canOrder: boolean;
  onClose: () => void;
  onAdd: (item: MenuItem, sel: { variantId?: string; addOnOptionIds: string[]; qty: number; note?: string }) => void;
}

function groupHint(g: AddOnGroup): string {
  if (g.min >= 1 && g.max === 1) return T.chooseOne;
  if (g.min >= 1) return g.max > g.min ? `${T.pickAtLeast(g.min)} · ${T.upTo(g.max)}` : T.pickAtLeast(g.min);
  return g.max > 0 ? `${T.optional} · ${T.upTo(g.max)}` : T.optional;
}

export function ItemSheet({ item, currency, canOrder, onClose, onAdd }: ItemSheetProps) {
  // Keep the last item mounted while the sheet animates out.
  const [shown, setShown] = useState<MenuItem | null>(item);
  useEffect(() => {
    if (item) setShown(item);
  }, [item]);
  const it = item ?? shown;
  return (
    <Sheet
      open={!!item}
      onClose={onClose}
      title={it?.name ?? ''}
      hideTitle
      tall
      className={`gm-item ${it?.imageUrl ? 'gm-item--photo' : ''}`}
      hero={it?.imageUrl ? (
        <div className="gm-item__hero">
          <BlurImage src={it.imageUrl} blur={it.blurDataUri} color={it.color} priority className="gm-item__img" width={800} height={640} />
          <span className="gm-item__fade" aria-hidden="true" />
        </div>
      ) : undefined}
      footer={null}
    >
      {it ? <ItemForm key={it.id} item={it} currency={currency} canOrder={canOrder} onAdd={onAdd} /> : null}
    </Sheet>
  );
}

function ItemForm({ item, currency, canOrder, onAdd }: { item: MenuItem; currency: string; canOrder: boolean; onAdd: ItemSheetProps['onAdd'] }) {
  const [variantId, setVariantId] = useState<string | undefined>(defaultVariantId(item));
  const [opts, setOpts] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const check = useMemo(() => checkSelection(item, variantId, opts), [item, variantId, opts]);
  const unit = unitPriceMinor(item, variantId, opts);
  const total = unit * qty;
  const orderable = canOrder && !item.soldOut;

  return (
    <div className="gm-form">
      <div className="gm-form__intro">
        <div className="gm-card__title">
          <VegMark kind={item.veg} />
          <h3 className="gm-form__name">{item.name}</h3>
          <Spice level={item.spice} />
        </div>
        {item.tags.length ? (
          <div className="gm-card__chips">
            {item.tags.map((t) => (
              <span key={t} className="gm-chip">{t}</span>
            ))}
          </div>
        ) : null}
        {item.description ? <p className="gm-form__desc">{item.description}</p> : null}
        {!item.variants.length ? <p className="gm-price gm-price--lg tabular">{formatPrice(item.priceMinor, currency)}</p> : null}
        {item.soldOut ? <p className="gm-note gm-note--bad">{T.soldOut}</p> : null}
      </div>

      {orderable ? (
        <>
          {item.variants.length ? (
            <fieldset className="gm-group">
              <legend><span>{T.choose}</span><em>{T.required}</em></legend>
              <div className="gm-opts">
                {item.variants.map((v) => (
                  <label key={v.id} className="gm-opt" data-on={variantId === v.id || undefined}>
                    <input type="radio" name={`v-${item.id}`} checked={variantId === v.id} onChange={() => setVariantId(v.id)} />
                    <span className="gm-opt__mark" aria-hidden="true">{variantId === v.id ? <Check size={14} strokeWidth={3} /> : null}</span>
                    <span className="gm-opt__name">{v.name}</span>
                    <span className="gm-opt__price tabular">{formatPrice(v.priceMinor, currency)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          {item.addOnGroups.map((g) => {
            const single = g.max === 1;
            const err = check.groups[g.id];
            return (
              <fieldset key={g.id} className="gm-group" data-error={err || undefined}>
                <legend><span>{g.name}</span><em>{groupHint(g)}</em></legend>
                <div className="gm-opts">
                  {g.options.map((o) => {
                    const on = opts.includes(o.id);
                    const full = !on && !single && g.max > 0 && g.options.filter((x) => opts.includes(x.id)).length >= g.max;
                    return (
                      <label key={o.id} className="gm-opt" data-on={on || undefined} data-disabled={full || undefined}>
                        <input
                          type={single ? 'radio' : 'checkbox'}
                          name={`g-${g.id}`}
                          checked={on}
                          disabled={full}
                          onChange={() => setOpts((cur) => toggleOption(g, cur, o.id))}
                        />
                        <span className="gm-opt__mark" data-round={single || undefined} aria-hidden="true">{on ? <Check size={14} strokeWidth={3} /> : null}</span>
                        <span className="gm-opt__name">{o.name}</span>
                        <span className="gm-opt__price tabular">{formatDelta(o.priceMinor, currency)}</span>
                      </label>
                    );
                  })}
                </div>
                {err === 'min' ? <p className="gm-hint" role="status">{g.min === 1 ? T.chooseOne : T.pickAtLeast(g.min)}</p> : null}
              </fieldset>
            );
          })}

          <label className="gm-field">
            <span>{T.noteLabel}</span>
            <textarea value={note} maxLength={MAX_NOTE} rows={2} placeholder={T.notePlaceholder} onChange={(e) => setNote(e.target.value)} />
          </label>

          <div className="gm-form__bar">
            <Stepper qty={qty} min={1} max={20} onChange={setQty} label={item.name} />
            <button
              type="button"
              className="gm-cta gm-press"
              disabled={!check.ok}
              onClick={() => onAdd(item, { variantId, addOnOptionIds: opts, qty, note: note.trim() || undefined })}
            >
              <span>{T.addToOrder}</span>
              <span className="gm-cta__amt tabular" aria-live="polite">{formatPrice(total, currency)}</span>
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
