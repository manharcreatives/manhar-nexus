import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { formatMoney } from '../lib/money';
import { Button } from '../ui/Button';
import { StatusPill } from '../ui/StatusPill';
import { GuestSourceChip } from './GuestBadges';
import * as Icons from './icons';
import { formatWaiting, urgency, waitingMinutes } from './time';
import type { GuestOrder } from './types';

const URGENCY_PILL = { ok: 'neutral', warn: 'warn', bad: 'bad' } as const;

export function GuestOrderCard({
  order,
  now,
  busy,
  onAccept,
  onEdit,
  onReject,
}: {
  order: GuestOrder;
  now: number;
  busy: boolean;
  onAccept: (o: GuestOrder) => void;
  onEdit: (o: GuestOrder) => void;
  onReject: (o: GuestOrder) => void;
}) {
  const { t } = useTranslation();
  const mins = waitingMinutes(order.placedAt, now);
  const level = urgency(mins);
  return (
    <article
      aria-label={t('qr.orders.cardAria', { table: order.tableCode })}
      data-urgency={level}
      className={cn('nx-stub nx-glass flex h-full flex-col rounded-panel', level === 'bad' && 'border-bad/40!')}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 px-4 pt-4 pb-3">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-baseline gap-x-2.5">
            <span className="font-display text-2xl leading-none font-semibold tracking-[-0.02em]">{order.tableCode}</span>
            {order.areaName && <span className="text-sm text-muted">{order.areaName}</span>}
          </h3>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            {order.requestNumber && <span className="ticket-no text-xs">{order.requestNumber}</span>}
            {order.guestName && (
              <span className="inline-flex items-center gap-1">
                <Icons.UserRound className="size-3.5" aria-hidden />
                {order.guestName}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusPill tone={URGENCY_PILL[level]}>
            <Icons.Clock className="size-3" aria-hidden />
            <span data-testid="waiting">{t('qr.orders.waiting', { time: formatWaiting(mins, t) })}</span>
          </StatusPill>
          <GuestSourceChip />
        </div>
      </div>
      <div className="nx-tear" />
      <ul className="flex-1 space-y-2.5 px-4 pt-3 pb-3">
        {order.lines.map((line) => (
          <li key={line.id} className="text-base">
            <p className="flex items-baseline gap-2">
              <span className="tabular w-7 shrink-0 font-semibold">{line.qty}×</span>
              <span className="min-w-0">
                {line.name}
                {line.variantName && <span className="text-muted"> · {line.variantName}</span>}
              </span>
            </p>
            {line.addOns.length > 0 && (
              <p className="pl-9 text-sm text-muted">+ {line.addOns.map((a) => a.name).join(', ')}</p>
            )}
            {line.note && <p className="pl-9 text-sm text-warn italic">“{line.note}”</p>}
          </li>
        ))}
      </ul>
      {order.note && (
        <p className="mx-4 mb-3 flex gap-2 rounded-control bg-warn-soft px-3 py-2 text-sm text-warn">
          <Icons.Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {order.note}
        </p>
      )}
      <div className="flex items-baseline justify-between px-4 pb-3 text-sm">
        <span className="text-muted">{t('qr.orders.total')}</span>
        <span className="tabular font-display text-lg font-semibold">{formatMoney(order.totalMinor)}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-t border-white/[0.07] bg-white/[0.02] p-3">
        <Button size="lg" loading={busy} onClick={() => onAccept(order)} aria-label={t('qr.orders.acceptAria', { table: order.tableCode })}>
          <Icons.Check className="size-4" aria-hidden />
          {t('qr.orders.accept')}
        </Button>
        <Button size="lg" variant="secondary" disabled={busy} onClick={() => onEdit(order)} aria-label={t('qr.orders.editAria', { table: order.tableCode })}>
          <Icons.Pencil className="size-4" aria-hidden />
          <span className="max-sm:sr-only">{t('qr.orders.edit')}</span>
        </Button>
        <Button size="lg" variant="ghost" className="text-bad" disabled={busy} onClick={() => onReject(order)} aria-label={t('qr.orders.rejectAria', { table: order.tableCode })}>
          <Icons.X className="size-4" aria-hidden />
          <span className="max-sm:sr-only">{t('qr.orders.reject')}</span>
        </Button>
      </div>
    </article>
  );
}
