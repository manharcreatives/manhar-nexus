import { useTranslation } from 'react-i18next';
import { StatusPill } from '../ui/StatusPill';
import type { DiningTable, ServiceRequestStatus } from './api';

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
