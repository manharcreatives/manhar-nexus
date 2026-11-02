import { T } from './strings';
import type { BillState, GuestOrderStatus, StateOrder, TaxLine } from './types';

/** The five customer-facing stages of an order. */
export const STAGES = ['received', 'confirmed', 'preparing', 'ready', 'served'] as const;
export type Stage = (typeof STAGES)[number];
export type StageOrEnd = Stage | 'cancelled';

/**
 * Maps the API's guest status vocabulary (guest-status.ts) to the five stages. Unknown values fall back to the
 * earliest stage, the safest thing to tell a guest.
 *   AWAITING_CONFIRMATION -> received   (the waiter has not confirmed yet; nothing reached the kitchen)
 *   CONFIRMED             -> confirmed  (received by the kitchen queue)
 *   PREPARING | READY | SERVED as named; REJECTED | CANCELLED end the order.
 */
export function stageOf(status: string | undefined | null): StageOrEnd {
  switch ((status ?? '').toUpperCase()) {
    case 'REJECTED':
    case 'CANCELLED':
      return 'cancelled';
    case 'CONFIRMED':
      return 'confirmed';
    case 'PREPARING':
      return 'preparing';
    case 'READY':
      return 'ready';
    case 'SERVED':
      return 'served';
    default:
      return 'received';
  }
}

export const isAwaiting = (status: string | undefined | null) => (status ?? '').toUpperCase() === 'AWAITING_CONFIRMATION';
export const isRejected = (status: string | undefined | null) => (status ?? '').toUpperCase() === 'REJECTED';

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

export const isActive = (o: Pick<StateOrder, 'status'>) => {
  const s = stageOf(o.status);
  return s !== 'served' && s !== 'cancelled';
};

export function taxLabel(t: Partial<TaxLine>): string {
  if (t.name) return t.name;
  if (t.label) return t.ratePercent != null ? `${t.label} ${t.ratePercent}%` : t.label;
  return t.ratePercent != null ? `GST ${t.ratePercent}%` : 'Tax';
}

export const isBillPaid = (b: BillState | null | undefined): boolean => !!b && b.status === 'PAID';
/** The cashier has finalised the invoice: only then can a UPI payment be started. */
export const isBillFinal = (b: BillState | null | undefined): boolean => !!b && b.status === 'FINAL' && b.dueMinor > 0;

/**
 * Did the waiter change this order? True when the API says the kitchen-visible order was edited, or when the total
 * differs from what this device submitted (the API does not flag edits made before confirmation).
 */
export function wasAdjusted(order: Pick<StateOrder, 'id' | 'edited' | 'totalMinor' | 'status'>, placedTotals: Record<string, number>): boolean {
  if (isRejected(order.status)) return false;
  if (order.edited) return true;
  const placed = placedTotals[order.id];
  return typeof placed === 'number' && placed !== order.totalMinor;
}

export type { GuestOrderStatus };

/** Short, guest-facing label of an order status (dock, timeline). */
export function statusLabel(status: string | undefined | null): string {
  if (isAwaiting(status)) return T.awaiting;
  if (isRejected(status)) return T.rejectedShort;
  const g = stageOf(status);
  return g === 'cancelled' ? T.cancelledShort : T.stage[g];
}
