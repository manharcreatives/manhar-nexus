import { z } from 'zod';

/** Validates a YYYY-MM-DD date string. */
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

export const dailyReportQuerySchema = z
  .object({
    date: dateStringSchema,
    locationId: z.string().uuid().optional(),
  })
  .strict();
export type DailyReportQuery = z.infer<typeof dailyReportQuerySchema>;

export const salesReportQuerySchema = z
  .object({
    from: dateStringSchema,
    to: dateStringSchema,
    locationId: z.string().uuid().optional(),
  })
  .strict()
  .refine((v) => v.from <= v.to, { message: 'from must be <= to', path: ['from'] });
export type SalesReportQuery = z.infer<typeof salesReportQuerySchema>;

export const itemReportQuerySchema = z
  .object({
    from: dateStringSchema,
    to: dateStringSchema,
    locationId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict()
  .refine((v) => v.from <= v.to, { message: 'from must be <= to', path: ['from'] });
export type ItemReportQuery = z.infer<typeof itemReportQuerySchema>;

/** Upper bound on a daily-series window so one request stays a bounded query. */
export const DAILY_SERIES_MAX_DAYS = 92;

const DAY_MS = 86_400_000;

/** Inclusive day count between two YYYY-MM-DD strings (UTC calendar days). */
export function daySpan(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}

/** True for a real calendar date (rejects 2026-02-31, which Date would roll over). */
function isRealDate(s: string): boolean {
  const ms = Date.parse(`${s}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === s;
}

export const dailySeriesQuerySchema = z
  .object({
    from: dateStringSchema,
    to: dateStringSchema,
    locationId: z.string().uuid().optional(),
  })
  .strict()
  .refine((v) => isRealDate(v.from) && isRealDate(v.to), {
    message: 'Invalid calendar date',
    path: ['from'],
  })
  .refine((v) => v.from <= v.to, { message: 'from must be <= to', path: ['from'] })
  .refine((v) => daySpan(v.from, v.to) <= DAILY_SERIES_MAX_DAYS, {
    message: `Range must be at most ${DAILY_SERIES_MAX_DAYS} days`,
    path: ['to'],
  });
export type DailySeriesQuery = z.infer<typeof dailySeriesQuerySchema>;

// ─── Response types ───────────────────────────────────────────────────────────

export interface PaymentMethodSummary {
  method: string;
  capturedCount: number;
  amountMinorUnits: number;
}

export interface TaxBreakdownSummary {
  name: string;
  rate: number;
  taxableAmountMinorUnits: number;
  taxAmountMinorUnits: number;
}

/** Daily Closing Report — financial summary for one calendar day (UTC). */
export interface DailyClosingReport {
  date: string;
  businessId: string;
  locationId?: string;

  // Revenue (PAID invoices)
  paidInvoiceCount: number;
  grossSalesMinorUnits: number;
  totalTaxMinorUnits: number;
  totalRevenueMinorUnits: number;

  // Payment method breakdown
  paymentBreakdown: PaymentMethodSummary[];

  // Refunds (PROCESSED, linked to invoices paid on this day)
  totalRefundedMinorUnits: number;
  refundCount: number;

  // Net revenue
  netRevenueMinorUnits: number;

  // Void/cancel activity for the day
  voidedInvoiceCount: number;

  // Tax breakdown (aggregated from paid invoice taxBreakdown JSON)
  taxBreakdown: TaxBreakdownSummary[];

  // Order volume
  servedOrderCount: number;
}

/** Sales Summary — aggregate over a date range. */
export interface SalesSummaryReport {
  from: string;
  to: string;
  businessId: string;
  locationId?: string;

  paidInvoiceCount: number;
  grossSalesMinorUnits: number;
  totalTaxMinorUnits: number;
  totalRevenueMinorUnits: number;
  totalRefundedMinorUnits: number;
  netRevenueMinorUnits: number;
  averageInvoiceMinorUnits: number;
  paymentBreakdown: PaymentMethodSummary[];
}

/** One calendar day (UTC) of sales, same semantics as the Sales Summary. */
export interface DailySeriesPoint {
  date: string;
  paidInvoiceCount: number;
  grossSalesMinorUnits: number;
  totalRevenueMinorUnits: number;
  /** PROCESSED refunds on invoices paid this day (attributed to the invoice's paid day). */
  totalRefundedMinorUnits: number;
  netRevenueMinorUnits: number;
}

/** Per-day revenue series; every day in [from, to] is present (zero-filled). */
export interface DailySeriesReport {
  from: string;
  to: string;
  businessId: string;
  locationId?: string;
  /** Day boundaries used for bucketing. Matches the other report endpoints. */
  timezone: 'UTC';
  days: DailySeriesPoint[];
}

/** Top selling items for a date range. */
export interface ItemReport {
  from: string;
  to: string;
  businessId: string;
  locationId?: string;
  items: {
    itemName: string;
    quantity: number;
    revenueMinorUnits: number;
  }[];
}
