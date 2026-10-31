import type { AddOnGroup, MenuItem, OrderLineInput, PlaceOrderBody } from './types';

/** Soft client caps (the server enforces its own, tighter ones and always recomputes prices). */
export const MAX_QTY_PER_LINE = 20;
export const MAX_LINES = 30;
export const MAX_NOTE = 140;

export interface CartLine {
  key: string;
  itemId: string;
  variantId?: string;
  addOnOptionIds: string[];
  qty: number;
  note?: string;
}

export interface CartState { lines: CartLine[]; note: string }
export const EMPTY_CART: CartState = { lines: [], note: '' };

export function lineKey(itemId: string, variantId: string | undefined, addOnOptionIds: string[], note?: string): string {
  return [itemId, variantId ?? '', [...addOnOptionIds].sort().join('+'), (note ?? '').trim().toLowerCase()].join('|');
}

/** The variant that is pre-selected when an item has variants: the first one listed. */
export function defaultVariantId(item: MenuItem): string | undefined {
  return item.variants[0]?.id;
}

/** Unit price in paise: a variant carries its own absolute price; add-ons are added on top. */
export function unitPriceMinor(item: MenuItem, variantId: string | undefined, addOnOptionIds: string[]): number {
  const variant = variantId ? item.variants.find((v) => v.id === variantId) : undefined;
  let total = variant ? variant.priceMinor : item.priceMinor;
  if (addOnOptionIds.length) {
    const wanted = new Set(addOnOptionIds);
    for (const g of item.addOnGroups) for (const o of g.options) if (wanted.has(o.id)) total += o.priceMinor;
  }
  return total;
}

export function lineTotalMinor(item: MenuItem, line: Pick<CartLine, 'variantId' | 'addOnOptionIds' | 'qty'>): number {
  return unitPriceMinor(item, line.variantId, line.addOnOptionIds) * line.qty;
}

export interface SelectionCheck {
  ok: boolean;
  /** group id -> message for groups that fail min/max. */
  groups: Record<string, 'min' | 'max'>;
  variantMissing: boolean;
}

export function checkSelection(item: MenuItem, variantId: string | undefined, addOnOptionIds: string[]): SelectionCheck {
  const chosen = new Set(addOnOptionIds);
  const groups: Record<string, 'min' | 'max'> = {};
  for (const g of item.addOnGroups) {
    const n = g.options.filter((o) => chosen.has(o.id)).length;
    if (n < g.min) groups[g.id] = 'min';
    else if (g.max > 0 && n > g.max) groups[g.id] = 'max';
  }
  const variantMissing = item.variants.length > 0 && !item.variants.some((v) => v.id === variantId);
  return { ok: !variantMissing && Object.keys(groups).length === 0, groups, variantMissing };
}

/** Toggle an option honouring the group's max (a single-choice group swaps, a multi group stops at max). */
export function toggleOption(group: AddOnGroup, selected: string[], optionId: string): string[] {
  const inGroup = new Set(group.options.map((o) => o.id));
  const has = selected.includes(optionId);
  if (has) return selected.filter((id) => id !== optionId);
  const current = selected.filter((id) => inGroup.has(id));
  if (group.max === 1) return [...selected.filter((id) => !inGroup.has(id)), optionId];
  if (group.max > 0 && current.length >= group.max) return selected;
  return [...selected, optionId];
}

export type CartAction =
  | { type: 'add'; itemId: string; variantId?: string; addOnOptionIds: string[]; qty: number; note?: string }
  | { type: 'qty'; key: string; qty: number }
  | { type: 'note'; key: string; note: string }
  | { type: 'orderNote'; note: string }
  | { type: 'replace'; state: CartState }
  | { type: 'clear' };

const clampQty = (n: number) => Math.max(0, Math.min(MAX_QTY_PER_LINE, Math.floor(n)));

