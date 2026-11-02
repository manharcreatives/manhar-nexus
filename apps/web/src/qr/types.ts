/**
 * Staff-side QR menu types. They follow the wire format as implemented by the API
 * (apps/api/src/guestmenu/**, docs/landing/04_UPDATES_PLAN.md section B "AS IMPLEMENTED", ADR-035).
 * Money is integer minor units (paise).
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
  locationId: string;
  /** Unguessable public token (192 bit); the guest URL path is `/m/${token}`. */
  token: string;
  /**
   * Absolute guest URL when the server knows the public origin (QR_PUBLIC_BASE_URL), otherwise null and the
   * page origin is used (see tableMenuUrl in qrCode.ts).
   */
  url: string | null;
  /** Guest menu on for this table. */
  enabled: boolean;
  /** Guest ordering on for this table (only meaningful while `enabled`). */
  orderingEnabled: boolean;
  rotatedAt: string | null;
  rotationCount: number;
  /** Optimistic-concurrency version; sent back as `expectedVersion` on rotate / patch. */
  version: number;
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
  /** Optimistic-concurrency version; sent back as `expectedVersion` on PATCH. */
  version: number;
}

/** PATCH /admin/qr/settings body (logo and cover go through their own multipart endpoints). */
export type QrSettingsPatch = Partial<Omit<QrSettings, 'logoUrl' | 'coverUrl' | 'version'>>;

export type GuestOrderStatus = 'AWAITING_CONFIRMATION' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED';

export interface GuestOrderLine {
  id: string;
  name: string;
  variantName: string | null;
  qty: number;
  /** Base + variant, WITHOUT add-ons (those are listed separately). */
  unitPriceMinor: number;
  addOns: { name: string; priceMinor: number }[];
  note: string | null;
  cancelled: boolean;
}

export interface GuestOrder {
  /** The service request id: the `:id` of confirm / reject / edit. */
  id: string;
  requestNumber: string | null;
  status: GuestOrderStatus;
  tableId: string;
  tableCode: string;
  areaName: string | null;
  locationId: string;
  guestName: string | null;
  /** ISO placement time (the "time waiting" clock starts here). */
  placedAt: string;
  note: string | null;
  rejectReason: string | null;
  lines: GuestOrderLine[];
  /** Before tax. */
  totalMinor: number;
}

export interface WaiterAlert {
  tableId: string;
  tableCode: string;
  areaName: string | null;
  reason: WaiterReason;
  at: string;
}

/** POST /admin/guest-orders/:id/edit: `qty` 0 removes a line; every `id` is a line id of that order. */
export interface GuestOrderEdit {
  lines: { id: string; qty: number }[];
  note?: string | null;
}

export type DietType = 'VEG' | 'NONVEG' | 'EGG';
export type SpiceLevel = 0 | 1 | 2 | 3;

/** PATCH /admin/menu/items/:id/presentation (restaurant.qr.manage). */
export interface ItemPresentation {
  dietType: DietType | null;
  /** At most 6 tags of at most 24 characters. */
  menuTags: string[];
  spiceLevel: SpiceLevel | null;
}

/** Menu item as the photo manager needs it (GET /admin/catalog/items). */
export interface PhotoItem {
  id: string;
  name: string;
  categoryId: string | null;
  basePriceMinorUnits: number;
  isActive: boolean;
  imageUrl: string | null;
  /** 480 px copy (null until the server could make one). */
  imageThumbUrl: string | null;
}

export interface PhotoCategory {
  id: string;
  name: string;
  imageUrl: string | null;
}

/** Result of a picture upload (`imageUrl` is relative to the API origin; run it through assetUrl()). */
export interface UploadedPicture {
  imageUrl: string | null;
  imageThumbUrl: string | null;
}
