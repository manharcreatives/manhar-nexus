import { useTranslation } from 'react-i18next';
import { StatusPill } from '../ui/StatusPill';
import * as Icons from './icons';
import { useGuestOrders } from './GuestOrderProvider';

/** Count bubble for the "Guest orders" sidebar entry (orders waiting + open waiter calls). */
export function GuestOrdersNavBadge() {
  const { t } = useTranslation();
  const { attention } = useGuestOrders();
  if (attention <= 0) return null;
  return (
    <span
      aria-label={t('qr.nav.badge', { count: attention })}
      className="tabular ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-xs font-semibold text-on-accent shadow-[0_0_12px_rgb(var(--accent-rgb)/0.6)]"
    >
      {attention > 99 ? '99+' : attention}
    </span>
  );
}

/** "Guest" source chip for orders placed from a table QR code (used on tables and order lists). */
export function GuestSourceChip({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span className={className}>
      <StatusPill tone="accent">
        <Icons.QrCode className="size-3" aria-hidden />
        {t('qr.chip.guest')}
      </StatusPill>
    </span>
  );
}

/**
 * Additive chips for a table tile: guest orders waiting, waiter called, bill requested.
 * Renders nothing when the table has none, or the user cannot handle guest orders.
 */
export function TableGuestChips({ tableId }: { tableId: string }) {
  const { t } = useTranslation();
  const { byTable } = useGuestOrders();
  const info = byTable.get(tableId);
  if (!info || (info.pending === 0 && !info.call)) return null;
  return (
    <span className="mt-2 flex flex-wrap gap-1.5" data-testid={`guest-chips-${tableId}`}>
      {info.pending > 0 && (
        <StatusPill tone="accent">
          <Icons.QrCode className="size-3" aria-hidden />
          {t('qr.chip.pending', { count: info.pending })}
        </StatusPill>
      )}
      {info.call && (
        <StatusPill tone="warn">
          <Icons.BellRing className="size-3" aria-hidden />
          {t(`qr.alerts.reason.${info.call.reason}`)}
        </StatusPill>
      )}
    </span>
  );
}
