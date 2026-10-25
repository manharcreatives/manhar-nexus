import { api } from '../auth/api';
import { formatMoney } from '../lib/money';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Location {
  id: string;
  name: string;
  timezone: string;
  isActive: boolean;
}

export interface ExpenseCategory {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  requiresApproval: boolean;
  isActive: boolean;
  sortOrder: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type ExpenseStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface Expense {
  id: string;
  businessId: string;
  locationId: string;
  expenseCategoryId: string;
  amountMinorUnits: number;
  paidAt: string;
  description: string | null;
  vendorName: string | null;
  status: ExpenseStatus;
  approvedById: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  isRecurring: boolean;
  recurringNote: string | null;
  idempotencyKey: string;
  createdById: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string; requiresApproval: boolean };
  location: { id: string; name: string };
  createdBy: { id: string; email: string } | null;
  approvedBy: { id: string; email: string } | null;
}

export interface CostSummary {
  from: string;
  to: string;
  locationId?: string;
  grandTotalMinorUnits: number;
  expenseCount: number;
  byCategory: Array<{
    categoryId: string;
    categoryName: string;
    totalMinorUnits: number;
    count: number;
  }>;
}

const json = (body: unknown) => ({
  method: 'POST',
  body: JSON.stringify(body),
});

const patch = (body: unknown) => ({
  method: 'PATCH',
  body: JSON.stringify(body),
});

// ── Location endpoints ────────────────────────────────────────────────────────

export const listLocations = () => api<Location[]>('/admin/locations');

// ── Category endpoints ────────────────────────────────────────────────────────

export const costsApi = {
  listCategories: () =>
    api<ExpenseCategory[]>('/admin/costs/categories'),

  createCategory: (data: {
    name: string;
    description?: string;
    requiresApproval?: boolean;
    sortOrder?: number;
  }) => api<ExpenseCategory>('/admin/costs/categories', json(data)),

  updateCategory: (
    id: string,
    data: Partial<{
      name: string;
      description: string;
      requiresApproval: boolean;
      isActive: boolean;
      sortOrder: number;
    }>,
  ) => api<ExpenseCategory>(`/admin/costs/categories/${id}`, patch(data)),

  // ── Expense endpoints ─────────────────────────────────────────────────────

  listExpenses: (
    filters: {
      locationId?: string;
      categoryId?: string;
      status?: ExpenseStatus;
      from?: string;
      to?: string;
    } = {},
  ) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined) params.set(k, v);
    }
    const qs = params.toString();
    return api<Expense[]>(`/admin/costs/expenses${qs ? `?${qs}` : ''}`);
  },

  createExpense: (data: {
    locationId: string;
    expenseCategoryId: string;
    amountMinorUnits: number;
    paidAt: string;
    description?: string;
    vendorName?: string;
    isRecurring?: boolean;
    recurringNote?: string;
    idempotencyKey: string;
  }) => api<Expense>('/admin/costs/expenses', json(data)),

  getExpense: (id: string) =>
    api<Expense>(`/admin/costs/expenses/${id}`),

  approveExpense: (id: string) =>
    api<Expense>(`/admin/costs/expenses/${id}/approve`, { method: 'POST', body: '{}' }),

  rejectExpense: (id: string, rejectionReason: string) =>
    api<Expense>(`/admin/costs/expenses/${id}/reject`, json({ rejectionReason })),

  getSummary: (from: string, to: string, locationId?: string) => {
    const params = new URLSearchParams({ from, to });
    if (locationId) params.set('locationId', locationId);
    return api<CostSummary>(`/admin/costs/summary?${params.toString()}`);
  },
};

export function formatMinorUnits(minorUnits: number): string {
  return formatMoney(minorUnits);
}
