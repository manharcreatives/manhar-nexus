import type { ServiceRequest } from '../api';
import type { EditLockReason } from './orderEditApi';

/**
 * Client mirror of the API's editable rule (order-edit.plan.ts `editLockReason`) for what the browser can see:
 * the request status and its lines. It decides whether "Edit order" is offered or shown disabled with a reason.
 * The two server-only guards (session closed, bill already generated) are not visible here; the dialog asks
 * GET /admin/orders/:id/edits on open and the API re-checks on save, so the server stays the authority.
 *
 *   DRAFT / SENT          editable (SENT is flagged "edited" on the kitchen screen)
 *   ACCEPTED/PREPARING/READY  locked  KITCHEN_STARTED   (also: SENT with any line already past PENDING)
 *   SERVED                locked  ORDER_SERVED
 *   CANCELLED             locked  ORDER_CANCELLED
 */
export function clientLockReason(order: Pick<ServiceRequest, 'status' | 'lines'>): EditLockReason | null {
  switch (order.status) {
    case 'CANCELLED':
      return 'ORDER_CANCELLED';
    case 'SERVED':
      return 'ORDER_SERVED';
    case 'ACCEPTED':
    case 'PREPARING':
    case 'READY':
      return 'KITCHEN_STARTED';
    default:
      break;
  }
  if (order.lines.some((l) => l.status !== 'PENDING' && l.status !== 'CANCELLED')) return 'KITCHEN_STARTED';
  return null;
}

/** Orders that show an Edit button at all (a cancelled order has nothing left to edit). */
export function showsEditButton(order: Pick<ServiceRequest, 'status'>): boolean {
  return order.status !== 'CANCELLED';
}
