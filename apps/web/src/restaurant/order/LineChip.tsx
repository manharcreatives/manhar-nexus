import { useTranslation } from 'react-i18next';
import { StatusPill } from '../../ui/StatusPill';
import type { LineChip as LineChipKind } from './lineState';

const TONE = {
  new: 'accent',
  saved: 'neutral',
  sent: 'info',
  preparing: 'warn',
  ready: 'ok',
  served: 'ok',
  removing: 'bad',
} as const;

/** Per-line state: New / Saved / Sent to kitchen / Preparing ... Always text plus a dot, never colour alone. */
export function LineChip({ kind }: { kind: LineChipKind }) {
  const { t } = useTranslation();
  return <StatusPill tone={TONE[kind]}>{t(`restaurant.orderZones.chip.${kind}`)}</StatusPill>;
}
