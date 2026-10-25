import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { EmptyState } from '../ui/states';
import { Tabs } from '../ui/Tabs';
import { describeError } from './errors';
import { useSingleFlight } from './hooks';
import {
  type CatalogCategory,
  type CatalogItem,
  type ServiceRequest,
  formatMinorUnits,
  orderApi,
} from './api';

const OTHER = '__other';

function ItemRow({
  item,
  qty,
  locked,
  onAdjust,
}: {
  item: CatalogItem;
  qty: number;
  locked: boolean;
  onAdjust: (d: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <li className="flex items-center justify-between gap-3 border-b border-line/60 py-2 last:border-0">
      <div className="min-w-0">
        <p className="text-base font-medium">{item.name}</p>
        <p className="tabular text-sm text-muted">{formatMinorUnits(item.basePriceMinorUnits)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1" role="group" aria-label={t('restaurant.builder.quantity', { name: item.name })}>
        {qty > 0 && (
          <>
            <button
              type="button"
              disabled={locked}
              aria-label={t('restaurant.builder.remove', { name: item.name })}
              onClick={() => onAdjust(-1)}
              className="grid size-11 place-items-center rounded-control border border-line bg-surface text-xl hover:bg-sunken disabled:opacity-50"
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
          className="grid size-11 place-items-center rounded-control bg-accent text-xl text-surface hover:bg-accent-strong disabled:opacity-50"
        >
          <span aria-hidden>+</span>
        </button>
      </div>
    </li>
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
  const [cart, setCart] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [category, setCategory] = useState('all');
  const [draftSaved, setDraftSaved] = useState(false);
  const { busy, run } = useSingleFlight();
  // A draft that was created but not yet sent is remembered so a retry never
  // creates a duplicate order (same idempotency key, same draft).
  const idempotencyKey = useRef(crypto.randomUUID());
  const draftId = useRef<string | null>(null);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const total = Object.entries(cart).reduce((sum, [id, qty]) => sum + (itemById.get(id)?.basePriceMinorUnits ?? 0) * qty, 0);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);

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

  function adjust(itemId: string, delta: number) {
    setError('');
    setCart((prev) => {
      const next = { ...prev };
      const cur = (next[itemId] ?? 0) + delta;
      if (cur <= 0) delete next[itemId];
      else next[itemId] = cur;
      return next;
    });
  }

  async function send() {
    const lines = Object.entries(cart).map(([catalogItemId, quantity]) => ({ catalogItemId, quantity, modifiers: [] }));
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
            <span className="block text-sm text-muted">{t('restaurant.builder.itemsInOrder', { count })}</span>
            <span className="tabular font-display text-2xl font-semibold">{formatMinorUnits(total)}</span>
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
                <h3 className="mb-1 text-lg font-semibold">{g.name}</h3>
                <ul>
                  {g.items.map((item) => (
                    <ItemRow key={item.id} item={item} qty={cart[item.id] ?? 0} locked={locked} onAdjust={(d) => adjust(item.id, d)} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
      <p role="alert" className="mt-3 text-sm text-bad">
        {error}
      </p>
    </Dialog>
  );
}
