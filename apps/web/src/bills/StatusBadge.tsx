import { useTranslation } from 'react-i18next';
import { StatusPill } from '../ui/StatusPill';
import type { InvoiceStatus } from './api';

const TONE = { PAID: 'ok', FINALISED: 'warn', VOIDED: 'neutral', DRAFT: 'info' } as const;

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  const { t } = useTranslation();
  return <StatusPill tone={TONE[status]}>{t(`bills.status.${status}`)}</StatusPill>;
}
