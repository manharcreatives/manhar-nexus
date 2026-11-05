import { api } from '../auth/api';

export const REGISTRATION_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'REJECTED', 'SPAM'] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const PAYMENT_STATUSES = ['CREATED', 'PAID', 'EXPIRED', 'CANCELLED', 'AMOUNT_MISMATCH'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** A Cashfree payment link staff created for a request (the owner's subscription payment). */
export interface PaymentLink {
  id: string;
  registrationId: string;
  linkId: string;
  linkUrl: string;
  amountPaise: number;
  currency: string;
  purpose: string;
  status: PaymentStatus;
  paidAmountPaise: number | null;
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

/** Staff-facing view of a landing-page request (the API never returns the IP hash). */
export interface RegistrationRequest {
  id: string;
  referenceCode: string;
  status: RegistrationStatus;
  restaurantName: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  businessKind: string;
  outlets: number;
  planKey: string;
  billingCycle: string;
  message: string | null;
  assignedTo: string | null;
  internalNotes: string | null;
  businessId: string | null;
  /** Newest payment links first (the API sends the latest few). */
  payments: PaymentLink[];
  createdAt: string;
  updatedAt: string;
}

export interface RegistrationPage {
  items: RegistrationRequest[];
  total: number;
  skip: number;
  take: number;
}

export function listRegistrations(params: { status?: RegistrationStatus; take?: number } = {}): Promise<RegistrationPage> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  qs.set('take', String(params.take ?? 100));
  return api<RegistrationPage>(`/internal/registrations?${qs.toString()}`);
}

export function updateRegistration(
  id: string,
  patch: { status?: RegistrationStatus; internalNotes?: string | null; businessId?: string | null },
): Promise<RegistrationRequest> {
  return api<RegistrationRequest>(`/internal/registrations/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

/** Statuses a request may move to from `from` (mirrors the API's transition table). */
export const NEXT_STATUSES: Record<RegistrationStatus, readonly RegistrationStatus[]> = {
  NEW: ['CONTACTED', 'QUALIFIED', 'CONVERTED', 'REJECTED', 'SPAM'],
  CONTACTED: ['NEW', 'QUALIFIED', 'CONVERTED', 'REJECTED', 'SPAM'],
  QUALIFIED: ['NEW', 'CONTACTED', 'CONVERTED', 'REJECTED', 'SPAM'],
  CONVERTED: [],
  REJECTED: ['NEW', 'CONTACTED', 'QUALIFIED', 'SPAM'],
  SPAM: ['NEW', 'REJECTED'],
};

/** wa.me link for a stored +91XXXXXXXXXX number. */
export function whatsappUrl(phone: string, text?: string): string {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** Creates a Cashfree payment link for the request. Amount is in rupees (at most two decimals). */
export function createPaymentLink(registrationId: string, body: { amountRupees: number; purpose?: string }): Promise<PaymentLink> {
  return api<PaymentLink>(`/internal/registrations/${registrationId}/payment-links`, { method: 'POST', body: JSON.stringify(body) });
}

/** True when the request already has a PAID link: time to create the restaurant account. */
export const isPaid = (r: Pick<RegistrationRequest, 'payments'>): boolean => r.payments.some((p) => p.status === 'PAID');

/** A link the owner can still pay. */
export const isOpenLink = (p: PaymentLink, now = Date.now()): boolean =>
  p.status === 'CREATED' && (p.expiresAt === null || Date.parse(p.expiresAt) > now);

/** Rupees as text for an integer paise amount: 150050 -> "1,500.50"; whole rupees drop the decimals. */
export function formatRupees(paise: number): string {
  const rupees = paise / 100;
  return rupees.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2, maximumFractionDigits: 2 });
}

/** The message staff send the owner with the payment link. */
export function paymentMessage(r: Pick<RegistrationRequest, 'contactName' | 'restaurantName'>, link: Pick<PaymentLink, 'linkUrl' | 'amountPaise'>): string {
  return `Hello ${r.contactName}, this is Manhar Nexus. Here is your secure payment link for ${r.restaurantName}: ${link.linkUrl} (₹${formatRupees(link.amountPaise)}). Once it is paid we will set up your account.`;
}
