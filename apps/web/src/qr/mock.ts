/**
 * MOCK BACKEND (dev/tests only, loaded lazily when VITE_QR_MOCK=1). It mimics the planned
 * QR menu admin API in memory so the staff screens can be exercised before Q-API lands.
 * Fixtures are also imported by component tests. Not a source of truth for the contract.
 */
import type {
  GuestOrder,
  GuestOrderEdit,
  ItemPresentation,
  PhotoCategory,
  PhotoItem,
  QrSettings,
  QrSettingsPatch,
  QrTable,
  UploadedPicture,
  WaiterAlert,
} from './types';

// Defence in depth: api.ts only imports this file when QR_MOCK is on, and QR_MOCK is a build-time `false` in production.
if (import.meta.env.PROD) throw new Error('qr/mock must never be loaded in a production build');

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const token = (n: number) => `tok${String(n).padStart(2, '0')}AbCdEfGhIjKlMnOpQrStUvWxYz0123456789`.slice(0, 43);

export const fixtures = {
  tables(): QrTable[] {
    const base = { locationId: 'loc1', url: null, orderingEnabled: true, rotationCount: 0, version: 1 };
    return [
      { ...base, tableId: 't1', code: 'T1', areaName: 'Main Hall', token: token(1), enabled: true, rotatedAt: null, pendingGuestOrders: 0, waiterCall: null },
      { ...base, tableId: 't2', code: 'T2', areaName: 'Main Hall', token: token(2), enabled: true, rotatedAt: minutesAgo(900), rotationCount: 1, version: 2, pendingGuestOrders: 1, waiterCall: { reason: 'bill', at: minutesAgo(2) } },
      { ...base, tableId: 't3', code: 'T3', areaName: 'Main Hall', token: token(3), enabled: false, rotatedAt: null, pendingGuestOrders: 0, waiterCall: null },
      { ...base, tableId: 't4', code: 'T4', areaName: 'Terrace', token: token(4), enabled: true, orderingEnabled: false, rotatedAt: null, pendingGuestOrders: 0, waiterCall: null },
    ];
  },
  settings(): QrSettings {
    return { enabled: true, ordering: 'confirm', callWaiter: true, upi: true, tagline: 'Slow fire, honest spice', logoUrl: null, coverUrl: null, accentColor: null, version: 1 };
  },
  categories(): PhotoCategory[] {
    return [
      { id: 'c1', name: 'Starters', imageUrl: null },
      { id: 'c2', name: 'Mains', imageUrl: null },
    ];
  },
  items(): PhotoItem[] {
    return [
      { id: 'i1', name: 'Paneer Tikka', categoryId: 'c1', basePriceMinorUnits: 28000, isActive: true, imageUrl: '/media/paneer.webp', imageThumbUrl: null },
      { id: 'i2', name: 'Dal Makhani', categoryId: 'c2', basePriceMinorUnits: 32000, isActive: true, imageUrl: null, imageThumbUrl: null },
      { id: 'i3', name: 'Butter Naan', categoryId: 'c2', basePriceMinorUnits: 6000, isActive: true, imageUrl: null, imageThumbUrl: null },
    ];
  },
  orders(): GuestOrder[] {
    return [
      {
        id: 'g1',
        requestNumber: 'G-101',
        status: 'AWAITING_CONFIRMATION',
        tableId: 't2',
        tableCode: 'T2',
        areaName: 'Main Hall',
        locationId: 'loc1',
        rejectReason: null,
        guestName: 'Asha',
        placedAt: minutesAgo(4),
        note: 'Less spicy please',
        totalMinor: 2 * 28000 + 32000,
        lines: [
          { id: 'l1', name: 'Paneer Tikka', variantName: 'Half', qty: 2, unitPriceMinor: 28000, addOns: [], note: null, cancelled: false },
          { id: 'l2', name: 'Dal Makhani', variantName: null, qty: 1, unitPriceMinor: 32000, addOns: [], note: 'No cream', cancelled: false },
        ],
      },
    ];
  },
};

const state = {
  tables: fixtures.tables(),
  settings: fixtures.settings(),
  items: fixtures.items(),
  orders: fixtures.orders(),
  alerts: [{ tableId: 't2', tableCode: 'T2', areaName: 'Main Hall', reason: 'bill', at: minutesAgo(2) }] as WaiterAlert[],
  categories: fixtures.categories(),
};

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const swap = <T extends { tableId: string }>(list: T[], id: string, fn: (x: T) => T) => list.map((x) => (x.tableId === id ? fn(x) : x));

