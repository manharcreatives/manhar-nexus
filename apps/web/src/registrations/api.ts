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
  /** Set when the amount came from the plan catalog; null for a typed amount. */
  planKey?: string | null;
  billingCycle?: string | null;
  breakdown?: { label: string; amountPaise: number }[] | null;
  /** Why staff typed an amount instead of using the quote. */
  overrideReason?: string | null;
  source?: string;
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
  /** True when the server created the account itself right after the payment (no staff click). */
  autoProvisioned?: boolean;
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
  patch: { status?: RegistrationStatus; internalNotes?: string | null; businessId?: string | null; contactName?: string; email?: string; phone?: string },
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

/** What staff send: a plan (the server prices it) or a typed amount with a reason, never both. */
export type CreatePaymentLinkBody =
  | { planKey?: string; cycle?: string; launchPack?: boolean; replaceOpen?: boolean }
  | { amountRupees: number; overrideReason: string; replaceOpen?: boolean };

/** Creates a Cashfree payment link for the request. The server computes the price from its own plan catalog. */
export function createPaymentLink(registrationId: string, body: CreatePaymentLinkBody): Promise<PaymentLink> {
  return api<PaymentLink>(`/internal/registrations/${registrationId}/payment-links`, { method: 'POST', body: JSON.stringify(body) });
}

export type RefreshOutcome = 'updated' | 'ignored' | 'duplicate' | 'amount-mismatch';

