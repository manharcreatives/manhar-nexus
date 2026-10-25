import { api } from '../auth/api';
import { formatMoney } from '../lib/money';

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

export interface DailyClosingReport {
  date: string;
  businessId: string;
  locationId?: string;
  paidInvoiceCount: number;
  grossSalesMinorUnits: number;
  totalTaxMinorUnits: number;
  totalRevenueMinorUnits: number;
  paymentBreakdown: PaymentMethodSummary[];
  totalRefundedMinorUnits: number;
  refundCount: number;
  netRevenueMinorUnits: number;
  voidedInvoiceCount: number;
  taxBreakdown: TaxBreakdownSummary[];
  servedOrderCount: number;
}

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

export interface ItemReport {
  from: string;
  to: string;
  businessId: string;
  locationId?: string;
  items: { itemName: string; quantity: number; revenueMinorUnits: number }[];
}

export interface DailySeriesPoint {
  date: string;
  paidInvoiceCount: number;
  grossSalesMinorUnits: number;
  totalRevenueMinorUnits: number;
  totalRefundedMinorUnits: number;
  netRevenueMinorUnits: number;
}

export interface DailySeriesReport {
  from: string;
  to: string;
  businessId: string;
  locationId?: string;
  /** Day boundaries used by the API; all report endpoints share them. */
  timezone: string;
  days: DailySeriesPoint[];
}

/** Server-side cap on a daily-series window. */
export const DAILY_SERIES_MAX_DAYS = 92;

export const reportsApi = {
  dailySeries: (from: string, to: string, locationId?: string) => {
    const qs = new URLSearchParams({ from, to });
    if (locationId) qs.set('locationId', locationId);
    return api<DailySeriesReport>(`/admin/reports/daily-series?${qs.toString()}`);
  },
  daily: (date: string, locationId?: string) => {
    const qs = new URLSearchParams({ date });
    if (locationId) qs.set('locationId', locationId);
    return api<DailyClosingReport>(`/admin/reports/daily?${qs.toString()}`);
  },
  sales: (from: string, to: string, locationId?: string) => {
    const qs = new URLSearchParams({ from, to });
    if (locationId) qs.set('locationId', locationId);
    return api<SalesSummaryReport>(`/admin/reports/sales?${qs.toString()}`);
  },
  items: (from: string, to: string, locationId?: string, limit?: number) => {
    const qs = new URLSearchParams({ from, to });
    if (locationId) qs.set('locationId', locationId);
    if (limit) qs.set('limit', String(limit));
    return api<ItemReport>(`/admin/reports/items?${qs.toString()}`);
  },
};

/** Format minor units (paise) to a readable currency string. */
export function formatMinorUnits(minorUnits: number, currencyCode = 'INR'): string {
  return formatMoney(minorUnits, currencyCode);
}
