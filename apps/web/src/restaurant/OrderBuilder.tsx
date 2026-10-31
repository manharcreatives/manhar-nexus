import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { LedgerFigure } from '../ui/LedgerFigure';
import { describeError } from './errors';
import { useSingleFlight } from './hooks';
import { type CatalogCategory, type CatalogItem, type ServiceRequest, orderApi } from './api';
import {
  type CartLine,
  addLine,
  adjustLine,
  buildLine,
  cartCount,
  cartTotal,
  itemGroups,
  lineDetail,
  removeLine,
  setLineNote,
  toApiLines,
} from './cart';
import { ItemConfigDialog } from './ItemConfigDialog';
import { MenuPane } from './order/MenuPane';
import { OrderPane, type PaneLine } from './order/OrderPane';
import { OrderZones, type ZoneView } from './order/OrderZones';
import { useModifierGroups } from './order/useModifierGroups';

/**
 * Order taking. Two separate zones (update round 2, A3): the MENU to pick from, and the ADDED order with
 * quantities, notes, per-line state and the running total. Desktop shows them side by side; phones show the menu
 * with a sticky "Order (n)" bar that opens the added list.
 */
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
  const [error, setError] = useState('');
  const [draftSaved, setDraftSaved] = useState(false);
  const [view, setView] = useState<ZoneView>('menu');
  const { busy, run } = useSingleFlight();
  const { groupsById, groupsState } = useModifierGroups(items);
  // A draft that was created but not yet sent is remembered so a retry never
  // creates a duplicate order (same idempotency key, same draft).
  const idempotencyKey = useRef(crypto.randomUUID());
  const draftId = useRef<string | null>(null);

  const total = cartTotal(cart);
  const count = cartCount(cart);
  const locked = busy || draftSaved;

  const qtyFor = (itemId: string) => cart.filter((l) => l.itemId === itemId).reduce((n, l) => n + l.quantity, 0);

  function addPlain(item: CatalogItem) {
    setError('');
    setCart((prev) => addLine(prev, buildLine(item, [], { variantId: null, options: {} }, '', 1)));
  }
  const adjust = (key: string, delta: number) => {
    setError('');
    setCart((prev) => adjustLine(prev, key, delta));
  };

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

  const paneLines: PaneLine[] = cart.map((l) => ({
    id: l.key,
    name: l.itemName,
    detail: lineDetail(l),
    note: l.note,
    quantity: l.quantity,
    unitMinor: l.unitPriceMinorUnits,
    chip: draftSaved ? 'saved' : 'new',
  }));

  return (
    <Dialog
      open
      onClose={onCancel}
      title={t('restaurant.builder.title', { code: tableCode })}
      className="w-[min(72rem,calc(100vw-1rem))]!"
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
      <OrderZones
        count={count}
        view={view}
        onView={setView}
        menu={
          <MenuPane
            categories={categories}
            items={items}
            qtyFor={qtyFor}
            locked={locked}
            groupsState={groupsState}
            onAddPlain={addPlain}
            onConfigure={setConfigItem}
          />
        }
        order={
          <OrderPane
            lines={paneLines}
            locked={locked}
            onAdjust={adjust}
            onRemove={(key) => setCart((prev) => removeLine(prev, key))}
            onNote={(key, note) => setCart((prev) => setLineNote(prev, key, note))}
          />
        }
      />
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
