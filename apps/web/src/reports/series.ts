import type { TFunction } from 'i18next';
import type { BarDatum } from '../charts/BarTrend';
import type { DailySeriesPoint } from './api';
import { axisDayLabel, formatDayLong } from './dates';

/** Daily net revenue as bar data; weekday labels for a week, day numbers beyond. */
export function seriesToBars(days: DailySeriesPoint[], t: TFunction): BarDatum[] {
  const style = days.length <= 8 ? 'weekday' : 'day';
  return days.map((d) => ({
    key: d.date,
    label: axisDayLabel(d.date, style),
    fullLabel: formatDayLong(d.date),
    value: d.netRevenueMinorUnits,
    detail: t('reports.billsCount', { count: d.paidInvoiceCount }),
  }));
}

export interface Comparison {
  /** Signed difference in minor units (current - base). */
  delta: number;
  /** Signed percent change, or null when the base is zero (no meaningful ratio). */
  pct: number | null;
  direction: 'up' | 'down' | 'flat';
}

/** Compares two amounts without inventing a ratio from a zero base. */
export function compare(current: number, base: number): Comparison {
  const delta = current - base;
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const pct = base > 0 ? Math.round((delta / base) * 1000) / 10 : null;
  return { delta, pct, direction };
}
