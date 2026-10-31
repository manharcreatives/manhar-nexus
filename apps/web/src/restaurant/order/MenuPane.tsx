import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';
import { EmptyState } from '../../ui/states';
import { type CatalogCategory, type CatalogItem, formatMinorUnits } from '../api';
import { availableVariants, needsConfiguration } from '../cart';
import type { GroupsState } from './useModifierGroups';

const OTHER = '__other';
const ALL = 'all';

/**
 * Zone (b): the menu to pick from. It never lists what is already ordered as a line; an item that is in the order
 * only carries a badge with its quantity. Adding happens here, changing quantities / notes / removing in the
 * order panel, so the two jobs never share a control.
 */
export function MenuPane({
  categories,
  items,
  qtyFor,
  locked,
  groupsState,
  onAddPlain,
  onConfigure,
}: {
  categories: CatalogCategory[];
  items: CatalogItem[];
  /** Quantity of an item currently in the order (all configurations). */
  qtyFor: (itemId: string) => number;
  locked: boolean;
  groupsState: GroupsState;
  onAddPlain: (item: CatalogItem) => void;
  onConfigure: (item: CatalogItem) => void;
}) {
  const { t } = useTranslation();
  const hid = useId();
  const searchId = useId();
  const [category, setCategory] = useState(ALL);
  const [query, setQuery] = useState('');

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

  const q = query.trim().toLowerCase();
  const visible = (category === ALL ? groups : groups.filter((g) => g.key === category))
    .map((g) => ({ ...g, items: q ? g.items.filter((i) => i.name.toLowerCase().includes(q)) : g.items }))
    .filter((g) => g.items.length > 0);
  const tabs = [{ key: ALL, label: t('restaurant.builder.allCategories') }, ...groups.map((g) => ({ key: g.key, label: g.name }))];

  return (
    <section aria-labelledby={hid} data-zone="menu" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel border border-line bg-surface">
      <header className="border-b border-line px-4 pt-3 pb-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id={hid} className="font-display text-lg font-semibold">
            {t('restaurant.orderZones.menu.heading')}
          </h3>
          <p className="hidden text-xs text-muted sm:block">{t('restaurant.orderZones.menu.hint')}</p>
        </div>
        <div className="relative mt-2">
          <label htmlFor={searchId} className="sr-only">
            {t('restaurant.orderZones.menu.searchLabel')}
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('restaurant.orderZones.menu.searchPlaceholder')}
            autoComplete="off"
            className="min-h-12 w-full rounded-control border border-line bg-white/[0.035] px-3 text-base hover:border-muted/70"
          />
        </div>
        {groups.length > 1 && (
          <div role="tablist" aria-label={t('restaurant.builder.categoryTabs')} className="mt-2 -mb-1 flex gap-1.5 overflow-x-auto pb-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                type="button"
                aria-selected={category === tab.key}
                onClick={() => setCategory(tab.key)}
                className={cn(
                  'min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors duration-(--duration-micro)',
                  category === tab.key ? 'border-accent/60 bg-accent/15 text-ink' : 'border-line text-muted hover:border-muted/60 hover:text-ink',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </header>

      <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {groups.length === 0 ? (
          <div className="p-3">
            <EmptyState title={t('restaurant.builder.emptyTitle')} body={t('restaurant.builder.emptyBody')} />
          </div>
        ) : visible.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted" role="status">
            {t('restaurant.orderZones.menu.noMatch', { query: query.trim() })}
          </p>
        ) : (
          visible.map((g) => (
            <section key={g.key} className="mb-2" aria-label={g.name}>
              <h4 className="eyebrow sticky top-0 z-[1] bg-surface/95 px-2 py-2 text-muted backdrop-blur">{g.name}</h4>
              <ul>
                {g.items.map((item) => {
                  const qty = qtyFor(item.id);
                  const configurable = needsConfiguration(item);
                  const variants = availableVariants(item);
                  const fromPrice = variants.length > 1 ? item.basePriceMinorUnits + Math.min(...variants.map((v) => v.priceAdjMinorUnits)) : null;
                  const linked = item.modifierGroups?.length ?? 0;
                  return (
                    <li
                      key={item.id}
                      data-item-id={item.id}
                      data-in-order={qty > 0 || undefined}
                      className={cn(
                        'flex items-center justify-between gap-3 rounded-control border-l-2 px-3 py-2 transition-colors',
                        qty > 0 ? 'border-accent bg-accent/[0.07]' : 'border-transparent hover:bg-white/[0.03]',
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-base leading-snug font-medium">{item.name}</p>
                        <p className="tabular flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                          <span>{fromPrice !== null ? t('restaurant.builder.fromPrice', { price: formatMinorUnits(fromPrice) }) : formatMinorUnits(item.basePriceMinorUnits)}</span>
                          {qty > 0 && (
                            <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-semibold text-accent-strong">
                              {t('restaurant.orderZones.menu.inOrder', { count: qty })}
                            </span>
                          )}
                        </p>
                      </div>
                      {configurable ? (
                        <button
                          type="button"
                          disabled={locked || (linked > 0 && groupsState !== 'ready')}
                          aria-label={t('restaurant.builder.choose', { name: item.name })}
                          onClick={() => onConfigure(item)}
                          className="nx-press min-h-12 min-w-20 shrink-0 rounded-control border border-accent/50 px-4 text-base font-semibold text-accent-strong hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {t('restaurant.builder.chooseShort')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={locked}
                          aria-label={t('restaurant.builder.add', { name: item.name })}
                          onClick={() => onAddPlain(item)}
                          className="nx-press grid size-12 shrink-0 place-items-center rounded-control bg-accent text-2xl font-semibold text-on-accent hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span aria-hidden>+</span>
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </section>
  );
}
