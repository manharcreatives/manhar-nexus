import type {
  GuestOrder,
  GuestOrderLine,
  GuestOrderStatus,
  OrderingMode,
  PhotoCategory,
  PhotoItem,
  QrSettings,
  QrTable,
  WaiterAlert,
  WaiterCall,
  WaiterReason,
} from './types';

/**
 * The API layer is written concurrently with this screen, so the wire format is read
 * defensively: known aliases are accepted and every field gets a safe default. Once the
 * contract is final these mappers stay as the single place that knows the wire shape.
 */
type Raw = Record<string, unknown>;

const isRaw = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const pick = (r: Raw, ...keys: string[]): unknown => {
  for (const k of keys) if (r[k] !== undefined && r[k] !== null) return r[k];
  return undefined;
};

/** Accepts `[...]` or `{ items: [...] }` / `{ data: [...] }`. */
export function asArray(v: unknown): Raw[] {
  const list = Array.isArray(v) ? v : isRaw(v) ? (v.items ?? v.data ?? v.results ?? v.tables ?? v.orders) : [];
  return Array.isArray(list) ? list.filter(isRaw) : [];
}

const REASONS: readonly WaiterReason[] = ['call', 'bill', 'water', 'other'];
const reason = (v: unknown): WaiterReason => (REASONS as readonly unknown[]).includes(v) ? (v as WaiterReason) : 'call';

function toCall(v: unknown): WaiterCall | null {
  if (!isRaw(v)) return null;
  if (v.open === false) return null;
  const at = str(pick(v, 'at', 'requestedAt', 'createdAt'));
  if (!at && v.open !== true) return null;
  return { reason: reason(v.reason), at: at ?? new Date().toISOString() };
}

export function toQrTable(raw: Raw): QrTable {
  const area = pick(raw, 'area', 'diningArea');
  return {
    tableId: str(pick(raw, 'tableId', 'diningTableId', 'id')) ?? '',
    code: str(pick(raw, 'code', 'label', 'tableCode', 'tableLabel')) ?? '',
    areaName: str(pick(raw, 'areaName')) ?? (isRaw(area) ? str(area.name) : null),
    token: str(pick(raw, 'token', 'tableToken', 'publicToken')) ?? '',
    enabled: pick(raw, 'enabled', 'isEnabled', 'guestMenuEnabled') !== false,
    rotatedAt: str(pick(raw, 'rotatedAt', 'tokenRotatedAt')),
    pendingGuestOrders: num(pick(raw, 'pendingGuestOrders', 'pendingOrders', 'awaitingConfirmation')),
    waiterCall: toCall(pick(raw, 'waiterCall', 'waiterRequest')),
  };
}

const ORDERING: readonly OrderingMode[] = ['off', 'confirm', 'auto'];

export function toQrSettings(raw: unknown): QrSettings {
  const r = isRaw(raw) ? raw : {};
  const payment = isRaw(r.payment) ? r.payment : {};
  const ordering = pick(r, 'ordering', 'orderingMode');
  return {
    enabled: pick(r, 'enabled', 'guestMenuEnabled') !== false,
    ordering: (ORDERING as readonly unknown[]).includes(ordering) ? (ordering as OrderingMode) : 'confirm',
    callWaiter: pick(r, 'callWaiter') !== false,
    upi: pick(r, 'upi', 'upiEnabled') !== undefined ? pick(r, 'upi', 'upiEnabled') === true : payment.upi === true,
    tagline: str(r.tagline) ?? '',
    logoUrl: str(r.logoUrl),
    coverUrl: str(r.coverUrl),
    accentColor: str(r.accentColor),
  };
}

function toLine(raw: Raw, i: number): GuestOrderLine {
  const addOns = pick(raw, 'addOns', 'modifiers', 'options');
  return {
    id: str(raw.id) ?? `line-${i}`,
    name: str(pick(raw, 'name', 'itemName', 'itemNameSnapshot')) ?? '',
    variantName: str(pick(raw, 'variantName', 'variantNameSnapshot')),
    qty: num(pick(raw, 'qty', 'quantity'), 1),
    unitPriceMinor: num(pick(raw, 'unitPriceMinor', 'unitPriceMinorUnits', 'priceMinor')),
    addOns: Array.isArray(addOns)
      ? addOns.filter(isRaw).map((a) => ({
          name: str(pick(a, 'name', 'optionNameSnapshot')) ?? '',
          priceMinor: num(pick(a, 'priceMinor', 'priceAdjMinorUnits')),
        }))
      : [],
    note: str(pick(raw, 'note', 'notes')),
  };
}

const STATUSES: readonly GuestOrderStatus[] = ['AWAITING_CONFIRMATION', 'CONFIRMED', 'REJECTED', 'CANCELLED'];

export function toGuestOrder(raw: Raw): GuestOrder {
  const table = pick(raw, 'table');
  const lines = Array.isArray(raw.lines) ? raw.lines.filter(isRaw).map(toLine) : [];
  const status = pick(raw, 'status');
  const computed = lines.reduce(
    (sum, l) => sum + l.qty * (l.unitPriceMinor + l.addOns.reduce((s, a) => s + a.priceMinor, 0)),
    0,
  );
  return {
    id: str(raw.id) ?? '',
    requestNumber: str(pick(raw, 'requestNumber', 'number')),
    status: (STATUSES as readonly unknown[]).includes(status) ? (status as GuestOrderStatus) : 'AWAITING_CONFIRMATION',
    tableId: str(pick(raw, 'tableId', 'diningTableId')) ?? (isRaw(table) ? str(table.id) : null) ?? '',
    tableCode:
      str(pick(raw, 'tableCode', 'tableLabel')) ?? (isRaw(table) ? str(pick(table, 'code', 'label')) : null) ?? '',
    areaName: str(pick(raw, 'areaName')) ?? (isRaw(table) ? str(table.areaName) : null),
    guestName: str(pick(raw, 'guestName', 'displayName')),
    placedAt: str(pick(raw, 'placedAt', 'createdAt', 'sentAt')) ?? new Date().toISOString(),
    note: str(pick(raw, 'note', 'notes')),
    lines,
    totalMinor: num(pick(raw, 'totalMinor', 'totalMinorUnits'), computed),
  };
}

export function toWaiterAlert(raw: Raw): WaiterAlert {
  return {
    tableId: str(pick(raw, 'tableId', 'diningTableId')) ?? '',
    tableCode: str(pick(raw, 'tableCode', 'code', 'label')) ?? '',
    reason: reason(raw.reason),
    at: str(pick(raw, 'at', 'requestedAt', 'createdAt')) ?? new Date().toISOString(),
  };
}

export function toPhotoItem(raw: Raw): PhotoItem {
  return {
    id: str(raw.id) ?? '',
    name: str(raw.name) ?? '',
    categoryId: str(raw.categoryId),
    basePriceMinorUnits: num(raw.basePriceMinorUnits),
    isActive: raw.isActive !== false,
    imageUrl: str(pick(raw, 'imageUrl', 'image')),
  };
}

export function toPhotoCategory(raw: Raw): PhotoCategory {
  return { id: str(raw.id) ?? '', name: str(raw.name) ?? '' };
}
