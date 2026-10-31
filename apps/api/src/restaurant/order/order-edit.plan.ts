import { ServiceLineStatus, ServiceRequestStatus } from '@prisma/client';
import { DomainError, NotFoundError, ValidationError } from '../../common/errors';
import type { EditOp } from './order-edit.dto';

/**
 * Pure rules for editing a service request before the kitchen starts it
 * (update round 2, task A2). No I/O here, so every rule is unit-testable and
 * the service re-runs the same functions inside its transaction on fresh,
 * row-locked data.
 *
 * STATE RULES (the kitchen "starts" an order when it ACCEPTS it: accepting moves
 * every line to PREPARING, see OrderService.transitionRequest):
 *
 *   status        editable  why
 *   DRAFT         yes       not yet visible to the kitchen (not flagged 'edited')
 *   SENT          yes       the kitchen has not acknowledged it (flagged 'edited')
 *   ACCEPTED+     no        KITCHEN_STARTED (ACCEPTED, PREPARING, READY)
 *   SERVED/CLOSED no        ORDER_SERVED
 *   CANCELLED     no        ORDER_CANCELLED
 *
 * Extra guards: a SENT request with ANY non-cancelled line past PENDING is
 * KITCHEN_STARTED too (a partial accept leaves the request at SENT while some
 * lines are already PREPARING); the guest session must be OPEN; and once an
 * invoice exists for the session (not VOIDED) the lines are frozen into the bill.
 */

/** Machine-readable `details.reason` of an ORDER_EDIT_LOCKED error. */
export type EditLockReason =
  | 'KITCHEN_STARTED'
  | 'ORDER_SERVED'
  | 'ORDER_CANCELLED'
  | 'SESSION_NOT_OPEN'
  | 'INVOICE_EXISTS';

/** Order cannot be edited (any more). HTTP 409, stable code for clients. */
export class OrderEditLockedError extends DomainError {
  readonly code = 'ORDER_EDIT_LOCKED';
  readonly httpStatus = 409;
}

const LOCK_MESSAGES: Record<EditLockReason, string> = {
  KITCHEN_STARTED:
    'The kitchen has already started this order, so it can no longer be edited. Cancel the items that are still waiting or add a new round instead.',
  ORDER_SERVED: 'This order has already been served, so it can no longer be edited.',
  ORDER_CANCELLED: 'This order was cancelled, so it can no longer be edited.',
  SESSION_NOT_OPEN: 'The table session is closed, so this order can no longer be edited.',
  INVOICE_EXISTS:
    'A bill has already been generated for this table. Void the bill first if the order really has to change.',
};

export function lockMessage(reason: EditLockReason): string {
  return LOCK_MESSAGES[reason];
}

export interface EditableLine {
  id: string;
  catalogItemId: string | null;
  variantId: string | null;
  itemNameSnapshot: string;
  variantNameSnapshot: string | null;
  unitPriceMinorUnits: number;
  quantity: number;
  notes: string | null;
  kitchenNote: string | null;
  status: ServiceLineStatus;
  modifiers: { modifierOptionId: string | null; optionNameSnapshot: string }[];
}

export interface EditableRequest {
  status: ServiceRequestStatus;
  lines: Pick<EditableLine, 'status'>[];
}

export interface EditContext {
  sessionOpen: boolean;
  invoiceExists: boolean;
}

/** Why the order cannot be edited right now, or null when it can. First failing rule wins. */
export function editLockReason(req: EditableRequest, ctx: EditContext): EditLockReason | null {
  switch (req.status) {
    case ServiceRequestStatus.CANCELLED:
      return 'ORDER_CANCELLED';
    case ServiceRequestStatus.SERVED:
    case ServiceRequestStatus.CLOSED:
      return 'ORDER_SERVED';
    case ServiceRequestStatus.ACCEPTED:
    case ServiceRequestStatus.PREPARING:
    case ServiceRequestStatus.READY:
      return 'KITCHEN_STARTED';
    default:
      break; // DRAFT, SENT
  }
  if (req.lines.some((l) => l.status !== ServiceLineStatus.PENDING && l.status !== ServiceLineStatus.CANCELLED)) {
    return 'KITCHEN_STARTED';
  }
  if (!ctx.sessionOpen) return 'SESSION_NOT_OPEN';
  if (ctx.invoiceExists) return 'INVOICE_EXISTS';
  return null;
}

export function assertEditable(req: EditableRequest, ctx: EditContext, details: Record<string, unknown> = {}): void {
  const reason = editLockReason(req, ctx);
  if (reason) throw new OrderEditLockedError(lockMessage(reason), { reason, status: req.status, ...details });
}

// ─── Planning ────────────────────────────────────────────────────────────────

export interface LineInput {
  catalogItemId: string;
  variantId?: string;
  quantity: number;
  notes?: string;
  kitchenNote?: string;
  modifiers: { modifierOptionId: string }[];
}

