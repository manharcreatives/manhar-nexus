/**
 * Staff-side QR menu types. They follow the "QR menu API contract" in
 * docs/landing/04_UPDATES_PLAN.md section B. Money is integer minor units (paise).
 * Anything marked ASSUMPTION is not in the contract yet and is flagged in
 * docs/landing/reports/16_QSTAFF_REPORT.md.
 */
export type OrderingMode = 'off' | 'confirm' | 'auto';
export type WaiterReason = 'call' | 'bill' | 'water' | 'other';

export interface WaiterCall {
  reason: WaiterReason;
  /** ISO time the guest asked. */
  at: string;
}

export interface QrTable {
  tableId: string;
  /** Table code as printed on the floor plan ("T4"). */
  code: string;
  areaName: string | null;
  /** Unguessable public token; the guest URL is `${origin}/m/${token}`. */
  token: string;
  /** Guest menu on for this table. */
  enabled: boolean;
  rotatedAt: string | null;
  /** Guest orders waiting for staff on this table. */
  pendingGuestOrders: number;
  waiterCall: WaiterCall | null;
}

export interface QrSettings {
  /** Master switch: false turns the guest menu off for the whole restaurant. */
  enabled: boolean;
  ordering: OrderingMode;
  callWaiter: boolean;
  upi: boolean;
  tagline: string;
  logoUrl: string | null;
  coverUrl: string | null;
  /** "#rrggbb" or null = the restaurant's own accent. */
  accentColor: string | null;
}

export type QrSettingsPatch = Partial<Omit<QrSettings, 'logoUrl' | 'coverUrl'>>;

export type GuestOrderStatus = 'AWAITING_CONFIRMATION' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED';

export interface GuestOrderLine {
  id: string;
  name: string;
  variantName: string | null;
  qty: number;
  unitPriceMinor: number;
  addOns: { name: string; priceMinor: number }[];
  note: string | null;
}

export interface GuestOrder {
  id: string;
  requestNumber: string | null;
  status: GuestOrderStatus;
  tableId: string;
  tableCode: string;
  areaName: string | null;
  guestName: string | null;
  /** ISO placement time (the "time waiting" clock starts here). */
  placedAt: string;
  note: string | null;
  lines: GuestOrderLine[];
  totalMinor: number;
}

export interface WaiterAlert {
  tableId: string;
  tableCode: string;
  reason: WaiterReason;
  at: string;
}

export interface GuestOrderEdit {
  lines: { id: string; qty: number }[];
  note?: string | null;
}

/** Menu item as the photo manager needs it (GET /admin/catalog/items + imageUrl from Q-API). */
export interface PhotoItem {
  id: string;
  name: string;
  categoryId: string | null;
  basePriceMinorUnits: number;
  isActive: boolean;
  imageUrl: string | null;
}

export interface PhotoCategory {
  id: string;
  name: string;
}
