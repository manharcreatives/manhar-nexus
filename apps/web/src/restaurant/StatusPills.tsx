import { useTranslation } from 'react-i18next';
import { StatusPill } from '../ui/StatusPill';
import type { DiningTable, ServiceRequestStatus } from './api';
import { cn } from '../lib/cn';

type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';

const TABLE_TONE: Record<DiningTable['status'], Tone> = {
  AVAILABLE: 'ok',
  OCCUPIED: 'warn',
  CLEANING: 'info',
};

const ORDER_TONE: Record<ServiceRequestStatus, Tone> = {
  DRAFT: 'neutral',
  SENT: 'info',
  ACCEPTED: 'accent',
  PREPARING: 'warn',
  READY: 'ok',
  SERVED: 'ok',
  CANCELLED: 'bad',
};

export function TableStatusPill({ status }: { status: DiningTable['status'] }) {
  const { t } = useTranslation();
  return <StatusPill tone={TABLE_TONE[status]}>{t(`restaurant.tableStatus.${status}`)}</StatusPill>;
}

export function OrderStatusPill({ status }: { status: ServiceRequestStatus }) {
  const { t } = useTranslation();
  return <StatusPill tone={ORDER_TONE[status] ?? 'neutral'}>{t(`restaurant.orderStatus.${status}`, status)}</StatusPill>;
}

const LABEL_TONE: Record<DiningTable['status'], string> = {
  AVAILABLE: 'text-ok',
  OCCUPIED: 'text-accent-strong',
  CLEANING: 'text-info',
};

/** Shape carries the status too: ring = free, filled = seated, half = being reset. */
function StatusGlyph({ status }: { status: DiningTable['status'] }) {
  return (
    <svg aria-hidden viewBox="0 0 10 10" className="size-2.5">
      {status === 'AVAILABLE' && <circle cx="5" cy="5" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" />}
      {status === 'OCCUPIED' && <circle cx="5" cy="5" r="4.2" fill="currentColor" />}
      {status === 'CLEANING' && (
        <>
          <circle cx="5" cy="5" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5 1.4a3.6 3.6 0 0 1 0 7.2z" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

/** Signature table-tile label: a typographic status (small caps + shape), not a pill. */
export function TableStatusLabel({ status, className }: { status: DiningTable['status']; className?: string }) {
  const { t } = useTranslation();
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5 text-[0.6875rem] leading-none font-semibold tracking-[0.08em] whitespace-nowrap uppercase', LABEL_TONE[status], className)}>
      <StatusGlyph status={status} />
      {t(`restaurant.tableStatus.${status}`)}
    </span>
  );
}