export type PlannedOp =
  | { kind: 'add'; opIndex: number; input: LineInput }
  | {
      kind: 'update';
      opIndex: number;
      lineId: string;
      quantity?: number;
      notes?: string | null;
      kitchenNote?: string | null;
    }
  | { kind: 'reconfigure'; opIndex: number; lineId: string; input: LineInput }
  | { kind: 'remove'; opIndex: number; lineId: string };

export interface EditPlan {
  ops: PlannedOp[];
  /** Ops that need a fresh catalog snapshot (add + reconfigure), keyed by their original op index. */
  needsSnapshot: { opIndex: number; input: LineInput }[];
  /** Active (non-cancelled) line count after the edit. */
  activeAfter: number;
}

const clean = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

const sameSet = (a: string[], b: string[]): boolean => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

/**
 * Turns the client's ops into a normalised plan against the CURRENT lines.
 * Throws ValidationError / NotFoundError for malformed edits; returns an empty
 * `ops` list when nothing would change (the service answers NO_CHANGES).
 */
export function planEdit(lines: EditableLine[], ops: EditOp[]): EditPlan {
  const byId = new Map(lines.map((l) => [l.id, l]));
  const touched = new Set<string>();
  const planned: PlannedOp[] = [];
  const needsSnapshot: EditPlan['needsSnapshot'] = [];
  let activeAfter = lines.filter((l) => l.status !== ServiceLineStatus.CANCELLED).length;

  const target = (lineId: string, opIndex: number): EditableLine => {
    const line = byId.get(lineId);
    if (!line || line.status === ServiceLineStatus.CANCELLED) {
      throw new NotFoundError('Service request line not found (or already removed)', { lineId, opIndex });
    }
    if (touched.has(lineId)) {
      throw new ValidationError('A line can be changed only once per edit', { reason: 'LINE_TOUCHED_TWICE', lineId, opIndex });
    }
    touched.add(lineId);
    return line;
  };

  ops.forEach((op, opIndex) => {
    if (op.op === 'add') {
      const input: LineInput = { ...op.line, modifiers: op.line.modifiers ?? [] };
      planned.push({ kind: 'add', opIndex, input });
      needsSnapshot.push({ opIndex, input });
      activeAfter += 1;
      return;
    }
    if (op.op === 'remove') {
      target(op.lineId, opIndex);
      planned.push({ kind: 'remove', opIndex, lineId: op.lineId });
      activeAfter -= 1;
      return;
    }

    // update
    const line = target(op.lineId, opIndex);
    const quantity = op.quantity ?? line.quantity;
    const notes = op.notes === undefined ? clean(line.notes) : clean(op.notes);
    const kitchenNote = op.kitchenNote === undefined ? clean(line.kitchenNote) : clean(op.kitchenNote);
    const wantsConfig = op.variantId !== undefined || op.modifiers !== undefined;

    if (wantsConfig) {
      const currentOptionIds = line.modifiers.map((m) => m.modifierOptionId).filter((x): x is string => !!x);
      const variantId = op.variantId === undefined ? line.variantId : op.variantId;
      const optionIds = op.modifiers === undefined ? currentOptionIds : op.modifiers.map((m) => m.modifierOptionId);
      const configChanged = variantId !== line.variantId || !sameSet(optionIds, currentOptionIds);
      if (configChanged) {
        if (!line.catalogItemId) {
          throw new ValidationError('The menu item of this line no longer exists, so its options cannot be changed', {
            reason: 'ITEM_REMOVED',
            lineId: line.id,
            opIndex,
          });
        }
        const input: LineInput = {
          catalogItemId: line.catalogItemId,
          ...(variantId ? { variantId } : {}),
          quantity,
          ...(notes ? { notes } : {}),
          ...(kitchenNote ? { kitchenNote } : {}),
          modifiers: optionIds.map((modifierOptionId) => ({ modifierOptionId })),
        };
        planned.push({ kind: 'reconfigure', opIndex, lineId: line.id, input });
        needsSnapshot.push({ opIndex, input });
        return; // one line cancelled, one added: active count unchanged
      }
      // same configuration: fall through to a plain quantity / note update
    }

    const changed: Extract<PlannedOp, { kind: 'update' }> = { kind: 'update', opIndex, lineId: line.id };
    if (quantity !== line.quantity) changed.quantity = quantity;
    if (notes !== clean(line.notes)) changed.notes = notes;
    if (kitchenNote !== clean(line.kitchenNote)) changed.kitchenNote = kitchenNote;
    if (changed.quantity !== undefined || changed.notes !== undefined || changed.kitchenNote !== undefined) {
      planned.push(changed);
    }
  });

  if (planned.length > 0 && activeAfter < 1) {
    throw new ValidationError('An order must keep at least one item. Cancel the whole order instead.', {
      reason: 'EMPTY_ORDER',
    });
  }
  return { ops: planned, needsSnapshot, activeAfter };
}

/** Sum of unit price x quantity over non-cancelled lines (integer minor units). */
export function activeTotal(lines: { status: ServiceLineStatus; unitPriceMinorUnits: number; quantity: number }[]): number {
  return lines
    .filter((l) => l.status !== ServiceLineStatus.CANCELLED)
    .reduce((s, l) => s + l.unitPriceMinorUnits * l.quantity, 0);
}
