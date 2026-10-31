import type { GuestSession, QrOrderingMode } from '@prisma/client';

export type OrderingMode = 'off' | 'confirm' | 'auto';

/** Everything the public endpoints need to know about one QR token, resolved once and cached for a few seconds. */
export interface TableContext {
  token: string;
  qrId: string;
  tableId: string;
  tableCode: string;
  areaName: string | null;
  locationId: string;
  businessId: string;
  /** Per-table ordering switch. */
  tableOrderingEnabled: boolean;
  business: {
    name: string;
    slug: string | null;
    accentColor: string | null;
    logoUrl: string | null;
    currencyCode: string;
  };
  settings: {
    orderingMode: QrOrderingMode;
    callWaiter: boolean;
    upiEnabled: boolean;
    tagline: string | null;
    accentColor: string | null;
    logoUrl: string | null;
    logoBlur: string | null;
    coverUrl: string | null;
    coverBlur: string | null;
    coverColor: string | null;
  };
  /** upi_vpa is set and valid for this table's location. */
  upiConfigured: boolean;
  /** Effective guest-ordering mode for this table (settings x per-table switch). */
  ordering: OrderingMode;
}

export type OpenSession = Pick<GuestSession, 'id' | 'locationId' | 'diningTableId' | 'businessId' | 'openedAt'>;

/** Guest-facing order status (what the web stepper understands). */
export type GuestOrderStatus =
  | 'AWAITING_CONFIRMATION'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'REJECTED'
  | 'CANCELLED';

export const lower = <T extends string>(v: T): Lowercase<T> => v.toLowerCase() as Lowercase<T>;
