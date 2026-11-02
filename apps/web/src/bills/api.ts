import { api } from '../auth/api';

export type InvoiceStatus = 'DRAFT' | 'FINALISED' | 'PAID' | 'VOIDED';
export type PaymentStatus = 'PENDING' | 'CAPTURED' | 'FAILED' | 'CANCELLED';
export type RefundStatus = 'PENDING' | 'PROCESSED' | 'FAILED';

export interface BillPaymentSummary {
  id: string;
  method: string;
  status: PaymentStatus;
  amountMinorUnits: number;
  referenceCode: string | null;
  capturedAt: string | null;
  refundedMinorUnits: number;
}

export interface BillListItem {
  id: string;
  invoiceNumber: string | null;
  status: InvoiceStatus;
  grandTotalMinorUnits: number;
  currencyCode: string;
  createdAt: string;
  finalisedAt: string | null;
  paidAt: string | null;
  voidedAt: string | null;
  locationId: string;
  sessionId: string | null;
  tableCode: string | null;
  payments: BillPaymentSummary[];
}

export interface BillTotals {
  billedMinorUnits: number;
  voidedCount: number;
  currencyCode: string;
}

export interface BillList {
  items: BillListItem[];
  total: number;
  totals: BillTotals;
}

export interface BillQuery {
  status?: InvoiceStatus;
  /** ISO instant or YYYY-MM-DD. */
  from?: string;
  /** ISO instant, or YYYY-MM-DD (inclusive of the whole day). */
  to?: string;
  skip?: number;
  take?: number;
  locationId?: string;
}

export interface InvoiceLine {
  id: string;
  itemNameSnapshot: string;
  variantNameSnapshot: string | null;
  modifiersSummary: string | null;
  quantity: number;
  lineTotalMinorUnits: number;
}

export interface InvoiceDetail {
  id: string;
  invoiceNumber: string | null;
  status: InvoiceStatus;
  currencyCode: string;
  subtotalMinorUnits: number;
  totalTaxMinorUnits: number;
  grandTotalMinorUnits: number;
  voidReason: string | null;
  version: number;
  paidAt: string | null;
  voidedAt: string | null;
  lines: InvoiceLine[];
}

export interface Refund {
  id: string;
  amountMinorUnits: number;
  status: RefundStatus;
  reason: string;
  notes: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface Payment {
  id: string;
  method: string;
  status: PaymentStatus;
  amountMinorUnits: number;
  currencyCode: string;
  referenceCode: string | null;
  capturedAt: string | null;
  createdAt: string;
  refunds: Refund[];
}

export const billsApi = {
  list: (q: BillQuery) => {
    const qs = new URLSearchParams();
    if (q.status) qs.set('status', q.status);
    if (q.from) qs.set('from', q.from);
    if (q.to) qs.set('to', q.to);
    if (q.locationId) qs.set('locationId', q.locationId);
    qs.set('skip', String(q.skip ?? 0));
    qs.set('take', String(q.take ?? 25));
    return api<BillList>(`/admin/checkout/invoices?${qs.toString()}`);
  },
  invoice: (id: string) => api<InvoiceDetail>(`/admin/checkout/invoices/${id}`),
  payments: (invoiceId: string) => api<Payment[]>(`/admin/checkout/invoices/${invoiceId}/payments`),
  /** `idempotencyKey` makes a retried refund replay the original instead of refunding twice. */
  refund: (paymentId: string, body: { amountMinorUnits: number; reason: string; idempotencyKey: string }) =>
    api<Refund>(`/admin/checkout/payments/${paymentId}/refunds`, { method: 'POST', body: JSON.stringify(body) }),
  voidInvoice: (id: string, body: { reason: string; expectedVersion?: number }) =>
    api<InvoiceDetail>(`/admin/checkout/invoices/${id}/void`, { method: 'POST', body: JSON.stringify(body) }),
};
