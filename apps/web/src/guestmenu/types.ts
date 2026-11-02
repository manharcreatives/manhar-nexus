/**
 * QR menu wire types: exactly what apps/api/src/guestmenu answers (docs/landing/04_UPDATES_PLAN.md section B,
 * "AS IMPLEMENTED"; ADR-035). Money = integer paise. Nullable fields are `null` on the wire, never absent.
 */

export type Veg = 'veg' | 'nonveg' | 'egg';
export type OrderingMode = 'off' | 'confirm' | 'auto';
export type WaiterReason = 'call' | 'bill' | 'water' | 'other';

export interface AddOnOption { id: string; name: string; priceMinor: number }
export interface AddOnGroup { id: string; name: string; min: number; max: number; options: AddOnOption[] }
/** `priceMinor` is the ABSOLUTE price of the variant (base + adjustment), not a delta. Unavailable variants are omitted. */
export interface Variant { id: string; name: string; priceMinor: number }

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  /** Base price. With variants the dish card shows the cheapest variant. */
  priceMinor: number;
  /** Absolute URL of the full picture (served by the public /media route). */
  imageUrl: string | null;
  /** 480 px picture, only when the server has `sharp`; otherwise null (use imageUrl). */
  thumbUrl: string | null;
  /** Tiny blurred preview as a data URI (blur-up). */
  blurDataUri: string | null;
  /** Dominant colour of the picture, `#rrggbb`. */
  color: string | null;
  veg: Veg | null;
  tags: string[];
  spice: number | null;
  soldOut: boolean;
  variants: Variant[];
  addOnGroups: AddOnGroup[];
}

export interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  blurDataUri: string | null;
  color: string | null;
}

export interface MenuPayload {
  business: {
    name: string;
    slug: string | null;
    tagline: string | null;
    logoUrl: string | null;
    coverUrl: string | null;
    coverBlurDataUri: string | null;
    coverColor: string | null;
    accentColor: string | null;
    currency: string;
  };
  table: { label: string; areaName: string | null; open: boolean };
  settings: { ordering: OrderingMode; callWaiter: boolean; payment: { upi: boolean } };
  categories: MenuCategory[];
  items: MenuItem[];
  /** Weak validator (`W/"..."`), equal to the ETag response header. */
  etag: string;
  serverTime: string;
}

/** `POST /guest` -> 201. */
export interface GuestSession { guestToken: string; expiresAt: string }

export interface OrderLineInput { itemId: string; variantId?: string; addOnOptionIds?: string[]; qty: number; note?: string }
export interface PlaceOrderBody { lines: OrderLineInput[]; note?: string }

/** Guest-facing order status vocabulary (guest-status.ts on the API). */
export type GuestOrderStatus = 'AWAITING_CONFIRMATION' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'SERVED' | 'REJECTED' | 'CANCELLED';

/** `POST /orders` -> 201 (or 200 + `Idempotent-Replay: true`, surfaced here as `replayed`). */
export interface PlaceOrderResult { orderId: string; status: GuestOrderStatus; totalMinor: number; replayed: boolean }

export interface StateLine {
  itemId: string | null;
  name: string;
  qty: number;
  variantName: string | null;
  addOns: string[];
  note: string | null;
  lineTotalMinor: number;
}
export interface TimelineEntry { status: GuestOrderStatus; at: string }
export interface StateOrder {
  /** The Service Request id (the same id staff see). */
  id: string;
  status: GuestOrderStatus;
  /** Placed from this device's guest token. Other guests' confirmed orders are shown too (mine = false). */
  mine: boolean;
  /** The kitchen-visible order was edited after confirmation. (Edits before confirmation do not set this.) */
  edited: boolean;
  placedAt: string;
  note: string | null;
  totalMinor: number;
  /** Only on REJECTED orders. */
  rejectReason?: string | null;
  lines: StateLine[];
  timeline: TimelineEntry[];
}

/** GST arrives as a CGST row plus an SGST row; `name` already contains the rate ("CGST 2.5%"). */
export interface TaxLine { name: string; label: string; ratePercent: number; amountMinor: number }
/** RUNNING = live total (equals the invoice the cashier will generate); FINAL = invoice finalised; PAID = settled. */
export type BillStatus = 'RUNNING' | 'FINAL' | 'PAID';
export interface BillState {
  subtotalMinor: number;
  taxLines: TaxLine[];
  totalMinor: number;
  paidMinor: number;
  dueMinor: number;
  status: BillStatus;
  /** Invoice reference, only once the bill is FINAL/PAID. */
  reference: string | null;
}
export type WaiterCall = { open: false } | { open: true; reason: WaiterReason; at: string };
export interface TableState {
  orders: StateOrder[];
  /** null until something is confirmed. */
  bill: BillState | null;
  waiterCall: WaiterCall;
}

/** `POST /pay-intent` -> 200. `amountMinor` = what is still due; `qrPayload` equals `upiUri`. */
export interface PayIntent { upiUri: string; qrPayload: string; amountMinor: number; reference: string }

/**
 * Live stream (SSE). Events are HINTS (ids and statuses only, never names or amounts): on any of them the page
 * re-reads /state or the menu with its guest token.
 */
export type StreamEventName = 'hello' | 'menu.changed' | 'table.updated' | 'order.updated' | 'bill.updated' | 'waiter.ack' | 'waiter.call' | 'bye';
export const STREAM_EVENTS: StreamEventName[] = ['hello', 'menu.changed', 'table.updated', 'order.updated', 'bill.updated', 'waiter.ack', 'waiter.call', 'bye'];
export type ByeReason = 'refresh' | 'token-changed' | 'unavailable';
export interface StreamHandlers {
  onEvent: (name: StreamEventName, data: unknown) => void;
  onOpen: () => void;
  /** Called on every failed attempt; the stream keeps reconnecting (backoff) until the closer is called. */
  onError: () => void;
}
