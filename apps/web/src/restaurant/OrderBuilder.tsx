import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { EmptyState } from '../ui/states';
import { Tabs } from '../ui/Tabs';
import { LedgerFigure } from '../ui/LedgerFigure';
import { describeError } from './errors';
import { useSingleFlight } from './hooks';
import {
  type CatalogCategory,
  type CatalogItem,
  type ModifierGroup,
  type ServiceRequest,
  catalogApi,
  formatMinorUnits,
  orderApi,
} from './api';
import {
  type CartLine,
  addLine,
  adjustLine,
  availableVariants,
  buildLine,
  cartCount,
  cartTotal,
  itemGroups,
  needsConfiguration,
  toApiLines,
} from './cart';
import { ItemConfigDialog } from './ItemConfigDialog';

const OTHER = '__other';

function ItemRow({
  item,
  qty,
  locked,
  configurable,
  configDisabled,
  fromPrice,
  onAdjust,
  onConfigure,
}: {
  item: CatalogItem;
  qty: number;
  locked: boolean;
  configurable: boolean;
  configDisabled: boolean;
  fromPrice: number | null;
  onAdjust: (d: number) => void;
  onConfigure: () => void;
}) {
  const { t } = useTranslation();
  return (
    <li className="flex items-center justify-between gap-3 border-b border-line/60 py-2 last:border-0">
      <div className="min-w-0">
        <p className="text-base font-medium">{item.name}</p>
        <p className="tabular text-sm text-muted">
          {fromPrice !== null
            ? t('restaurant.builder.fromPrice', { price: formatMinorUnits(fromPrice) })
            : formatMinorUnits(item.basePriceMinorUnits)}
          {configurable && qty > 0 && <span> - {t('restaurant.builder.inOrder', { count: qty })}</span>}
        </p>
      </div>
      {configurable ? (
        <Button size="lg" variant="secondary" disabled={locked || configDisabled} onClick={onConfigure} aria-label={t('restaurant.builder.choose', { name: item.name })}>
          {t('restaurant.builder.chooseShort')}
        </Button>
      ) : (
        <div className="flex shrink-0 items-center gap-1" role="group" aria-label={t('restaurant.builder.quantity', { name: item.name })}>
          {qty > 0 && (
            <>
              <button
                type="button"
                disabled={locked}
                aria-label={t('restaurant.builder.remove', { name: item.name })}
                onClick={() => onAdjust(-1)}
                className="grid size-12 place-items-center rounded-control border border-line bg-surface text-xl hover:bg-sunken disabled:opacity-50"
              >
                <span aria-hidden>-</span>
              </button>
              <span className="tabular w-8 text-center text-lg font-semibold" aria-live="polite">
                {qty}
              </span>
            </>
          )}
          <button
            type="button"
            disabled={locked}
            aria-label={t('restaurant.builder.add', { name: item.name })}
            onClick={() => onAdjust(1)}
            className="nx-press grid size-12 place-items-center rounded-control bg-accent text-xl text-surface hover:bg-accent-strong disabled:opacity-50"
          >
            <span aria-hidden>+</span>
          </button>
        </div>
      )}
    </li>
  );
}

