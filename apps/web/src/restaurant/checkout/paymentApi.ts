import { api } from '../../auth/api';

/**
 * Payment calls the cashier flow needs beyond restaurant/api.ts (kept here so that file stays untouched).
 * Contract: apps/api/src/checkout/payment/payment.controller.ts.
 */
export type PaymentStatus = 'PENDING' | 'CAPTURED' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  method: string;
  status: PaymentStatus | string;
  amountMinorUnits: number;
  referenceCode?: string | null;
  cashReceivedMinorUnits?: number | null;
  changeMinorUnits?: number | null;
  createdAt?: string;
  version?: number;
}

export const paymentApi = {
  /** GET /admin/checkout/invoices/:id/payments (checkout.payment.view). Newest first. */
  list: (invoiceId: string) => api<PaymentRecord[]>(`/admin/checkout/invoices/${encodeURIComponent(invoiceId)}/payments`),
  /** POST /admin/checkout/payments/:id/cancel. Only a PENDING payment can be cancelled; a captured one answers 409. */
  cancel: (paymentId: string, reason = 'Payment method changed', expectedVersion?: number) =>
    api<PaymentRecord>(`/admin/checkout/payments/${encodeURIComponent(paymentId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason, ...(expectedVersion !== undefined ? { expectedVersion } : {}) }),
    }),
};
