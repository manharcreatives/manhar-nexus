import { api } from '../auth/api';
import { formatMoney } from '../lib/money';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DiningArea {
  id: string;
  name: string;
  locationId: string;
  description: string | null;
  isActive: boolean;
}

export interface DiningTable {
  id: string;
  diningAreaId: string;
  code: string;
  capacity: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'CLEANING';
  isActive: boolean;
  locationId: string;
}

export interface GuestSession {
  id: string;
  businessId: string;
  locationId: string;
  diningTableId: string;
  partySize: number;
  status: 'OPEN' | 'CLOSED' | 'VOID';
  openedAt: string;
  closedAt: string | null;
  notes: string | null;
  assignedStaffId: string | null;
  serviceRequests: SessionOrderSummary[];
}

export interface SessionOrderSummary {
  id: string;
  roundNumber: number;
  status: string;
  requestNumber: string | null;
}

export type ServiceRequestStatus =
  | 'DRAFT'
  | 'SENT'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'CANCELLED';

export type ServiceLineStatus = 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';

export interface ServiceRequestLine {
  id: string;
  catalogItemId: string;
  itemNameSnapshot: string;
  variantNameSnapshot: string | null;
  quantity: number;
  unitPriceMinorUnits: number;
  taxRateSnapshot: number;
  modifiers: { id: string; optionNameSnapshot: string; priceAdjMinorUnits: number }[];
  notes: string | null;
  status: ServiceLineStatus;
  /** Order edit (A2): set when an edit added/changed this line while the kitchen could already see it. */
  kitchenNote?: string | null;
  editedAt?: string | null;
  editKind?: 'ADDED' | 'CHANGED' | null;
}

export interface ServiceRequest {
  id: string;
  sessionId: string;
  roundNumber: number;
  requestNumber: string | null;
  status: ServiceRequestStatus;
  sentAt: string | null;
  notes: string | null;
  lines: ServiceRequestLine[];
  /** Optimistic-concurrency version (ADR-017); order edits must echo it back. */
  version?: number;
  /** Edits made while the kitchen could see the order (drives the "edited" flag). */
  editCount?: number;
  lastEditedAt?: string | null;
}

export interface CatalogCategory {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
}

export interface CatalogItem {
  id: string;
  name: string;
  sku: string;
  basePriceMinorUnits: number;
  categoryId: string | null;
  taxCategoryId: string | null;
  isActive: boolean;
  type: string;
  /** Present on GET /admin/catalog/items. */
  variants?: CatalogVariant[];
  /** Junction rows; group definitions come from GET /admin/catalog/modifier-groups. */
  modifierGroups?: { modifierGroupId: string; sortOrder: number }[];
}

export interface CatalogVariant {
  id: string;
  name: string;
  /** Delta from the item base price, minor units (may be negative). */
  priceAdjMinorUnits: number;
  isAvailable: boolean;
  sortOrder: number;
}

export interface ModifierOption {
  id: string;
  name: string;
  priceAdjMinorUnits: number;
  isDefault: boolean;
  isAvailable: boolean;
  sortOrder: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  selectionType: 'SINGLE' | 'MULTIPLE';
  isRequired: boolean;
  minSelections: number;
  maxSelections: number | null;
  sortOrder: number;
  isActive: boolean;
  options: ModifierOption[];
}

export interface OrderLineInput {
  catalogItemId: string;
  variantId?: string;
  quantity: number;
  modifiers?: { modifierOptionId: string }[];
  notes?: string;
}

export interface InvoiceLine {
  id: string;
  itemNameSnapshot: string;
  variantNameSnapshot: string | null;
  quantity: number;
  unitPriceMinorUnits: number;
  taxRateSnapshot: string;
  lineSubtotalMinorUnits: number;
  lineTaxMinorUnits: number;
  lineTotalMinorUnits: number;
}

export interface Invoice {
  id: string;
  sessionId: string;
  status: 'DRAFT' | 'FINALISED' | 'PAID' | 'VOID';
  subtotalMinorUnits: number;
  totalTaxMinorUnits: number;
  grandTotalMinorUnits: number;
  lines: InvoiceLine[];
}

export interface BillPreview {
  sessionId: string;
  currencyCode: string;
  itemCount: number;
  subtotalMinorUnits: number;
  totalTaxMinorUnits: number;
  grandTotalMinorUnits: number;
  taxBreakdown: { name: string; rate: number; taxableAmountMinorUnits: number; taxAmountMinorUnits: number }[];
  invoice:
    | {
        id: string;
        invoiceNumber: string | null;
        status: Invoice['status'];
        itemCount: number;
        subtotalMinorUnits: number;
        totalTaxMinorUnits: number;
        grandTotalMinorUnits: number;
      }
    | null;
  uninvoiced: {
    itemCount: number;
    subtotalMinorUnits: number;
    totalTaxMinorUnits: number;
    grandTotalMinorUnits: number;
  };
}

export interface Payment {
  id: string;
  invoiceId: string;
  method: string;
  amountMinorUnits: number;
  status: 'PENDING' | 'CAPTURED' | 'CANCELLED' | 'REFUNDED';
}

// ── Helpers ────────────────────────────────────────────────────────────────────

export function formatMinorUnits(minorUnits: number): string {
  return formatMoney(minorUnits);
}

