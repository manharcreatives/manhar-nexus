import { beforeAll } from 'vitest';
import type { CatalogCategory, CatalogItem, ServiceRequest, ServiceRequestLine } from '../api';

/** Shared fixtures for the order UI tests. Not shipped: only *.test.* files import it. */

export const category = (id: string, name: string, displayOrder = 0): CatalogCategory => ({ id, name, displayOrder, isActive: true });

export const item = (id: string, name: string, price: number, extra: Partial<CatalogItem> = {}): CatalogItem => ({
  id,
  name,
  sku: '',
  basePriceMinorUnits: price,
  categoryId: 'cat-1',
  taxCategoryId: null,
  isActive: true,
  type: 'ITEM',
  variants: [],
  modifierGroups: [],
  ...extra,
});

export const MENU_CATEGORIES = [category('cat-1', 'Mains', 0), category('cat-2', 'Drinks', 1)];
export const MENU_ITEMS: CatalogItem[] = [
  item('i-dosa', 'Masala Dosa', 14000),
  item('i-paneer', 'Paneer Tikka', 28000),
  item('i-lassi', 'Sweet Lassi', 9000, { categoryId: 'cat-2' }),
];

export const line = (id: string, name: string, quantity: number, unit: number, extra: Partial<ServiceRequestLine> = {}): ServiceRequestLine => ({
  id,
  catalogItemId: 'i-dosa',
  itemNameSnapshot: name,
  variantNameSnapshot: null,
  quantity,
  unitPriceMinorUnits: unit,
  taxRateSnapshot: 5,
  modifiers: [],
  notes: null,
  status: 'PENDING',
  ...extra,
});

export const makeOrder = (extra: Partial<ServiceRequest> = {}): ServiceRequest => ({
  id: 'o-1',
  sessionId: 's-1',
  roundNumber: 1,
  requestNumber: 'K-1',
  status: 'SENT',
  sentAt: new Date().toISOString(),
  notes: null,
  version: 3,
  editCount: 0,
  lastEditedAt: null,
  lines: [line('l-1', 'Masala Dosa', 2, 14000), line('l-2', 'Paneer Tikka', 1, 28000, { catalogItemId: 'i-paneer' })],
  ...extra,
});

/** jsdom has no modal <dialog>: emulate the bits <Dialog> relies on. */
export function patchDialog(): void {
  beforeAll(() => {
    const proto = HTMLDialogElement.prototype as HTMLDialogElement & { __patched?: boolean };
    if (!proto.__patched) {
      proto.__patched = true;
      proto.showModal = function showModal(this: HTMLDialogElement) {
        this.setAttribute('open', '');
      };
      proto.close = function close(this: HTMLDialogElement) {
        this.removeAttribute('open');
        this.dispatchEvent(new Event('close'));
      };
    }
    if (!('randomUUID' in crypto)) {
      let n = 0;
      Object.defineProperty(crypto, 'randomUUID', { value: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` });
    }
  });
}

/** An error shaped like the one auth/api.ts throws. */
export const apiError = (status: number, code?: string, message = 'failed'): Error & { status: number; code?: string } =>
  Object.assign(new Error(message), { status, ...(code ? { code } : {}) });