/** Asks Cashfree directly how a link is doing (for when the webhook is late or never arrived). */
export function refreshPaymentLink(registrationId: string, paymentId: string): Promise<{ outcome: RefreshOutcome; payment: PaymentLink }> {
  return api(`/internal/registrations/${registrationId}/payment-links/${paymentId}/refresh`, { method: 'POST', body: JSON.stringify({}) });
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

export type ProvisionStepState = 'pending' | 'running' | 'done' | 'failed';
export interface ProvisionResult {
  status: 'RUNNING' | 'FAILED' | 'DONE';
  steps: { id: string; state: ProvisionStepState }[];
  failedStep: string | null;
  error: string | null;
  businessId: string | null;
  ownerEmail: string;
  /** Only in the response of the run that issued the temporary password; never again. */
  credentials?: { email: string; password: string };
}

export interface ProvisionBody {
  name?: string;
  locationName?: string;
  ownerName?: string;
  ownerEmail?: string;
  commercialStatus?: 'PROSPECT' | 'TRIAL' | 'ACTIVE';
  extraModules?: ('reports' | 'costs')[];
  allowUnpaid?: boolean;
  reissuePassword?: boolean;
}

/** Creates (or resumes) the restaurant account for a request as one server-side job. */
export function provisionRegistration(registrationId: string, body: ProvisionBody): Promise<ProvisionResult> {
  return api<ProvisionResult>(`/internal/registrations/${registrationId}/provision`, { method: 'POST', body: JSON.stringify(body) });
}

/** A one-time "set your password" link for the owner of an auto-created account. Staff only; it replaces any earlier link. */
export interface ClaimLink {
  token: string;
  expiresAt: string;
}

export function issueClaimLink(registrationId: string): Promise<ClaimLink> {
  return api<ClaimLink>(`/internal/registrations/${registrationId}/claim-link`, { method: 'POST', body: JSON.stringify({}) });
}

/** The page the owner opens to choose a password. The token travels in the URL fragment, never in the query string. */
export function claimUrl(token: string, origin: string = window.location.origin): string {
  return `${origin}/set-password#t=${token}`;
}

/** What the owner is sent once the account exists. */
export function claimMessage(r: Pick<RegistrationRequest, 'contactName' | 'restaurantName'>, url: string): string {
  return `Hello ${r.contactName}, your Manhar Nexus account for ${r.restaurantName} is ready. Set your password here: ${url} (valid 72 hours)`;
}

/** Things that need a person: a failed account job, or money received but no account yet. */
export interface Attention {
  failedProvisioning: { registrationId: string; restaurantName: string; lastError: string | null; currentStep: string | null }[];
  paidNotConverted: { registrationId: string; restaurantName: string }[];
  /** Money received on a request marked spam or rejected: a person must decide (reopen it, or refund). */
  paidClosed?: { registrationId: string; restaurantName: string }[];
  /** A payment whose amount did not match the link: a person checks Cashfree, then accepts it or refunds. */
  mismatch?: { registrationId: string; restaurantName: string }[];
}

/** The API's list: one item per case, with a reason. */
interface AttentionApi {
  total: number;
  items: { registrationId: string; referenceCode: string; restaurantName: string; reason: 'PROVISIONING_FAILED' | 'PAID_NOT_CREATED' | 'AMOUNT_MISMATCH' | 'PAID_ON_CLOSED_REQUEST'; detail: string | null }[];
}

/**
 * Maps the API list to the groups the strip shows. A mismatch is its own group: it offers "Accept as paid" (with a
 * reason) and never a Create button.
 */
export async function getAttention(): Promise<Attention> {
  const res = await api<AttentionApi>('/internal/provisioning/attention');
  return {
    failedProvisioning: res.items
      .filter((i) => i.reason === 'PROVISIONING_FAILED')
      .map((i) => ({ registrationId: i.registrationId, restaurantName: i.restaurantName, lastError: i.detail, currentStep: null })),
    paidNotConverted: res.items.filter((i) => i.reason === 'PAID_NOT_CREATED').map((i) => ({ registrationId: i.registrationId, restaurantName: i.restaurantName })),
    paidClosed: res.items.filter((i) => i.reason === 'PAID_ON_CLOSED_REQUEST').map((i) => ({ registrationId: i.registrationId, restaurantName: i.restaurantName })),
    mismatch: res.items.filter((i) => i.reason === 'AMOUNT_MISMATCH').map((i) => ({ registrationId: i.registrationId, restaurantName: i.restaurantName })),
  };
}

export type ManualPaymentMethod = 'UPI' | 'BANK' | 'CASH' | 'OTHER';
export const MANUAL_METHODS: readonly ManualPaymentMethod[] = ['UPI', 'BANK', 'CASH', 'OTHER'];

export interface ManualPaymentBody {
  planKey: string;
  cycle: string;
  launchPack?: boolean;
  method: ManualPaymentMethod;
  reference: string;
  paidOn?: string;
  amountRupees?: number;
  overrideReason?: string;
}

/** Records money that arrived outside Cashfree (UPI, bank transfer, cash). The server prices it and starts the account. */
export function recordManualPayment(registrationId: string, body: ManualPaymentBody): Promise<PaymentLink> {
  return api<PaymentLink>(`/internal/registrations/${registrationId}/manual-payment`, { method: 'POST', body: JSON.stringify(body) });
}

/** Accepts a payment whose amount did not match the link, with a recorded reason (audited on the server). */
export function acceptMismatchedPayment(registrationId: string, paymentId: string, reason: string): Promise<PaymentLink> {
  return api<PaymentLink>(`/internal/registrations/${registrationId}/payments/${paymentId}/accept`, { method: 'POST', body: JSON.stringify({ reason }) });
}

const PLAN_NAMES: Record<string, string> = { counter: 'Counter', floor: 'Floor', pass: 'Pass', 'many-doors': 'Many Doors' };

/** Human plan name for a stored key; null for "not sure" or an unknown key (shown as "Plan not chosen"). */
export function planName(planKey: string): string | null {
  return PLAN_NAMES[planKey] ?? null;
}

/** The offer-code tag the landing form appends to the message, e.g. "[Code: FOUNDING26]". */
export function splitOfferCode(message: string | null): { text: string | null; code: string | null } {
  if (!message) return { text: null, code: null };
  const m = /\s*\[Code:\s*([A-Za-z0-9_-]+)\]\s*$/.exec(message);
  if (!m) return { text: message, code: null };
  const text = message.slice(0, m.index).trim();
  return { text: text || null, code: m[1] ?? null };
}

/** Other requests that share this one's email or phone (a likely duplicate), from the loaded list. */
export function duplicateCount(r: Pick<RegistrationRequest, 'id' | 'email' | 'phone'>, all: readonly Pick<RegistrationRequest, 'id' | 'email' | 'phone'>[]): number {
  const email = r.email.trim().toLowerCase();
  const phone = r.phone.replace(/\D/g, '').slice(-10);
  return all.filter((o) => o.id !== r.id && (o.email.trim().toLowerCase() === email || (phone.length === 10 && o.phone.replace(/\D/g, '').slice(-10) === phone))).length;
}