export function timeAgo(isoString: string): string {
  const ms = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

// ── Dining ─────────────────────────────────────────────────────────────────────

export const diningApi = {
  listAreas: (locationId?: string) => {
    const qs = locationId ? `?locationId=${locationId}` : '';
    return api<DiningArea[]>(`/admin/dining/areas${qs}`);
  },
  listTables: (areaId?: string) => {
    const qs = areaId ? `?areaId=${areaId}` : '';
    return api<DiningTable[]>(`/admin/dining/tables${qs}`);
  },
  resetTable: (tableId: string) =>
    api<void>(`/admin/dining/tables/${tableId}/reset`, { method: 'POST' }),
};

// ── Sessions ───────────────────────────────────────────────────────────────────

export const sessionApi = {
  list: (filter?: { status?: string; locationId?: string }) => {
    const qs = new URLSearchParams();
    if (filter?.status) qs.set('status', filter.status);
    if (filter?.locationId) qs.set('locationId', filter.locationId);
    const q = qs.toString();
    return api<GuestSession[]>(`/admin/sessions${q ? `?${q}` : ''}`);
  },
  get: (id: string) => api<GuestSession>(`/admin/sessions/${id}`),
  billPreview: (id: string) => api<BillPreview>(`/admin/sessions/${id}/bill-preview`),
  open: (body: { locationId: string; diningTableId: string; partySize: number; notes?: string }) =>
    api<GuestSession>('/admin/sessions', { method: 'POST', body: JSON.stringify(body) }),
  close: (id: string, notes?: string) =>
    api<GuestSession>(`/admin/sessions/${id}/close`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),
  void_: (id: string, reason: string) =>
    api<GuestSession>(`/admin/sessions/${id}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};

// ── Orders ─────────────────────────────────────────────────────────────────────

export const orderApi = {
  list: (filter?: { sessionId?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (filter?.sessionId) qs.set('sessionId', filter.sessionId);
    if (filter?.status) qs.set('status', filter.status);
    const q = qs.toString();
    return api<ServiceRequest[]>(`/admin/orders${q ? `?${q}` : ''}`);
  },
  get: (id: string) => api<ServiceRequest>(`/admin/orders/${id}`),
  create: (body: {
    sessionId: string;
    idempotencyKey: string;
    lines: OrderLineInput[];
    notes?: string;
  }) => api<ServiceRequest>('/admin/orders', { method: 'POST', body: JSON.stringify(body) }),
  send: (id: string, notes?: string) =>
    api<ServiceRequest>(`/admin/orders/${id}/send`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),
  cancel: (id: string, reason = 'Cancelled by staff') =>
    api<ServiceRequest>(`/admin/orders/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  serve: (id: string) =>
    api<ServiceRequest>(`/admin/orders/${id}/serve`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
};

// ── Kitchen ────────────────────────────────────────────────────────────────────

export const kitchenApi = {
  queue: (locationId?: string) => {
    const qs = locationId ? `?locationId=${locationId}` : '';
    return api<ServiceRequest[]>(`/admin/kitchen${qs}`);
  },
  accept: (id: string) =>
    api<ServiceRequest>(`/admin/kitchen/${id}/accept`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  prepare: (id: string) =>
    api<ServiceRequest>(`/admin/kitchen/${id}/prepare`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  ready: (id: string) =>
    api<ServiceRequest>(`/admin/kitchen/${id}/ready`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
};

// ── Catalog ────────────────────────────────────────────────────────────────────

export const catalogApi = {
  listCategories: () => api<CatalogCategory[]>('/admin/catalog/categories'),
  listItems: () => api<CatalogItem[]>('/admin/catalog/items'),
  listModifierGroups: () => api<ModifierGroup[]>('/admin/catalog/modifier-groups'),
};

// ── Checkout ───────────────────────────────────────────────────────────────────

export const checkoutApi = {
  getOrCreateInvoice: (sessionId: string) =>
    api<Invoice>(`/admin/checkout/sessions/${sessionId}/invoice`, {
      method: 'POST',
      body: '{}',
    }),
  getInvoice: (sessionId: string) =>
    api<Invoice>(`/admin/checkout/sessions/${sessionId}/invoice`),
  finalise: (invoiceId: string) =>
    api<Invoice>(`/admin/checkout/invoices/${invoiceId}/finalise`, {
      method: 'POST',
      body: '{}',
    }),
  /** CASH is captured immediately; UPI stays PENDING until `capture` is called with the UTR. */
  pay: (
    invoiceId: string,
    method: string,
    amountMinorUnits: number,
    idempotencyKey: string = crypto.randomUUID(),
    extra: { cashReceivedMinorUnits?: number } = {},
  ) =>
    api<Payment>(`/admin/checkout/invoices/${invoiceId}/payments`, {
      method: 'POST',
      body: JSON.stringify({ method, amountMinorUnits, idempotencyKey, ...extra }),
    }),
  capture: (paymentId: string, referenceCode: string) =>
    api<Payment>(`/admin/checkout/payments/${paymentId}/capture`, {
      method: 'POST',
      body: JSON.stringify({ referenceCode }),
    }),
  void_: (invoiceId: string, reason = 'Voided by cashier') =>
    api<Invoice>(`/admin/checkout/invoices/${invoiceId}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};
