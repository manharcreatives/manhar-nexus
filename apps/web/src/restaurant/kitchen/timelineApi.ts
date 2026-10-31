import { api } from '../../auth/api';

/** Mirrors apps/api/src/restaurant/timeline/order-timeline.{util,service}.ts (GET /admin/kitchen/:id/timeline). */
export type TimelineKind =
  | 'created'
  | 'items_changed'
  | 'sent'
  | 'edited'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'cancelled'
  | 'item_cancelled'
  | 'other';

export interface TimelineStep {
  id: string;
  kind: TimelineKind;
  /** Raw audit action, for steps this client version has no wording for. */
  action: string;
  at: string;
  actor: { type: 'staff' | 'system' | 'unknown'; label: string | null };
  sincePreviousMs: number;
  sinceStartMs: number;
  detail: { reason?: string; lineCount?: number; editNumber?: number; changeCount?: number; requestNumber?: string; statusAtEdit?: string };
  source: 'activity' | 'record';
}

export interface OrderTimelineResponse {
  steps: TimelineStep[];
  finished: boolean;
  startedAt: string | null;
  endedAt: string | null;
  totalMs: number;
  order: { id: string; status: string; roundNumber: number; requestNumber: string | null; sentAt: string | null };
  serverTime: string;
}

export const timelineApi = {
  get: (orderId: string) => api<OrderTimelineResponse>(`/admin/kitchen/${encodeURIComponent(orderId)}/timeline`),
};
