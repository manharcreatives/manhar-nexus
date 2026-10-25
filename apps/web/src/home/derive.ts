/** Pure reducers from API payloads to the figures Home shows. Unit tested. */

export interface DayFigures {
  date: string;
  netMinor: number;
  revenueMinor: number;
  paidCount: number;
}

export interface RevenueToday {
  today: DayFigures;
  yesterday: DayFigures;
  /** Same weekday one week earlier. */
  lastWeek: DayFigures;
  /** Last 7 days ending today, oldest first; null when the role cannot load the series. */
  strip: DayFigures[] | null;
}

/** Average bill = total revenue / paid bills, same definition as the Sales Summary. Null with no bills. */
export function averageBill(d: DayFigures): number | null {
  return d.paidCount > 0 ? Math.round(d.revenueMinor / d.paidCount) : null;
}

export interface TableLoad {
  occupied: number;
  cleaning: number;
  total: number;
}

export function tableLoad(tables: { status: string; isActive: boolean }[]): TableLoad {
  const active = tables.filter((x) => x.isActive);
  return {
    occupied: active.filter((x) => x.status === 'OCCUPIED').length,
    cleaning: active.filter((x) => x.status === 'CLEANING').length,
    total: active.length,
  };
}

export interface KitchenLoad {
  /** Tickets sent, accepted or cooking: the kitchen still owes them. */
  waiting: number;
  /** Cooked and waiting for pickup. */
  ready: number;
  /** Minutes the oldest waiting ticket has been open, or null when nothing waits. */
  oldestMins: number | null;
}

const WAITING = new Set(['SENT', 'ACCEPTED', 'PREPARING']);

export function kitchenLoad(queue: { status: string; sentAt: string | null }[], now: number): KitchenLoad {
  let oldest: number | null = null;
  let waiting = 0;
  let ready = 0;
  for (const q of queue) {
    if (q.status === 'READY') ready += 1;
    if (!WAITING.has(q.status)) continue;
    waiting += 1;
    const sent = q.sentAt ? Date.parse(q.sentAt) : NaN;
    if (!Number.isNaN(sent) && (oldest === null || sent < oldest)) oldest = sent;
  }
  return { waiting, ready, oldestMins: oldest === null ? null : Math.max(0, Math.floor((now - oldest) / 60_000)) };
}

/** A ticket waiting longer than this reads as "running late". */
export const KITCHEN_LATE_MINS = 20;

export function pendingApprovals(expenses: { status: string; amountMinorUnits: number }[]): { count: number; totalMinor: number } {
  const pending = expenses.filter((e) => e.status === 'PENDING_APPROVAL');
  return { count: pending.length, totalMinor: pending.reduce((s, e) => s + e.amountMinorUnits, 0) };
}
