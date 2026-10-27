/**
 * Realtime contract (ADR-032). The web client mirrors this file.
 *
 * Events carry NO business data: only which surface changed and where. Clients
 * refetch through the normal authorised APIs (snapshot model, no replay).
 */
export const REALTIME_TOPICS = [
  'orders', // service request created/sent/updated/cancelled/lines added
  'kitchen', // ticket status changed: accepted/preparing/ready/served
  'tables', // table status changed / reset
  'sessions', // guest session opened/closed
  'invoices', // invoice created/finalised/voided/paid
  'payments', // payment initiated/captured/cancelled/refunded
  'expenses', // expense created/approved/rejected
  'notifications', // alert notification created
] as const;

export type RealtimeTopic = (typeof REALTIME_TOPICS)[number];

/** Wire payload of `event: change`. */
export interface RealtimeChangePayload {
  topic: RealtimeTopic;
  locationId: string | null;
  at: string;
}

/** Wire payload of `event: hello`. */
export interface RealtimeHelloPayload {
  serverTime: string;
  heartbeatSeconds: number;
}

/** Internal event: the wire payload plus the tenant it belongs to. */
export interface RealtimeEvent extends RealtimeChangePayload {
  businessId: string;
}

export const HEARTBEAT_SECONDS = 20;
export const MAX_STREAMS_PER_USER = 5;