export function cartReducer(state: CartState, a: CartAction): CartState {
  switch (a.type) {
    case 'add': {
      const note = a.note?.trim().slice(0, MAX_NOTE) || undefined;
      const key = lineKey(a.itemId, a.variantId, a.addOnOptionIds, note);
      const existing = state.lines.find((l) => l.key === key);
      if (existing) {
        return { ...state, lines: state.lines.map((l) => (l.key === key ? { ...l, qty: clampQty(l.qty + a.qty) } : l)) };
      }
      if (state.lines.length >= MAX_LINES) return state;
      const line: CartLine = { key, itemId: a.itemId, variantId: a.variantId, addOnOptionIds: [...a.addOnOptionIds], qty: clampQty(a.qty), note };
      return line.qty > 0 ? { ...state, lines: [...state.lines, line] } : state;
    }
    case 'qty': {
      const qty = clampQty(a.qty);
      return { ...state, lines: qty === 0 ? state.lines.filter((l) => l.key !== a.key) : state.lines.map((l) => (l.key === a.key ? { ...l, qty } : l)) };
    }
    case 'note': {
      const target = state.lines.find((l) => l.key === a.key);
      if (!target) return state;
      const note = a.note.trim().slice(0, MAX_NOTE) || undefined;
      const key = lineKey(target.itemId, target.variantId, target.addOnOptionIds, note);
      const twin = key !== a.key ? state.lines.find((l) => l.key === key) : undefined;
      if (twin) {
        return { ...state, lines: state.lines.filter((l) => l.key !== a.key).map((l) => (l.key === key ? { ...l, qty: clampQty(l.qty + target.qty) } : l)) };
      }
      return { ...state, lines: state.lines.map((l) => (l.key === a.key ? { ...l, key, note } : l)) };
    }
    case 'orderNote':
      return { ...state, note: a.note.slice(0, 200) };
    case 'replace':
      return a.state;
    case 'clear':
      return EMPTY_CART;
  }
}

export interface Reconciled { state: CartState; removed: string[]; changed: boolean }

/** Drops lines whose item vanished, sold out, or whose variant/add-on is gone; returns the names removed. */
export function reconcileCart(state: CartState, items: MenuItem[]): Reconciled {
  const byId = new Map(items.map((i) => [i.id, i]));
  const removed: string[] = [];
  const lines: CartLine[] = [];
  for (const l of state.lines) {
    const item = byId.get(l.itemId);
    if (!item || item.soldOut) {
      removed.push(item?.name ?? 'An item');
      continue;
    }
    const allOptions = new Set(item.addOnGroups.flatMap((g) => g.options.map((o) => o.id)));
    const stillValid = (l.variantId ? item.variants.some((v) => v.id === l.variantId) : item.variants.length === 0) && l.addOnOptionIds.every((id) => allOptions.has(id)) && checkSelection(item, l.variantId, l.addOnOptionIds).ok;
    if (!stillValid) {
      removed.push(item.name);
      continue;
    }
    lines.push(l);
  }
  const changed = lines.length !== state.lines.length;
  return { state: changed ? { ...state, lines } : state, removed, changed };
}

export interface CartTotals { count: number; totalMinor: number }

export function cartTotals(state: CartState, items: Map<string, MenuItem>): CartTotals {
  let count = 0;
  let totalMinor = 0;
  for (const l of state.lines) {
    const item = items.get(l.itemId);
    if (!item) continue;
    count += l.qty;
    totalMinor += lineTotalMinor(item, l);
  }
  return { count, totalMinor };
}

export function qtyByItem(state: CartState): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of state.lines) m.set(l.itemId, (m.get(l.itemId) ?? 0) + l.qty);
  return m;
}

/** The request body. Prices are deliberately absent: the server recomputes every total. */
export function toOrderBody(state: CartState): PlaceOrderBody {
  const lines: OrderLineInput[] = state.lines.map((l) => ({
    itemId: l.itemId,
    ...(l.variantId ? { variantId: l.variantId } : {}),
    ...(l.addOnOptionIds.length ? { addOnOptionIds: l.addOnOptionIds } : {}),
    qty: l.qty,
    ...(l.note ? { note: l.note } : {}),
  }));
  const note = state.note.trim();
  return { lines, ...(note ? { note } : {}) };
}

/** Stable signature of what would be sent: the Idempotency-Key is reused only while this is unchanged. */
export function cartSignature(state: CartState): string {
  return JSON.stringify(toOrderBody(state));
}

export function newIdempotencyKey(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
