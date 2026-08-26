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
