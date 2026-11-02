import type {
  DietType,
  GuestOrder,
  GuestOrderLine,
  GuestOrderStatus,
  ItemPresentation,
  OrderingMode,
  PhotoCategory,
  PhotoItem,
  QrSettings,
  QrTable,
  SpiceLevel,
  UploadedPicture,
  WaiterAlert,
  WaiterCall,
  WaiterReason,
} from './types';

/**
 * Wire -> UI mappers. The API (apps/api/src/guestmenu/**) is the source of truth for every shape read
 * here; fields it does not send get a safe default so one odd row never blanks a screen.
 */
type Raw = Record<string, unknown>;

const isRaw = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** Every list endpoint answers with a bare JSON array. */
export function asArray(v: unknown): Raw[] {
  return Array.isArray(v) ? v.filter(isRaw) : [];
}

const REASONS: readonly WaiterReason[] = ['call', 'bill', 'water', 'other'];
const reason = (v: unknown): WaiterReason => ((REASONS as readonly unknown[]).includes(v) ? (v as WaiterReason) : 'call');

/** `waiterCall` is `{ open: true, reason, at }` or null. */
function toCall(v: unknown): WaiterCall | null {
  if (!isRaw(v) || v.open !== true) return null;
  return { reason: reason(v.reason), at: str(v.at) ?? new Date().toISOString() };
}

export function toQrTable(raw: Raw): QrTable {
  return {
    tableId: str(raw.tableId) ?? '',
    code: str(raw.code) ?? '',
    areaName: str(raw.areaName),
    locationId: str(raw.locationId) ?? '',
    token: str(raw.token) ?? '',
    url: str(raw.url),
    enabled: raw.enabled !== false,
    orderingEnabled: raw.orderingEnabled !== false,
    rotatedAt: str(raw.rotatedAt),
    rotationCount: num(raw.rotationCount),
    version: num(raw.version, 1),
    pendingGuestOrders: num(raw.pendingGuestOrders),
    waiterCall: toCall(raw.waiterCall),
  };
}

const ORDERING: readonly OrderingMode[] = ['off', 'confirm', 'auto'];

export function toQrSettings(raw: unknown): QrSettings {
  const r = isRaw(raw) ? raw : {};
  return {
    enabled: r.enabled !== false,
    ordering: (ORDERING as readonly unknown[]).includes(r.ordering) ? (r.ordering as OrderingMode) : 'confirm',
    callWaiter: r.callWaiter !== false,
    upi: r.upi === true,
    tagline: str(r.tagline) ?? '',
    logoUrl: str(r.logoUrl),
    coverUrl: str(r.coverUrl),
    accentColor: str(r.accentColor),
    version: num(r.version, 1),
  };
}

function toLine(raw: Raw, i: number): GuestOrderLine {
  const addOns = Array.isArray(raw.addOns) ? raw.addOns : [];
  return {
    id: str(raw.id) ?? `line-${i}`,
    name: str(raw.name) ?? '',
    variantName: str(raw.variantName),
    qty: num(raw.qty, 1),
    unitPriceMinor: num(raw.unitPriceMinor),
    addOns: addOns.filter(isRaw).map((a) => ({ name: str(a.name) ?? '', priceMinor: num(a.priceMinor) })),
    note: str(raw.note),
    cancelled: raw.cancelled === true,
  };
}

const STATUSES: readonly GuestOrderStatus[] = ['AWAITING_CONFIRMATION', 'CONFIRMED', 'REJECTED', 'CANCELLED'];

export function toGuestOrder(raw: Raw): GuestOrder {
  const lines = Array.isArray(raw.lines) ? raw.lines.filter(isRaw).map(toLine) : [];
  const live = lines.filter((l) => !l.cancelled);
  const computed = live.reduce((sum, l) => sum + l.qty * (l.unitPriceMinor + l.addOns.reduce((s, a) => s + a.priceMinor, 0)), 0);
  return {
    id: str(raw.id) ?? '',
    requestNumber: str(raw.requestNumber),
    status: (STATUSES as readonly unknown[]).includes(raw.status) ? (raw.status as GuestOrderStatus) : 'AWAITING_CONFIRMATION',
    tableId: str(raw.tableId) ?? '',
    tableCode: str(raw.tableCode) ?? '',
    areaName: str(raw.areaName),
    locationId: str(raw.locationId) ?? '',
    guestName: str(raw.guestName),
    placedAt: str(raw.placedAt) ?? new Date().toISOString(),
    note: str(raw.note),
    rejectReason: str(raw.rejectReason),
    lines,
    totalMinor: num(raw.totalMinor, computed),
  };
}

export function toWaiterAlert(raw: Raw): WaiterAlert {
  return {
    tableId: str(raw.tableId) ?? '',
    tableCode: str(raw.tableCode) ?? '',
    areaName: str(raw.areaName),
    reason: reason(raw.reason),
    at: str(raw.at) ?? new Date().toISOString(),
  };
}

/** GET /admin/catalog/items returns the raw catalog columns (imageUrl, imageThumbUrl, dietType, ...). */
export function toPhotoItem(raw: Raw): PhotoItem {
  return {
    id: str(raw.id) ?? '',
    name: str(raw.name) ?? '',
    categoryId: str(raw.categoryId),
    basePriceMinorUnits: num(raw.basePriceMinorUnits),
    isActive: raw.isActive !== false,
    imageUrl: str(raw.imageUrl),
    imageThumbUrl: str(raw.imageThumbUrl),
  };
}

export function toPhotoCategory(raw: Raw): PhotoCategory {
  return { id: str(raw.id) ?? '', name: str(raw.name) ?? '', imageUrl: str(raw.imageUrl) };
}

/** `{ imageUrl, imageThumbUrl, ... }` answered by POST .../image and POST /admin/qr/settings/logo|cover. */
export function toUploadedPicture(raw: unknown): UploadedPicture {
  const r = isRaw(raw) ? raw : {};
  return { imageUrl: str(r.imageUrl) ?? str(r.url), imageThumbUrl: str(r.imageThumbUrl) };
}

const DIETS: readonly DietType[] = ['VEG', 'NONVEG', 'EGG'];

/** Dietary mark, tags and spice level of a catalog item row (any object; unknown values fall back to "not set"). */
export function toPresentation(raw: unknown): ItemPresentation {
  const r = isRaw(raw) ? raw : {};
  const spice = r.spiceLevel;
  return {
    dietType: (DIETS as readonly unknown[]).includes(r.dietType) ? (r.dietType as DietType) : null,
    menuTags: Array.isArray(r.menuTags) ? r.menuTags.filter((t): t is string => typeof t === 'string' && t !== '') : [],
    spiceLevel: spice === 0 || spice === 1 || spice === 2 || spice === 3 ? (spice as SpiceLevel) : null,
  };
}
