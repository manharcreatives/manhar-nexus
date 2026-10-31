import { api } from '../../auth/api';

/**
 * Waiter-facing, customer-safe read models. Contract: apps/api/src/checkout/bill-view/bill-view.{controller,service}.ts
 *  - GET /admin/checkout/sessions/:sessionId/bill-view   (restaurant.bill.show)
 *  - GET /admin/checkout/invoices/:invoiceId/payment-qr  (checkout.paymentqr.show)
 * Pure reads: nothing here can change a financial record.
 */
export type BillViewState = 'NO_BILL' | 'NOT_FINALISED' | 'READY';

export interface BillTaxComponent {
  label: string;
  ratePercent: number;
  taxMinorUnits: number;
}

export interface BillTaxLine {
  label: string;
  ratePercent: number;
  taxableMinorUnits: number;
  taxMinorUnits: number;
  /** CGST + SGST halves for plain GST categories; empty otherwise. */
  components: BillTaxComponent[];
}

export interface BillViewLine {
  id: string;
  name: string;
  variant: string | null;
  modifiers: string | null;
  quantity: number;
  unitPriceMinorUnits: number;
  /** Pre-tax line amount; tax is itemised separately. */
  amountMinorUnits: number;
}

export interface BillView {
  state: BillViewState;
  business: { name: string; legalName: string | null; address: string | null; gstin: string | null; logoUrl: string | null; accentColor: string | null };
  location: { name: string; code: string | null } | null;
  tableCode: string | null;
  bill: null | {
    invoiceId: string;
    status: string;
    reference: string | null;
    currencyCode: string;
    issuedAt: string | null;
    lines: BillViewLine[];
    subtotalMinorUnits: number;
    taxLines: BillTaxLine[];
    totalTaxMinorUnits: number;
    roundingMinorUnits: number;
    grandTotalMinorUnits: number;
    paid: boolean;
    paidAt: string | null;
    paymentPending: boolean;
  };
}

export type PaymentQrReason = 'NOT_FINALISED' | 'PAID' | 'VOID' | 'UPI_NOT_CONFIGURED' | 'UPI_INVALID';

export interface PaymentQrView {
  invoiceId: string;
  status: string;
  reference: string | null;
  tableCode: string | null;
  amountMinorUnits: number;
  currencyCode: string;
  ready: boolean;
  reason: PaymentQrReason | null;
  paid: boolean;
  paymentPending: boolean;
  upi: null | { uri: string; vpa: string; payeeName: string; note: string; transactionRef: string };
}

export const billShowApi = {
  forSession: (sessionId: string) => api<BillView>(`/admin/checkout/sessions/${encodeURIComponent(sessionId)}/bill-view`),
  paymentQr: (invoiceId: string) => api<PaymentQrView>(`/admin/checkout/invoices/${encodeURIComponent(invoiceId)}/payment-qr`),
};

/** Settings API (Configuration Center schema, namespace `checkout`): apps/api/src/checkout/checkout.settings.ts. */
export const CHECKOUT_NAMESPACE = 'checkout';
export const UPI_VPA_KEY = 'upi_vpa';
/** Same pattern as the API (UPI_VPA_REGEX) so a typo is caught before the round trip. */
export const UPI_VPA_REGEX = /^[a-z0-9][a-z0-9._-]{1,63}@[a-z][a-z0-9]{1,31}$/i;
