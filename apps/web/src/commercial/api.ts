import { api } from '../auth/api';

export type OfferingType = 'SETUP_FEE' | 'RECURRING' | 'ONE_TIME' | 'TRIAL';
export type CommercialStatus = 'PROSPECT' | 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CHURNED';
export type ActivationStatus =
  | 'REQUESTED'
  | 'QUOTED'
  | 'APPROVED'
  | 'PENDING_SETUP'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'REMOVED';

export interface Offering {
  id: string;
  key: string;
  name: string;
  description: string | null;
  type: OfferingType;
  moduleKeys: string[];
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface PriceBookEntry {
  id: string;
  priceBookId: string;
  offeringId: string;
  amountMinorUnits: number;
  billingPeriodDays: number | null;
  offering?: { id: string; key: string; name: string; type: OfferingType };
}

export interface PriceBook {
  id: string;
  name: string;
  description: string | null;
  currencyCode: string;
  isDefault: boolean;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
  entries: PriceBookEntry[];
}

export interface BundleItem {
  bundleId: string;
  offeringId: string;
  offering: { id: string; key: string; name: string; type: OfferingType };
}

export interface Bundle {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isActive: boolean;
  items: BundleItem[];
}

export interface ClientSummary {
  id: string;
  name: string;
  slug: string | null;
  commercialStatus: CommercialStatus;
  assignedTo: string | null;
  createdAt: string;
  businessType: { key: string; name: string };
  _count: { activationRequests: number; locations: number };
}

export interface ClientDetail extends ClientSummary {
  legalName: string | null;
  taxId: string | null;
  accountNotes: string | null;
  locations: { id: string; name: string; status: string }[];
  activationRequests: {
    id: string;
    status: ActivationStatus;
    moduleKeys: string[];
    createdAt: string;
    goLiveAt: string | null;
  }[];
}

export interface ActivationRequest {
  id: string;
  businessId: string;
  bundleId: string | null;
  moduleKeys: string[];
  status: ActivationStatus;
  requestedBy: string | null;
  assignedTo: string | null;
  notes: string | null;
  quotedAmount: number | null;
  currencyCode: string;
  quotedAt: string | null;
  approvedAt: string | null;
  setupAt: string | null;
  goLiveAt: string | null;
  removedAt: string | null;
  createdAt: string;
  bundle?: { id: string; key: string; name: string } | null;
  events?: ActivationRequestEvent[];
  checklist?: DeploymentChecklist | null;
}

export interface ActivationRequestEvent {
  id: string;
  fromStatus: ActivationStatus | null;
  toStatus: ActivationStatus;
  note: string | null;
  actorLabel: string | null;
  createdAt: string;
}

export interface DeploymentChecklist {
  id: string;
  completedAt: string | null;
  items: DeploymentChecklistItem[];
}

export interface DeploymentChecklistItem {
  id: string;
  key: string;
  label: string;
  completed: boolean;
  completedAt: string | null;
  sortOrder: number;
}

// ─── Offerings ───────────────────────────────────────────────────────────────

export const listOfferings = () => api<Offering[]>('/internal/commercial/offerings');

export const createOffering = (body: {
  key: string;
  name: string;
  description?: string;
  type: OfferingType;
  moduleKeys?: string[];
  sortOrder?: number;
}) => api<Offering>('/internal/commercial/offerings', { method: 'POST', body: JSON.stringify(body) });

export const updateOffering = (id: string, body: Partial<Offering>) =>
  api<Offering>(`/internal/commercial/offerings/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

export const deleteOffering = (id: string) =>
  api<void>(`/internal/commercial/offerings/${id}`, { method: 'DELETE' });

// ─── Price books ─────────────────────────────────────────────────────────────

export const listPriceBooks = () => api<PriceBook[]>('/internal/commercial/price-books');

export const createPriceBook = (body: {
  name: string;
  description?: string;
  currencyCode?: string;
  isDefault?: boolean;
  validFrom?: string;
  validTo?: string;
}) => api<PriceBook>('/internal/commercial/price-books', { method: 'POST', body: JSON.stringify(body) });

export const addPriceBookEntry = (
  priceBookId: string,
  body: { offeringId: string; amountMinorUnits: number; billingPeriodDays?: number },
) =>
  api<PriceBookEntry>(`/internal/commercial/price-books/${priceBookId}/entries`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const deletePriceBookEntry = (priceBookId: string, entryId: string) =>
  api<void>(`/internal/commercial/price-books/${priceBookId}/entries/${entryId}`, { method: 'DELETE' });

// ─── Bundles ─────────────────────────────────────────────────────────────────

export const listBundles = () => api<Bundle[]>('/internal/commercial/bundles');

export const createBundle = (body: { key: string; name: string; description?: string }) =>
  api<Bundle>('/internal/commercial/bundles', { method: 'POST', body: JSON.stringify(body) });

export const addBundleItem = (bundleId: string, offeringId: string) =>
  api<Bundle>(`/internal/commercial/bundles/${bundleId}/items/${offeringId}`, { method: 'POST' });

export const removeBundleItem = (bundleId: string, offeringId: string) =>
  api<Bundle>(`/internal/commercial/bundles/${bundleId}/items/${offeringId}`, { method: 'DELETE' });

// ─── Clients ──────────────────────────────────────────────────────────────────

export const listClients = (params?: { commercialStatus?: CommercialStatus; skip?: number; take?: number }) => {
  const qs = new URLSearchParams();
  if (params?.commercialStatus) qs.set('commercialStatus', params.commercialStatus);
  if (params?.skip !== undefined) qs.set('skip', String(params.skip));
  if (params?.take !== undefined) qs.set('take', String(params.take));
  const query = qs.toString();
  return api<ClientSummary[]>(`/internal/commercial/clients${query ? `?${query}` : ''}`);
};

export const getClient = (businessId: string) =>
  api<ClientDetail>(`/internal/commercial/clients/${businessId}`);

export const updateClient = (
  businessId: string,
  body: { commercialStatus?: CommercialStatus; accountNotes?: string; assignedTo?: string | null },
) =>
  api<Partial<ClientDetail>>(`/internal/commercial/clients/${businessId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const getClientUsage = (businessId: string) =>
  api<{ businessId: string; moduleActivations: { moduleKey: string; status: string }[]; locationCount: number; userCount: number; sessionCount: number }>(
    `/internal/commercial/clients/${businessId}/usage`,
  );

// ─── Activation requests ─────────────────────────────────────────────────────

export const listActivationRequests = (businessId: string, params?: { status?: ActivationStatus }) => {
  const qs = params?.status ? `?status=${params.status}` : '';
  return api<ActivationRequest[]>(
    `/internal/commercial/clients/${businessId}/activation-requests${qs}`,
  );
};

export const createActivationRequest = (
  businessId: string,
  body: { bundleId?: string; moduleKeys?: string[]; requestedBy?: string; notes?: string },
) =>
  api<ActivationRequest>(
    `/internal/commercial/clients/${businessId}/activation-requests`,
    { method: 'POST', body: JSON.stringify(body) },
  );

export const getActivationRequest = (businessId: string, requestId: string) =>
  api<ActivationRequest>(
    `/internal/commercial/clients/${businessId}/activation-requests/${requestId}`,
  );

export const transitionActivationRequest = (
  businessId: string,
  requestId: string,
  body: { toStatus: ActivationStatus; note?: string; quotedAmount?: number; currencyCode?: string },
) =>
  api<ActivationRequest>(
    `/internal/commercial/clients/${businessId}/activation-requests/${requestId}/transition`,
    { method: 'POST', body: JSON.stringify(body) },
  );

export const createChecklist = (
  businessId: string,
  requestId: string,
  body: { items: { key: string; label: string; sortOrder?: number }[] },
) =>
  api<DeploymentChecklist>(
    `/internal/commercial/clients/${businessId}/activation-requests/${requestId}/checklist`,
    { method: 'POST', body: JSON.stringify(body) },
  );

export const updateChecklistItem = (
  businessId: string,
  requestId: string,
  itemId: string,
  body: { completed: boolean },
) =>
  api<DeploymentChecklistItem>(
    `/internal/commercial/clients/${businessId}/activation-requests/${requestId}/checklist/items/${itemId}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  );