function CartSummary({ cart, locked, onAdjust }: { cart: CartLine[]; locked: boolean; onAdjust: (key: string, d: number) => void }) {
  const { t } = useTranslation();
  if (cart.length === 0) return null;
  return (
    <section className="mt-4 border-t border-line pt-3" aria-label={t('restaurant.builder.cartTitle')}>
      <h3 className="mb-1 text-lg font-semibold">{t('restaurant.builder.cartTitle')}</h3>
      <ul>
        {cart.map((l) => {
          const detail = [l.variantName, ...l.optionNames].filter(Boolean).join(', ');
          return (
            <li key={l.key} className="flex items-center justify-between gap-3 border-b border-line/60 py-2 last:border-0">
              <div className="min-w-0">
                <p className="text-base font-medium">{l.itemName}</p>
                {detail && <p className="text-sm text-muted">{detail}</p>}
                {l.note && (
                  <p className="text-sm text-muted">
                    {t('restaurant.builder.notePrefix')} {l.note}
                  </p>
                )}
                <p className="tabular text-sm">{formatMinorUnits(l.unitPriceMinorUnits * l.quantity)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1" role="group" aria-label={t('restaurant.builder.quantity', { name: l.itemName })}>
                <button
                  type="button"
                  disabled={locked}
                  aria-label={l.quantity === 1 ? t('restaurant.builder.removeLine', { name: l.itemName }) : t('restaurant.builder.remove', { name: l.itemName })}
                  onClick={() => onAdjust(l.key, -1)}
                  className="grid size-12 place-items-center rounded-control border border-line bg-surface text-xl hover:bg-sunken disabled:opacity-50"
                >
                  <span aria-hidden>-</span>
                </button>
                <span className="tabular w-8 text-center text-lg font-semibold">{l.quantity}</span>
                <button
                  type="button"
                  disabled={locked}
                  aria-label={t('restaurant.builder.add', { name: l.itemName })}
                  onClick={() => onAdjust(l.key, 1)}
                  className="grid size-12 place-items-center rounded-control border border-line bg-surface text-xl hover:bg-sunken disabled:opacity-50"
                >
                  <span aria-hidden>+</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function OrderBuilder({
  sessionId,
  tableCode,
  categories,
  items,
  onSent,
  onCancel,
}: {
  sessionId: string;
  tableCode: string;
  categories: CatalogCategory[];
  items: CatalogItem[];
  onSent: (order: ServiceRequest) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [configItem, setConfigItem] = useState<CatalogItem | null>(null);
  const [groupsById, setGroupsById] = useState<ReadonlyMap<string, ModifierGroup>>(new Map());
  const [groupsState, setGroupsState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [error, setError] = useState('');
  const [category, setCategory] = useState('all');
  const [draftSaved, setDraftSaved] = useState(false);
  const { busy, run } = useSingleFlight();
  // A draft that was created but not yet sent is remembered so a retry never
  // creates a duplicate order (same idempotency key, same draft).
  const idempotencyKey = useRef(crypto.randomUUID());
  const draftId = useRef<string | null>(null);

  const needsGroups = useMemo(() => items.some((i) => (i.modifierGroups?.length ?? 0) > 0), [items]);
  useEffect(() => {
    if (!needsGroups) {
      setGroupsState('ready');
      return;
    }
    let live = true;
    catalogApi
      .listModifierGroups()
      .then((list) => {
        if (!live) return;
        setGroupsById(new Map(list.map((g) => [g.id, g])));
        setGroupsState('ready');
      })
      .catch(() => {
        if (live) setGroupsState('failed');
      });
    return () => {
      live = false;
    };
  }, [needsGroups]);

  const total = cartTotal(cart);
  const count = cartCount(cart);

  const groups = useMemo(() => {
    const active = items.filter((i) => i.isActive);
    const activeCats = categories.filter((c) => c.isActive);
    const cats = [...activeCats]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((c) => ({ key: c.id, name: c.name, items: active.filter((i) => i.categoryId === c.id) }))
      .filter((g) => g.items.length > 0);
    const known = new Set(activeCats.map((c) => c.id));
    const other = active.filter((i) => !i.categoryId || !known.has(i.categoryId));
    if (other.length > 0) cats.push({ key: OTHER, name: t('restaurant.builder.otherCategory'), items: other });
    return cats;
  }, [categories, items, t]);

  const visible = category === 'all' ? groups : groups.filter((g) => g.key === category);
  const locked = busy || draftSaved;

  /** Total quantity of an item across all its configurations. */
  function qtyFor(item: CatalogItem): number {
    return cart.filter((l) => l.itemId === item.id).reduce((n, l) => n + l.quantity, 0);
  }

  function adjustPlain(item: CatalogItem, delta: number) {
    setError('');
    setCart((prev) => {
      const line = buildLine(item, [], { variantId: null, options: {} }, '', 1);
      return delta > 0 ? addLine(prev, line) : adjustLine(prev, line.key, delta);
    });
  }

  function adjustLineQty(key: string, delta: number) {
    setError('');
    setCart((prev) => adjustLine(prev, key, delta));
  }

  async function send() {
    const lines = toApiLines(cart);
    if (lines.length === 0) {
      setError(t('restaurant.builder.emptyCart'));
      return;
    }
    setError('');
    await run(async () => {
      try {
        if (!draftId.current) {
          const draft = await orderApi.create({ sessionId, idempotencyKey: idempotencyKey.current, lines });
          draftId.current = draft.id;
          setDraftSaved(true);
        }
        const sent = await orderApi.send(draftId.current);
        onSent(sent);
      } catch (err) {
        const base = describeError(err, t, 'restaurant.errors.sendOrder');
        setError(draftId.current ? `${base} ${t('restaurant.builder.draftSaved')}` : base);
      }
    });
  }

  const tabs = [{ key: 'all', label: t('restaurant.builder.allCategories') }, ...groups.map((g) => ({ key: g.key, label: g.name }))];

  return (
    <Dialog
      open
      onClose={onCancel}
      title={t('restaurant.builder.title', { code: tableCode })}
      className="w-[min(42rem,calc(100vw-1rem))]!"
      footer={
        <>
          <p className="mr-auto" aria-live="polite">
            <span className="eyebrow block">{t('restaurant.builder.itemsInOrder', { count })}</span>
            <LedgerFigure minor={total} className="mt-1 text-[1.75rem]" />
          </p>
          <Button variant="secondary" size="lg" onClick={onCancel}>
            {t('restaurant.common.cancel')}
          </Button>
          <Button size="lg" loading={busy} disabled={count === 0} onClick={() => void send()}>
            {busy ? t('restaurant.builder.sending') : t('restaurant.builder.send')}
          </Button>
        </>
      }
    >
      {groups.length === 0 ? (
        <EmptyState title={t('restaurant.builder.emptyTitle')} body={t('restaurant.builder.emptyBody')} />
      ) : (
        <>
          {groups.length > 1 && <Tabs items={tabs} active={category} onChange={setCategory} label={t('restaurant.builder.categoryTabs')} />}
          <div role="tabpanel" className="max-h-[50dvh] overflow-y-auto pr-1">
            {visible.map((g) => (
              <section key={g.key} className="mb-4">
                <h3 className="eyebrow mb-1 pt-1">{g.name}</h3>
                <ul>
                  {g.items.map((item) => {
                    const configurable = needsConfiguration(item);
                    const linked = item.modifierGroups?.length ?? 0;
                    const variants = availableVariants(item);
                    const fromPrice =
                      variants.length > 1 ? item.basePriceMinorUnits + Math.min(...variants.map((v) => v.priceAdjMinorUnits)) : null;
                    return (
                      <ItemRow
                        key={item.id}
                        item={item}
                        qty={qtyFor(item)}
                        locked={locked}
                        configurable={configurable}
                        configDisabled={linked > 0 && groupsState !== 'ready'}
                        fromPrice={fromPrice}
                        onAdjust={(d) => adjustPlain(item, d)}
                        onConfigure={() => setConfigItem(item)}
                      />
                    );
                  })}
                </ul>
              </section>
            ))}
            <CartSummary cart={cart} locked={locked} onAdjust={adjustLineQty} />
          </div>
        </>
      )}
      {groupsState === 'failed' && (
        <p role="alert" className="mt-3 text-sm text-bad">
          {t('restaurant.builder.optionsLoadFailed')}
        </p>
      )}
      {configItem && (
        <ItemConfigDialog
          item={configItem}
          groups={itemGroups(configItem, groupsById)}
          onClose={() => setConfigItem(null)}
          onAdd={(line) => {
            setError('');
            setCart((prev) => addLine(prev, line));
            setConfigItem(null);
          }}
        />
      )}
      <p role="alert" className="mt-3 text-sm text-bad">
        {error}
      </p>
    </Dialog>
  );
}
