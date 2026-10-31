import { useAuth } from '../../auth/AuthContext';
import { computeAccess } from '../../shell/access';

/**
 * Who may show the bill / payment QR at a table. Mirrors apps/api/src/iam/system-roles.catalog.ts
 * (restaurant.bill.show, checkout.paymentqr.show, checkout.payment.process) so no button is offered that the API
 * would answer with 403. The API stays the boundary.
 */
const BILL_SHOW_ROLES = new Set(['owner', 'location-manager', 'checkout-associate', 'service-team']); // restaurant.bill.show
const PAYMENT_QR_ROLES = new Set(['owner', 'location-manager', 'checkout-associate', 'service-team']); // checkout.paymentqr.show
const RECORD_PAYMENT_ROLES = new Set(['owner', 'location-manager', 'checkout-associate']); // checkout.payment.process

export interface BillShowCaps {
  canShowBill: boolean;
  canShowPaymentQr: boolean;
  /** May record the payment (mark collected) through the normal checkout flow. */
  canRecordPayment: boolean;
  /** May set the restaurant's UPI ID (Configuration Center). */
  canConfigureUpi: boolean;
}

export const NO_BILL_SHOW_CAPS: BillShowCaps = { canShowBill: false, canShowPaymentQr: false, canRecordPayment: false, canConfigureUpi: false };

export function billShowCaps(user: { realm: 'PLATFORM' | 'BUSINESS'; roles: { key: string }[] } | null): BillShowCaps {
  if (!user || user.realm === 'PLATFORM') return NO_BILL_SHOW_CAPS;
  const keys = user.roles.map((r) => r.key);
  const any = (set: Set<string>) => keys.some((k) => set.has(k));
  return {
    canShowBill: any(BILL_SHOW_ROLES),
    // The QR screen finds the invoice through the bill view, so it needs that permission too.
    canShowPaymentQr: any(PAYMENT_QR_ROLES) && any(BILL_SHOW_ROLES),
    canRecordPayment: any(RECORD_PAYMENT_ROLES),
    canConfigureUpi: computeAccess(user).isTenantAdmin,
  };
}

export function useBillShowCaps(): BillShowCaps {
  const { user } = useAuth();
  return billShowCaps(user);
}
