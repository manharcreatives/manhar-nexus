import { api } from '../auth/api';

export const REGISTRATION_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'REJECTED', 'SPAM'] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

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
