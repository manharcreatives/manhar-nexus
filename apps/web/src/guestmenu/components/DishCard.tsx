import { memo } from 'react';
import { Plus, Settings2 } from 'lucide-react';
import { useDepth, usePointerTilt, useReveal } from '../motion';
import { formatPrice } from '../format';
import { T } from '../strings';
import type { MenuItem } from '../types';
import { BlurImage, Spice, Stepper, VegMark } from './ui';

export interface DishCardProps {
  item: MenuItem;
  currency: string;
  qty: number;
  canOrder: boolean;
  index: number;
  onOpen: (item: MenuItem) => void;
  /** Quick add (no variants / add-ons / required choices). */
  onQuickAdd: (item: MenuItem) => void;
  onSetQty: (item: MenuItem, qty: number) => void;
}

const needsSheet = (i: MenuItem) => i.variants.length > 0 || i.addOnGroups.length > 0;
const fromPrice = (i: MenuItem) => (i.variants.length ? Math.min(...i.variants.map((v) => v.priceMinor)) : i.priceMinor);

function DishCardImpl({ item, currency, qty, canOrder, index, onOpen, onQuickAdd, onSetQty }: DishCardProps) {
  const reveal = useReveal<HTMLElement>();
  const depth = useDepth<HTMLElement>();
  const tilt = usePointerTilt<HTMLElement>(5);
  const hasPhoto = !!item.imageUrl;
  const sheet = needsSheet(item);
  const chips = item.tags.slice(0, 2);
  const priceFrom = item.variants.length > 1 && new Set(item.variants.map((v) => v.priceMinor)).size > 1;

  return (
    <article
      ref={(el) => {
        reveal(el);
        depth(el);
      }}
      className="gm-card"
      data-photo={hasPhoto || undefined}
      data-sold={item.soldOut || undefined}
      data-reveal
      style={{ ['--i' as string]: index % 3 }}
      {...tilt}
    >
      <div className="gm-card__tilt">
        {hasPhoto ? (
          <button type="button" className="gm-card__media gm-press" onClick={() => onOpen(item)} aria-label={`${item.name}, ${formatPrice(fromPrice(item), currency)}. Details`}>
            <BlurImage src={item.imageUrl} blur={item.blurDataUri} className="gm-card__img" width={800} height={640} />
            <span className="gm-card__glare" aria-hidden="true" />
            <span className="gm-card__scrim" aria-hidden="true" />
            <span className="gm-card__badges">
              <VegMark kind={item.veg} />
              {chips.map((c) => (
                <span key={c} className="gm-chip">{c}</span>
              ))}
            </span>
            {item.soldOut ? <span className="gm-soldout">{T.soldOut}</span> : null}
          </button>
        ) : null}
        <div className="gm-card__body">
          <div className="gm-card__title">
            {!hasPhoto ? <VegMark kind={item.veg} /> : null}
            <h3>
              <button type="button" className="gm-link" onClick={() => onOpen(item)}>{item.name}</button>
            </h3>
            <Spice level={item.spice} />
          </div>
          {item.description ? <p className="gm-card__desc">{item.description}</p> : null}
          {!hasPhoto && (chips.length || item.soldOut) ? (
            <div className="gm-card__chips">
              {chips.map((c) => (
                <span key={c} className="gm-chip">{c}</span>
              ))}
              {item.soldOut ? <span className="gm-chip gm-chip--bad">{T.soldOut}</span> : null}
            </div>
          ) : null}
          <div className="gm-card__foot">
            <p className="gm-price tabular">
              {priceFrom ? <span className="gm-price__from">from </span> : null}
              {formatPrice(fromPrice(item), currency)}
            </p>
            {canOrder && !item.soldOut ? (
              qty > 0 && !sheet ? (
                <Stepper qty={qty} onChange={(n) => onSetQty(item, n)} label={item.name} size="sm" removeIcon />
              ) : (
                <button type="button" className="gm-add gm-press" onClick={() => (sheet ? onOpen(item) : onQuickAdd(item))} aria-label={`${sheet ? T.customise : T.add} ${item.name}`}>
                  {sheet ? <Settings2 size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                  <span>{sheet ? T.customise : T.add}</span>
                  {qty > 0 ? <b className="gm-add__qty tabular" aria-label={`${qty} in your order`}>{qty}</b> : null}
                </button>
              )
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

export const DishCard = memo(DishCardImpl);
