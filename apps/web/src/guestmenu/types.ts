/** QR menu API contract (docs/landing/04_UPDATES_PLAN.md section B). Money = integer paise. */

export type Veg = 'veg' | 'nonveg' | 'egg';
export type OrderingMode = 'off' | 'confirm' | 'auto';
export type WaiterReason = 'call' | 'bill' | 'water' | 'other';

export interface AddOnOption { id: string; name: string; priceMinor: number }
export interface AddOnGroup { id: string; name: string; min: number; max: number; options: AddOnOption[] }
export interface Variant { id: string; name: string; priceMinor: number }

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description?: string | null;
  priceMinor: number;
  imageUrl?: string | null;
  blurDataUri?: string | null;
  veg?: Veg | null;
  tags: string[];
  spice?: number | null;
  soldOut: boolean;
  variants: Variant[];
  addOnGroups: AddOnGroup[];
}

export interface MenuCategory { id: string; name: string; description?: string | null; imageUrl?: string | null }

export interface MenuPayload {
  business: {
    name: string;
    slug?: string;
    tagline?: string | null;
    logoUrl?: string | null;
    coverUrl?: string | null;
    accentColor?: string | null;
    currency: string;
  };
  table: { label: string; areaName?: string | null; open: boolean };
  settings: { ordering: OrderingMode; callWaiter: boolean; payment: { upi: boolean } };
  categories: MenuCategory[];
  items: MenuItem[];
  etag: string;
  serverTime?: string;
}

export interface GuestSession { guestToken: string; expiresAt?: string }

export interface OrderLineInput { itemId: string; variantId?: string; addOnOptionIds?: string[]; qty: number; note?: string }
export interface PlaceOrderBody { lines: OrderLineInput[]; note?: string }
export interface PlaceOrderResult { orderId: string; status: string; totalMinor: number }

/** Tolerant: the server may send more fields; only these are read. */
export interface StateLine {
  itemId?: string;
  name?: string;
  qty: number;
  variantName?: string | null;
  addOns?: Array<string | { name: string }>;
  note?: string | null;
  lineTotalMinor?: number;
  totalMinor?: number;
}
export interface TimelineEntry { status: string; at: string }
export interface StateOrder {
  id: string;
  status: string;
  lines: StateLine[];
  placedAt?: string;
  note?: string | null;
  totalMinor?: number;
  timeline?: TimelineEntry[];
}
export interface TaxLine { name?: string; label?: string; rateBp?: number; ratePercent?: number; amountMinor: number }
export interface BillState {
  subtotalMinor: number;
  taxLines: TaxLine[];
  totalMinor: number;
  paidMinor: number;
  dueMinor: number;
  status?: string;
}
export interface TableState {
  orders: StateOrder[];
  bill: BillState | null;
  waiterCall: { open: boolean } | null;
}

export interface PayIntent { upiUri: string; qrPayload?: string; amountMinor: number; reference: string }

export type StreamEventName = 'menu.changed' | 'table.updated' | 'order.updated' | 'bill.updated' | 'waiter.ack';
export const STREAM_EVENTS: StreamEventName[] = ['menu.changed', 'table.updated', 'order.updated', 'bill.updated', 'waiter.ack'];
export interface StreamHandlers {
  onEvent: (name: StreamEventName, data: unknown) => void;
  onOpen: () => void;
  onError: () => void;
}
