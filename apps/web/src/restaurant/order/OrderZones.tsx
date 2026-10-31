import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';

export type ZoneView = 'menu' | 'order';

/**
 * Lays out the two zones. Desktop (lg and up): menu and order side by side, both always visible.
 * Phones: one zone at a time. The menu is the default and a sticky bottom bar "Order (n)" opens the added list;
 * from the list a bar button returns to the menu. Both zones stay mounted so scroll position and typing survive.
 */
export function OrderZones({
  menu,
  order,
  count,
  view,
  onView,
}: {
  menu: ReactNode;
  order: ReactNode;
  /** Items in the order, for the bar label. */
  count: number;
  view: ZoneView;
  onView: (v: ZoneView) => void;
}) {
  const { t } = useTranslation();
  const orderRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  // Move focus into the zone that was just revealed (not on first paint).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const box = view === 'order' ? orderRef.current : menuRef.current;
    box?.querySelector<HTMLElement>('h3')?.focus();
  }, [view]);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div ref={menuRef} data-view-pane="menu" className={cn('flex h-[54dvh] min-h-0 flex-col lg:h-[min(64dvh,38rem)]', view === 'order' && 'hidden lg:flex')}>
          {menu}
        </div>
        <div ref={orderRef} data-view-pane="order" className={cn('flex h-[54dvh] min-h-0 flex-col lg:h-[min(64dvh,38rem)]', view === 'menu' && 'hidden lg:flex')}>
          {order}
        </div>
      </div>
      <div className="sticky bottom-0 z-10 -mx-1 lg:hidden" data-testid="zone-bar">
        {view === 'menu' ? (
          <button
            type="button"
            onClick={() => onView('order')}
            className="nx-press flex min-h-14 w-full items-center justify-between gap-3 rounded-panel border border-accent/50 bg-sunken px-4 text-left shadow-[0_-12px_30px_-12px_rgb(0_0_0/0.8)]"
          >
            <span className="text-base font-semibold">{t('restaurant.orderZones.mobile.openOrder', { count })}</span>
            <span className="text-sm text-accent-strong">{t('restaurant.orderZones.mobile.openOrderHint')} &rsaquo;</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onView('menu')}
            className="nx-press flex min-h-14 w-full items-center justify-between gap-3 rounded-panel border border-line bg-surface px-4 text-left shadow-[0_-12px_30px_-12px_rgb(0_0_0/0.8)]"
          >
            <span className="text-base font-semibold">&lsaquo; {t('restaurant.orderZones.mobile.backToMenu')}</span>
            <span className="tabular text-sm text-muted">{t('restaurant.orderZones.mobile.openOrder', { count })}</span>
          </button>
        )}
      </div>
    </div>
  );
}