export const mockApi = {
  async tables() { await wait(); return structuredClone(state.tables); },
  async rotate(id: string) {
    await wait();
    state.tables = swap(state.tables, id, (t) => ({ ...t, token: `rot${Math.random().toString(36).slice(2).padEnd(40, 'x')}`.slice(0, 43), rotatedAt: new Date().toISOString(), rotationCount: t.rotationCount + 1, version: t.version + 1 }));
    return structuredClone(state.tables.find((t) => t.tableId === id) as QrTable);
  },
  async setTableEnabled(id: string, enabled: boolean) {
    await wait();
    state.tables = swap(state.tables, id, (t) => ({ ...t, enabled, version: t.version + 1 }));
    return structuredClone(state.tables.find((t) => t.tableId === id) as QrTable);
  },
  async setTableOrdering(id: string, orderingEnabled: boolean) {
    await wait();
    state.tables = swap(state.tables, id, (t) => ({ ...t, orderingEnabled, version: t.version + 1 }));
    return structuredClone(state.tables.find((t) => t.tableId === id) as QrTable);
  },
  async settings() { await wait(); return structuredClone(state.settings); },
  async saveSettings(patch: QrSettingsPatch) { await wait(); state.settings = { ...state.settings, ...patch, version: state.settings.version + 1 }; return structuredClone(state.settings); },
  async uploadBrandImage(kind: 'logo' | 'cover', blob: Blob) {
    await wait();
    const url = URL.createObjectURL(blob);
    state.settings = { ...state.settings, [kind === 'logo' ? 'logoUrl' : 'coverUrl']: url };
    return url;
  },
  async removeBrandImage(kind: 'logo' | 'cover') { await wait(); state.settings = { ...state.settings, [kind === 'logo' ? 'logoUrl' : 'coverUrl']: null }; },
  async photoCategories() { await wait(); return structuredClone(state.categories); },
  async photoItems() { await wait(); return structuredClone(state.items); },
  async uploadItemImage(id: string, blob: Blob, onProgress?: (f: number) => void) {
    for (const f of [0.3, 0.7, 1]) { await wait(80); onProgress?.(f); }
    const url = URL.createObjectURL(blob);
    state.items = state.items.map((i) => (i.id === id ? { ...i, imageUrl: url, imageThumbUrl: url } : i));
    return { imageUrl: url, imageThumbUrl: url } satisfies UploadedPicture;
  },
  async removeItemImage(id: string) { await wait(); state.items = state.items.map((i) => (i.id === id ? { ...i, imageUrl: null, imageThumbUrl: null } : i)); },
  async uploadCategoryImage(id: string, blob: Blob, onProgress?: (f: number) => void) {
    for (const f of [0.5, 1]) { await wait(60); onProgress?.(f); }
    const url = URL.createObjectURL(blob);
    state.categories = state.categories.map((c) => (c.id === id ? { ...c, imageUrl: url } : c));
    return { imageUrl: url, imageThumbUrl: null } satisfies UploadedPicture;
  },
  async removeCategoryImage(id: string) { await wait(); state.categories = state.categories.map((c) => (c.id === id ? { ...c, imageUrl: null } : c)); },
  async setItemPresentation(_id: string, _p: ItemPresentation) { await wait(); },
  async pendingOrders() { await wait(); return structuredClone(state.orders); },
  async alerts() { await wait(); return structuredClone(state.alerts); },
  async ackAlert(tableId: string) { await wait(); state.alerts = state.alerts.filter((a) => a.tableId !== tableId); },
  async confirm(id: string) {
    await wait();
    const o = state.orders.find((x) => x.id === id) as GuestOrder;
    state.orders = state.orders.filter((x) => x.id !== id);
    return { ...structuredClone(o), status: 'CONFIRMED' } as GuestOrder;
  },
  async reject(id: string, reason: string) {
    await wait();
    const o = state.orders.find((x) => x.id === id) as GuestOrder;
    state.orders = state.orders.filter((x) => x.id !== id);
    return { ...structuredClone(o), status: 'REJECTED', rejectReason: reason } as GuestOrder;
  },
  async edit(id: string, edit: GuestOrderEdit) {
    await wait();
    state.orders = state.orders.map((o) => {
      if (o.id !== id) return o;
      const lines = o.lines.flatMap((l) => {
        const e = edit.lines.find((x) => x.id === l.id);
        return !e ? [l] : e.qty > 0 ? [{ ...l, qty: e.qty }] : [];
      });
      const totalMinor = lines.reduce((s, l) => s + l.qty * (l.unitPriceMinor + l.addOns.reduce((a, x) => a + x.priceMinor, 0)), 0);
      return { ...o, lines, totalMinor, note: edit.note === undefined ? o.note : edit.note };
    });
    return structuredClone(state.orders.find((o) => o.id === id)) as GuestOrder;
  },
};
