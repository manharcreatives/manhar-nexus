import type { ServiceRequest, ServiceRequestLine } from '../api';
import { type CartLine, MAX_NOTE, MAX_QTY, lineDetail } from '../cart';
import { type LineChip, chipForExisting } from './lineState';
import type { EditOpDto } from './orderEditApi';

/**
 * Pure state for the edit-order dialog. The draft is a working copy of the order's active lines plus the lines
 * staff add; nothing is sent until they press Save, and then only the DIFFERENCE goes out as append-only ops
 * (add / update / remove) against the version the screen was built from.
 */

export interface DraftLine {
  /** Stable React key: the server line id for saved lines, `new-<n>` for lines added in this edit. */
  id: string;
  /** Server line id; null for a line that does not exist yet. */
  lineId: string | null;
  /** Menu item behind the line (for the "n in order" badge in the menu zone). */
  itemId: string | null;
  /** Server mark: this line was added/changed by an earlier edit while the kitchen could see the order. */
  editKind: 'ADDED' | 'CHANGED' | null;
  itemName: string;
  detail: string;
  unitPriceMinorUnits: number;
  quantity: number;
  note: string;
  /** Saved line marked for removal (can be restored until Save). */
  removed: boolean;
  chip: LineChip;
  /** Values as the server has them, to diff against. Null for new lines. */
  base: { quantity: number; note: string } | null;
  /** How a new line is sent. */
  cart: CartLine | null;
}

export interface EditDraft {
  lines: DraftLine[];
  orderNote: string;
  baseOrderNote: string;
  seq: number;
}

const clean = (s: string | null | undefined): string => (s ?? '').trim();

export function fromServerLine(order: Pick<ServiceRequest, 'status'>, l: ServiceRequestLine): DraftLine {
  const detail = [l.variantNameSnapshot, ...l.modifiers.map((m) => m.optionNameSnapshot)].filter(Boolean).join(', ');
  return {
    id: l.id,
    lineId: l.id,
    itemId: l.catalogItemId ?? null,
    editKind: l.editKind ?? null,
    itemName: l.itemNameSnapshot,
    detail,
    unitPriceMinorUnits: l.unitPriceMinorUnits, // server snapshot already includes variant and option adjustments
    quantity: l.quantity,
    note: clean(l.notes),
    removed: false,
    chip: chipForExisting(order.status, l.status),
    base: { quantity: l.quantity, note: clean(l.notes) },
    cart: null,
  };
}

export function fromOrder(order: ServiceRequest): EditDraft {
  return {
    lines: order.lines.filter((l) => l.status !== 'CANCELLED').map((l) => fromServerLine(order, l)),
    orderNote: clean(order.notes),
    baseOrderNote: clean(order.notes),
    seq: 0,
  };
}

/** A configured item from the menu becomes a NEW line; identical new lines collapse (quantities add). */
export function addCartLine(draft: EditDraft, line: CartLine): EditDraft {
  const same = draft.lines.find((l) => l.cart?.key === line.key);
  if (same) {
    return {
      ...draft,
      lines: draft.lines.map((l) => (l === same ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + line.quantity) } : l)),
    };
  }
  const seq = draft.seq + 1;
  const added: DraftLine = {
    id: `new-${seq}`,
    lineId: null,
    itemId: line.itemId,
    editKind: null,
    itemName: line.itemName,
    detail: lineDetail(line),
    unitPriceMinorUnits: line.unitPriceMinorUnits,
    quantity: line.quantity,
    note: line.note,
    removed: false,
    chip: 'new',
    base: null,
    cart: line,
  };
  return { ...draft, seq, lines: [...draft.lines, added] };
}

/** Total quantity of a menu item across every kept line (saved and new), for the badge in the menu zone. */
export function qtyForItem(draft: EditDraft, itemId: string): number {
  return draft.lines.filter((l) => !l.removed && l.itemId === itemId).reduce((n, l) => n + l.quantity, 0);
}

const mapLine = (d: EditDraft, id: string, f: (l: DraftLine) => DraftLine | null): EditDraft => ({
  ...d,
  lines: d.lines.flatMap((l) => (l.id === id ? (f(l) ? [f(l) as DraftLine] : []) : [l])),
});

/**
 * Steps a quantity. Going below 1 removes a new line outright and marks a saved line for removal
 * (reversible with restoreLine), so a stray tap on "minus" never loses anything for good.
 */
export function adjustQuantity(d: EditDraft, id: string, delta: number): EditDraft {
  return mapLine(d, id, (l) => {
    const q = l.quantity + delta;
    if (q >= 1) return { ...l, quantity: Math.min(MAX_QTY, q) };
    return l.lineId ? { ...l, removed: true, chip: 'removing' } : null;
  });
}

export function removeLine(d: EditDraft, id: string): EditDraft {
  return mapLine(d, id, (l) => (l.lineId ? { ...l, removed: true, chip: 'removing' } : null));
}

export function restoreLine(d: EditDraft, id: string, order: Pick<ServiceRequest, 'status' | 'lines'>): EditDraft {
  return mapLine(d, id, (l) => {
    const server = order.lines.find((x) => x.id === l.lineId);
    return { ...l, removed: false, chip: server ? chipForExisting(order.status, server.status) : 'sent' };
  });
}

