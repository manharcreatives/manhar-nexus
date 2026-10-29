import { api } from '../auth/api';
import type { CatalogCategory, CatalogItem, CatalogVariant, DiningArea, DiningTable, ModifierGroup, ModifierOption } from '../restaurant/api';

/** Admin (setup) endpoints. The owner / location manager configures the floor and the menu here. */

export interface SetupArea extends DiningArea {
  sortOrder?: number;
}

export interface SetupItem extends CatalogItem {
  isAvailable?: boolean;
  description?: string | null;
}

export interface TaxCategory {
  id: string;
  name: string;
  /** 0–1; Prisma Decimals arrive as strings. */
  rate: string | number;
  isDefault: boolean;
  isActive: boolean;
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

export const floorApi = {
  areas: (locationId?: string) => api<SetupArea[]>(`/admin/dining/areas${locationId ? `?locationId=${locationId}` : ''}`),
  tables: () => api<DiningTable[]>('/admin/dining/tables'),
  createArea: (body: { locationId: string; name: string }) => api<SetupArea>('/admin/dining/areas', { method: 'POST', ...json(body) }),
  updateArea: (id: string, body: { name?: string; isActive?: boolean }) =>
    api<SetupArea>(`/admin/dining/areas/${id}`, { method: 'PATCH', ...json(body) }),
  deleteArea: (id: string) => api<void>(`/admin/dining/areas/${id}`, { method: 'DELETE' }),
  createTable: (body: { diningAreaId: string; locationId: string; code: string; capacity: number }) =>
    api<DiningTable>('/admin/dining/tables', { method: 'POST', ...json(body) }),
  updateTable: (id: string, body: { code?: string; capacity?: number; isActive?: boolean }) =>
    api<DiningTable>(`/admin/dining/tables/${id}`, { method: 'PATCH', ...json(body) }),
  deleteTable: (id: string) => api<void>(`/admin/dining/tables/${id}`, { method: 'DELETE' }),
};

export const menuApi = {
  categories: () => api<CatalogCategory[]>('/admin/catalog/categories'),
  items: () => api<SetupItem[]>('/admin/catalog/items'),
  taxCategories: () => api<TaxCategory[]>('/admin/catalog/tax-categories'),
  createCategory: (body: { name: string; sortOrder?: number }) =>
    api<CatalogCategory>('/admin/catalog/categories', { method: 'POST', ...json(body) }),
  updateCategory: (id: string, body: { name?: string; isActive?: boolean }) =>
    api<CatalogCategory>(`/admin/catalog/categories/${id}`, { method: 'PATCH', ...json(body) }),
  deleteCategory: (id: string) => api<void>(`/admin/catalog/categories/${id}`, { method: 'DELETE' }),
  createItem: (body: { categoryId: string; taxCategoryId?: string; name: string; basePriceMinorUnits: number }) =>
    api<SetupItem>('/admin/catalog/items', { method: 'POST', ...json(body) }),
  updateItem: (
    id: string,
    body: { categoryId?: string; taxCategoryId?: string | null; name?: string; basePriceMinorUnits?: number; isAvailable?: boolean; isActive?: boolean },
  ) => api<SetupItem>(`/admin/catalog/items/${id}`, { method: 'PATCH', ...json(body) }),
  deleteItem: (id: string) => api<void>(`/admin/catalog/items/${id}`, { method: 'DELETE' }),
  createVariant: (itemId: string, body: { name: string; priceAdjMinorUnits: number }) =>
    api<CatalogVariant>(`/admin/catalog/items/${itemId}/variants`, { method: 'POST', ...json(body) }),
  deleteVariant: (itemId: string, variantId: string) =>
    api<void>(`/admin/catalog/items/${itemId}/variants/${variantId}`, { method: 'DELETE' }),
  modifierGroups: () => api<ModifierGroup[]>('/admin/catalog/modifier-groups'),
  createGroup: (body: { name: string; selectionType: 'SINGLE' | 'MULTIPLE'; isRequired: boolean; minSelections: number; maxSelections: number | null }) =>
    api<ModifierGroup>('/admin/catalog/modifier-groups', { method: 'POST', ...json(body) }),
  updateGroup: (id: string, body: { name?: string; selectionType?: 'SINGLE' | 'MULTIPLE'; isRequired?: boolean; minSelections?: number; maxSelections?: number | null }) =>
    api<ModifierGroup>(`/admin/catalog/modifier-groups/${id}`, { method: 'PATCH', ...json(body) }),
  deleteGroup: (id: string) => api<void>(`/admin/catalog/modifier-groups/${id}`, { method: 'DELETE' }),
  createOption: (groupId: string, body: { name: string; priceAdjMinorUnits: number }) =>
    api<ModifierOption>(`/admin/catalog/modifier-groups/${groupId}/options`, { method: 'POST', ...json(body) }),
  deleteOption: (groupId: string, optionId: string) =>
    api<void>(`/admin/catalog/modifier-groups/${groupId}/options/${optionId}`, { method: 'DELETE' }),
  linkGroup: (itemId: string, modifierGroupId: string) =>
    api<unknown>(`/admin/catalog/items/${itemId}/modifier-groups`, { method: 'POST', ...json({ modifierGroupId }) }),
  unlinkGroup: (itemId: string, modifierGroupId: string) =>
    api<void>(`/admin/catalog/items/${itemId}/modifier-groups/${modifierGroupId}`, { method: 'DELETE' }),
  createTaxCategory: (body: { name: string; rate: number; isDefault?: boolean }) =>
    api<TaxCategory>('/admin/catalog/tax-categories', { method: 'POST', ...json(body) }),
};

/** Stable "T1, T2, … T10" codes for bulk-adding tables. */
export function bulkCodes(prefix: string, from: number, count: number): string[] {
  const p = prefix.trim();
  return Array.from({ length: count }, (_, i) => `${p}${from + i}`);
}
