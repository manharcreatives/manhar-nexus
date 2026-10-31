import type { CatalogItem, CatalogVariant, ModifierGroup, ModifierOption, OrderLineInput } from './api';

/** Pure order-cart helpers: integer minor units only, no formatting here. */

export interface CartLine {
  key: string;
  itemId: string;
  itemName: string;
  variantId: string | null;
  variantName: string | null;
  optionIds: string[];
  optionNames: string[];
  note: string;
  quantity: number;
  /** Per-unit price (base + variant + options) as shown when the line was added. */
  unitPriceMinorUnits: number;
}

export interface Selection {
  variantId: string | null;
  /** Selected option ids per modifier group id. */
  options: Record<string, string[]>;
}

export type SelectionIssue =
  | { code: 'variantRequired' }
  | { code: 'groupMin'; groupId: string; groupName: string; min: number }
  | { code: 'groupMax'; groupId: string; groupName: string; max: number };

export const MAX_NOTE = 300;
export const MAX_QTY = 999;

export function itemGroups(item: CatalogItem, groupsById: ReadonlyMap<string, ModifierGroup>): ModifierGroup[] {
  return [...(item.modifierGroups ?? [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((l) => groupsById.get(l.modifierGroupId))
    .filter((g): g is ModifierGroup => !!g && g.isActive);
}

/** True when an item has variants, or any modifier group link (even one not yet loaded). */
export function needsConfiguration(item: CatalogItem): boolean {
  return (item.variants?.length ?? 0) > 0 || (item.modifierGroups?.length ?? 0) > 0;
}

export function availableVariants(item: CatalogItem): CatalogVariant[] {
  return [...(item.variants ?? [])].filter((v) => v.isAvailable).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function availableOptions(group: ModifierGroup): ModifierOption[] {
  return [...group.options].filter((o) => o.isAvailable).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Effective min/max picks for a group. Required implies at least one; SINGLE caps at one. */
export function groupBounds(group: ModifierGroup): { min: number; max: number } {
  const count = availableOptions(group).length;
  const min = Math.min(Math.max(group.minSelections, group.isRequired ? 1 : 0), count);
  const cap = group.selectionType === 'SINGLE' ? 1 : (group.maxSelections ?? count);
  const max = Math.max(min, Math.min(cap, count));
  return { min, max };
}

export function defaultSelection(item: CatalogItem, groups: ModifierGroup[]): Selection {
  const variants = availableVariants(item);
  const options: Record<string, string[]> = {};
  for (const g of groups) {
    const { max } = groupBounds(g);
    options[g.id] = availableOptions(g)
      .filter((o) => o.isDefault)
      .slice(0, max)
      .map((o) => o.id);
  }
  return { variantId: variants[0]?.id ?? null, options };
}

/** Toggles an option honouring SINGLE (replace) vs MULTIPLE (add/remove, no-op beyond max). */
export function toggleOption(group: ModifierGroup, current: string[], optionId: string): string[] {
  const { max } = groupBounds(group);
  if (group.selectionType === 'SINGLE') {
    if (current.includes(optionId)) return group.isRequired ? current : [];
    return [optionId];
  }
  if (current.includes(optionId)) return current.filter((id) => id !== optionId);
  if (current.length >= max) return current;
  return [...current, optionId];
}

export function validateSelection(item: CatalogItem, groups: ModifierGroup[], sel: Selection): SelectionIssue[] {
  const issues: SelectionIssue[] = [];
  const variants = availableVariants(item);
  if (variants.length > 0 && !variants.some((v) => v.id === sel.variantId)) issues.push({ code: 'variantRequired' });
  for (const g of groups) {
    const { min, max } = groupBounds(g);
    const n = (sel.options[g.id] ?? []).length;
    if (n < min) issues.push({ code: 'groupMin', groupId: g.id, groupName: g.name, min });
    if (n > max) issues.push({ code: 'groupMax', groupId: g.id, groupName: g.name, max });
  }
  return issues;
}

export function selectedOptions(groups: ModifierGroup[], sel: Selection): ModifierOption[] {
  const out: ModifierOption[] = [];
  for (const g of groups) {
    const picked = new Set(sel.options[g.id] ?? []);
    for (const o of availableOptions(g)) if (picked.has(o.id)) out.push(o);
  }
  return out;
}

export function unitPrice(item: CatalogItem, groups: ModifierGroup[], sel: Selection): number {
  const variant = (item.variants ?? []).find((v) => v.id === sel.variantId);
  const mods = selectedOptions(groups, sel).reduce((s, o) => s + o.priceAdjMinorUnits, 0);
  return item.basePriceMinorUnits + (variant?.priceAdjMinorUnits ?? 0) + mods;
}

/** Identical item + variant + option set + note collapse into one line. */
export function lineKey(itemId: string, variantId: string | null, optionIds: string[], note: string): string {
  return JSON.stringify([itemId, variantId, [...optionIds].sort(), note.trim()]);
}

export function buildLine(item: CatalogItem, groups: ModifierGroup[], sel: Selection, note: string, quantity: number): CartLine {
  const variant = (item.variants ?? []).find((v) => v.id === sel.variantId) ?? null;
  const opts = selectedOptions(groups, sel);
  const sorted = [...opts].sort((a, b) => (a.id < b.id ? -1 : 1));
  const cleanNote = note.trim();
  return {
    key: lineKey(item.id, variant?.id ?? null, sorted.map((o) => o.id), cleanNote),
    itemId: item.id,
    itemName: item.name,
    variantId: variant?.id ?? null,
    variantName: variant?.name ?? null,
    optionIds: sorted.map((o) => o.id),
    optionNames: opts.map((o) => o.name),
    note: cleanNote,
    quantity,
    unitPriceMinorUnits: unitPrice(item, groups, sel),
  };
}

export function addLine(cart: CartLine[], line: CartLine): CartLine[] {
  const i = cart.findIndex((l) => l.key === line.key);
  if (i < 0) return [...cart, line];
  return cart.map((l, idx) => (idx === i ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + line.quantity) } : l));
}

/** Changes a line quantity; a result of 0 or less removes the line. */
export function adjustLine(cart: CartLine[], key: string, delta: number): CartLine[] {
  return cart
    .map((l) => (l.key === key ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + delta) } : l))
    .filter((l) => l.quantity > 0);
}

export function cartCount(cart: CartLine[]): number {
  return cart.reduce((s, l) => s + l.quantity, 0);
}

export function cartTotal(cart: CartLine[]): number {
  return cart.reduce((s, l) => s + l.unitPriceMinorUnits * l.quantity, 0);
}

/** Exactly the order DTO line shape (variantId, notes, modifiers[].modifierOptionId). */
export function toApiLines(cart: CartLine[]): OrderLineInput[] {
  return cart.map((l) => ({
    catalogItemId: l.itemId,
    ...(l.variantId ? { variantId: l.variantId } : {}),
    quantity: l.quantity,
    ...(l.note ? { notes: l.note } : {}),
    modifiers: l.optionIds.map((modifierOptionId) => ({ modifierOptionId })),
  }));
}

// ── Line-level edits used by the order panes (builder and edit dialog) ──────────

/** "Half, Extra cheese": variant and option names of a line, for the second row of a line. */
export function lineDetail(line: Pick<CartLine, 'variantName' | 'optionNames'>): string {
  return [line.variantName, ...line.optionNames].filter(Boolean).join(', ');
}

export function lineSubtotal(line: Pick<CartLine, 'unitPriceMinorUnits' | 'quantity'>): number {
  return line.unitPriceMinorUnits * line.quantity;
}

/** Drops one line outright (the trash button; a stepper at 1 does the same through adjustLine). */
export function removeLine(cart: CartLine[], key: string): CartLine[] {
  return cart.filter((l) => l.key !== key);
}

/** Sets an exact quantity (clamped to 1..MAX_QTY). Use removeLine to delete. */
export function setLineQuantity(cart: CartLine[], key: string, quantity: number): CartLine[] {
  const q = Math.max(1, Math.min(MAX_QTY, Math.trunc(quantity) || 1));
  return cart.map((l) => (l.key === key ? { ...l, quantity: q } : l));
}

/**
 * Changes a line's note. The note is part of the line identity, so the key is recomputed; when the new key
 * equals another line's, the two collapse into one (quantities add), exactly as if it had been added that way.
 */
export function setLineNote(cart: CartLine[], key: string, note: string): CartLine[] {
  const target = cart.find((l) => l.key === key);
  if (!target) return cart;
  const clean = note.trim().slice(0, MAX_NOTE);
  if (clean === target.note) return cart;
  const next: CartLine = { ...target, note: clean, key: lineKey(target.itemId, target.variantId, target.optionIds, clean) };
  const rest = cart.filter((l) => l.key !== key);
  const i = rest.findIndex((l) => l.key === next.key);
  if (i < 0) return cart.map((l) => (l.key === key ? next : l));
  return rest.map((l, idx) => (idx === i ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + next.quantity) } : l));
}