export function setNote(d: EditDraft, id: string, note: string): EditDraft {
  return mapLine(d, id, (l) => ({ ...l, note: note.slice(0, MAX_NOTE) }));
}

export function setOrderNote(d: EditDraft, note: string): EditDraft {
  return { ...d, orderNote: note.slice(0, 500) };
}

export const keptLines = (d: EditDraft): DraftLine[] => d.lines.filter((l) => !l.removed);
export const keptCount = (d: EditDraft): number => keptLines(d).length;
export const draftTotal = (d: EditDraft): number => keptLines(d).reduce((s, l) => s + l.unitPriceMinorUnits * l.quantity, 0);
export const draftUnits = (d: EditDraft): number => keptLines(d).reduce((s, l) => s + l.quantity, 0);

/** An order must keep at least one item: emptying it is a cancellation, not an edit. */
export function wouldEmpty(d: EditDraft): boolean {
  return keptCount(d) === 0;
}

function lineChanged(l: DraftLine): boolean {
  if (!l.lineId) return true; // a new line is itself a change
  if (l.removed) return true;
  return l.base !== null && (l.quantity !== l.base.quantity || clean(l.note) !== l.base.note);
}

export function orderNoteChanged(d: EditDraft): boolean {
  return clean(d.orderNote) !== d.baseOrderNote;
}

export function hasChanges(d: EditDraft): boolean {
  return orderNoteChanged(d) || d.lines.some(lineChanged);
}

/** How many lines differ from the saved order (for the "3 changes" hint). */
export function changeCount(d: EditDraft): number {
  return d.lines.filter(lineChanged).length + (orderNoteChanged(d) ? 1 : 0);
}

/** The append-only ops that turn the saved order into the draft. Unchanged lines produce nothing. */
export function toOps(d: EditDraft): EditOpDto[] {
  const ops: EditOpDto[] = [];
  for (const l of d.lines) {
    if (!l.lineId) {
      if (l.removed || !l.cart) continue;
      const note = clean(l.note);
      ops.push({
        op: 'add',
        line: {
          catalogItemId: l.cart.itemId,
          ...(l.cart.variantId ? { variantId: l.cart.variantId } : {}),
          quantity: l.quantity,
          ...(note ? { notes: note } : {}),
          modifiers: l.cart.optionIds.map((modifierOptionId) => ({ modifierOptionId })),
        },
      });
      continue;
    }
    if (l.removed) {
      ops.push({ op: 'remove', lineId: l.lineId });
      continue;
    }
    if (!l.base) continue;
    const qtyChanged = l.quantity !== l.base.quantity;
    const noteChanged = clean(l.note) !== l.base.note;
    if (!qtyChanged && !noteChanged) continue;
    ops.push({
      op: 'update',
      lineId: l.lineId,
      ...(qtyChanged ? { quantity: l.quantity } : {}),
      ...(noteChanged ? { notes: clean(l.note) || null } : {}),
    });
  }
  return ops;
}

/** Order-level note to send: undefined (leave alone) unless it changed; null clears it. */
export function noteForSave(d: EditDraft): string | null | undefined {
  return orderNoteChanged(d) ? clean(d.orderNote) || null : undefined;
}

/** Stable text for "is this the same edit as the last attempt" (decides whether the idempotency key is reused). */
export function signature(version: number, d: EditDraft, reason: string): string {
  return JSON.stringify([version, toOps(d), noteForSave(d) ?? null, orderNoteChanged(d), clean(reason)]);
}

/**
 * The order changed under an open edit (someone else saved, or the kitchen/realtime refresh). Rebuilds the draft
 * on the fresh order and keeps what the user did on top of it: a field they changed relative to the OLD base keeps
 * their value, a field they did not touch takes the fresh server value. Saved lines that no longer exist
 * (removed by the other edit) are dropped and counted; lines added in this edit always survive.
 */
export function rebase(old: EditDraft, fresh: ServiceRequest): { draft: EditDraft; dropped: number } {
  const next = fromOrder(fresh);
  const byId = new Map(next.lines.map((l) => [l.id, l]));
  let dropped = 0;
  const merged: DraftLine[] = [];
  const seen = new Set<string>();
  for (const o of old.lines) {
    if (!o.lineId) {
      merged.push(o);
      continue;
    }
    const f = byId.get(o.lineId);
    if (!f) {
      if (lineChanged(o)) dropped += 1;
      continue;
    }
    seen.add(f.id);
    const qtyTouched = o.base !== null && o.quantity !== o.base.quantity;
    const noteTouched = o.base !== null && clean(o.note) !== o.base.note;
    merged.push({
      ...f,
      quantity: qtyTouched ? o.quantity : f.quantity,
      note: noteTouched ? o.note : f.note,
      removed: o.removed,
      chip: o.removed ? 'removing' : f.chip,
    });
  }
  // Lines another editor added in the meantime appear after the ones we already knew.
  const extra = next.lines.filter((l) => !seen.has(l.id));
  const lines = [...merged.filter((l) => l.lineId), ...extra, ...merged.filter((l) => !l.lineId)];
  const orderNote = clean(old.orderNote) !== old.baseOrderNote ? old.orderNote : next.orderNote;
  return { draft: { lines, orderNote, baseOrderNote: next.baseOrderNote, seq: old.seq }, dropped };
}
