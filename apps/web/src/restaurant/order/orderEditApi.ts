import { api } from '../../auth/api';
import type { OrderLineInput, ServiceRequest } from '../api';

/**
 * Client for the append-only order-edit endpoints (apps/api/src/restaurant/order/order-edit.controller.ts).
 *   POST /admin/orders/:id/edit    restaurant.order.edit   audited, idempotent, version-checked
 *   GET  /admin/orders/:id/edits   restaurant.order.view   { editable, edits }
 * Errors reach the caller as ApiError { status, code }:
 *   409 ORDER_EDIT_LOCKED | 409 VERSION_CONFLICT | 409 CONFLICT (idempotency key reused) | 400 VALIDATION | 404
 */

/** Machine-readable lock reasons (mirrors EditLockReason in order-edit.plan.ts). */
export type EditLockReason =
  | 'KITCHEN_STARTED'
  | 'ORDER_SERVED'
  | 'ORDER_CANCELLED'
  | 'SESSION_NOT_OPEN'
  | 'INVOICE_EXISTS';

export interface EditableState {
  allowed: boolean;
  reason?: EditLockReason;
  /** Server-written sentence for the lock; the UI prefers its own translated copy per reason. */
  message?: string;
}

export interface OrderEditRecord {
  id: string;
  editNumber: number;
  fromVersion: number;
  toVersion: number;
  actorLabel: string | null;
  reason: string | null;
  totalBeforeMinorUnits: number;
  totalAfterMinorUnits: number;
  createdAt: string;
}

export type EditOpDto =
  | { op: 'add'; line: OrderLineInput }
  | { op: 'update'; lineId: string; quantity?: number; notes?: string | null }
  | { op: 'remove'; lineId: string };

export interface EditOrderBody {
  /** Client-generated; retrying with the same key returns the original result. */
  idempotencyKey: string;
  /** The order version this screen was built from. */
  expectedVersion: number;
  reason?: string;
  /** Order-level note: replaces the current one, null clears it. Omit to leave it alone. */
  notes?: string | null;
  ops: EditOpDto[];
}

export type EditedOrder = ServiceRequest & { edit: { id: string; editNumber: number; replayed: boolean } };

export const orderEditApi = {
  edit: (orderId: string, body: EditOrderBody) =>
    api<EditedOrder>(`/admin/orders/${orderId}/edit`, { method: 'POST', body: JSON.stringify(body) }),
  state: (orderId: string) =>
    api<{ editable: EditableState; edits: OrderEditRecord[] }>(`/admin/orders/${orderId}/edits`),
};

/** The machine code of a thrown ApiError (`VERSION_CONFLICT`, `ORDER_EDIT_LOCKED`, ...), if any. */
export function errorCode(err: unknown): string | undefined {
  return (err as { code?: string } | null)?.code;
}
