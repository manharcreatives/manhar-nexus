import { GuestOrderDecision, ServiceRequestStatus } from '@prisma/client';
import { buildOrderTimeline, type AuditRowLike } from '../restaurant/timeline/order-timeline.util';
import type { GuestOrderStatus } from './guestmenu.types';

export interface StatusInput {
  status: ServiceRequestStatus;
  guestOrder?: { decision: GuestOrderDecision } | null;
}

/**
 * Kitchen/service status -> the five-stage vocabulary of the guest page.
 *   DRAFT + guest order  -> AWAITING_CONFIRMATION   (waiter has not confirmed yet)
 *   SENT                 -> CONFIRMED               (received by the kitchen queue)
 *   ACCEPTED, PREPARING  -> PREPARING               (accepting an order starts it: see OrderService.transitionRequest)
 *   READY / SERVED(CLOSED) / CANCELLED as is; a rejected guest order is REJECTED.
 */
export function guestStatusOf(r: StatusInput): GuestOrderStatus {
  if (r.guestOrder?.decision === GuestOrderDecision.REJECTED) return 'REJECTED';
  switch (r.status) {
    case ServiceRequestStatus.DRAFT:
      return 'AWAITING_CONFIRMATION';
    case ServiceRequestStatus.SENT:
      return 'CONFIRMED';
    case ServiceRequestStatus.ACCEPTED:
    case ServiceRequestStatus.PREPARING:
      return 'PREPARING';
    case ServiceRequestStatus.READY:
      return 'READY';
    case ServiceRequestStatus.SERVED:
    case ServiceRequestStatus.CLOSED:
      return 'SERVED';
    case ServiceRequestStatus.CANCELLED:
      return 'CANCELLED';
  }
}

export interface TimelineRow {
  createdAt: Date;
  sentAt: Date | null;
  acceptedAt: Date | null;
  preparedAt: Date | null;
  servedAt: Date | null;
  status: ServiceRequestStatus;
}

/** Customer-safe timeline: statuses and times only (no staff names, no free text). Each stage appears once, in order. */
export function guestTimeline(
  events: AuditRowLike[],
  row: TimelineRow,
  opts: { guestOrder: boolean; rejected: boolean },
): { status: GuestOrderStatus; at: string }[] {
  const steps = buildOrderTimeline(events, row, new Date()).steps;
  const out: { status: GuestOrderStatus; at: string }[] = [];
  const push = (status: GuestOrderStatus, at: string): void => {
    if (out.some((o) => o.status === status)) return;
    out.push({ status, at });
  };
  for (const s of steps) {
    switch (s.kind) {
      case 'created':
        if (opts.guestOrder) push('AWAITING_CONFIRMATION', s.at);
        break;
      case 'sent':
        push('CONFIRMED', s.at);
        break;
      case 'accepted':
      case 'preparing':
        push('PREPARING', s.at);
        break;
      case 'ready':
        push('READY', s.at);
        break;
      case 'served':
        push('SERVED', s.at);
        break;
      case 'cancelled':
        push(opts.rejected ? 'REJECTED' : 'CANCELLED', s.at);
        break;
      default:
        break;
    }
  }
  return out;
}
