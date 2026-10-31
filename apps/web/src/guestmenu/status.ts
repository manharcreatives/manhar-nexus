import type { BillState, StateOrder, TaxLine } from './types';

/** The five customer-facing stages of an order. */
export const STAGES = ['received', 'confirmed', 'preparing', 'ready', 'served'] as const;
export type Stage = (typeof STAGES)[number];
export type StageOrEnd = Stage | 'cancelled';

/**
 * Maps server order statuses to the five stages. Tolerant on purpose: the staff flows use several
 * names for the same moment (AWAITING_CONFIRMATION/PLACED, ACKNOWLEDGED/PREPARING, ...).
 */
export function stageOf(status: string | undefined | null): StageOrEnd {
  const s = (status ?? '').toUpperCase().replace(/[\s-]+/g, '_');
  switch (s) {
    case 'REJECTED':
    case 'CANCELLED':
    case 'CANCELED':
    case 'VOID':
    case 'VOIDED':
      return 'cancelled';
    case 'CONFIRMED':
    case 'ACCEPTED':
    case 'OPEN':
    case 'SENT':
    case 'SENT_TO_KITCHEN':
      return 'confirmed';
    case 'ACKNOWLEDGED':
    case 'PREPARING':
    case 'IN_PROGRESS':
    case 'COOKING':
    case 'IN_PREPARATION':
      return 'preparing';
    case 'READY':
    case 'READY_TO_SERVE':
      return 'ready';
    case 'SERVED':
    case 'DELIVERED':
    case 'COMPLETED':
    case 'CLOSED':
      return 'served';
    default:
      // AWAITING_CONFIRMATION, PLACED, RECEIVED, PENDING and anything unknown: the safest, earliest stage.
      return 'received';
  }
}

export type StepState = 'done' | 'current' | 'todo';

export function stepStates(stage: StageOrEnd): StepState[] {
  if (stage === 'cancelled') return STAGES.map(() => 'todo');
  const idx = STAGES.indexOf(stage);
  return STAGES.map((_, i) => (stage === 'served' ? 'done' : i < idx ? 'done' : i === idx ? 'current' : 'todo'));
}

/** 0..1 fill of the connecting line. */
export function progressOf(stage: StageOrEnd): number {
  if (stage === 'cancelled') return 0;
  return STAGES.indexOf(stage) / (STAGES.length - 1);
}

export const isActive = (o: StateOrder) => {
  const s = stageOf(o.status);
  return s !== 'served' && s !== 'cancelled';
};

export function taxLabel(t: TaxLine): string {
  if (t.name) return t.name;
  if (t.label) return t.label;
  const pct = t.ratePercent ?? (t.rateBp != null ? t.rateBp / 100 : undefined);
  return pct != null ? `GST ${pct}%` : 'Tax';
}

export function isBillPaid(b: BillState | null | undefined): boolean {
  if (!b) return false;
  if (b.status && /^(PAID|SETTLED|CLOSED)$/i.test(b.status)) return true;
  return b.totalMinor > 0 && b.dueMinor <= 0;
}
