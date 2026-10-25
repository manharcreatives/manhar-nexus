import { describe, expect, it } from 'vitest';
import type { CatalogItem, ModifierGroup } from './api';
import {
  addLine,
  adjustLine,
  buildLine,
  cartCount,
  cartTotal,
  defaultSelection,
  groupBounds,
  lineKey,
  toApiLines,
  toggleOption,
  unitPrice,
  validateSelection,
} from './cart';

const item: CatalogItem = {
  id: 'i1',
  name: 'Paneer Tikka',
  sku: '',
  basePriceMinorUnits: 28000,
  categoryId: 'c',
  taxCategoryId: null,
  isActive: true,
  type: 'ITEM',
  variants: [
    { id: 'vh', name: 'Half', priceAdjMinorUnits: -8000, isAvailable: true, sortOrder: 0 },
    { id: 'vf', name: 'Full', priceAdjMinorUnits: 0, isAvailable: true, sortOrder: 1 },
  ],
  modifierGroups: [],
};
const opt = (id: string, adj = 0, extra = {}) => ({ id, name: id, priceAdjMinorUnits: adj, isDefault: false, isAvailable: true, sortOrder: 0, ...extra });
const spice: ModifierGroup = {
  id: 'g1', name: 'Spice', selectionType: 'SINGLE', isRequired: true, minSelections: 1, maxSelections: 1, sortOrder: 0, isActive: true,
  options: [opt('mild'), opt('hot', 0, { isDefault: true })],
};
const extras: ModifierGroup = {
  id: 'g2', name: 'Extras', selectionType: 'MULTIPLE', isRequired: false, minSelections: 0, maxSelections: 2, sortOrder: 1, isActive: true,
  options: [opt('cheese', 3000), opt('butter', 2000), opt('onion', 0)],
};
const groups = [spice, extras];

describe('cart helpers', () => {
  it('prices variant and options in integer minor units', () => {
    expect(unitPrice(item, groups, { variantId: 'vh', options: { g2: ['cheese', 'butter'] } })).toBe(28000 - 8000 + 5000);
  });

  it('keys identical configurations equally regardless of option order, differing by note', () => {
    expect(lineKey('i1', 'vf', ['b', 'a'], ' hi ')).toBe(lineKey('i1', 'vf', ['a', 'b'], 'hi'));
    expect(lineKey('i1', 'vf', [], 'a')).not.toBe(lineKey('i1', 'vf', [], 'b'));
    expect(lineKey('i1', 'vf', [], '')).not.toBe(lineKey('i1', 'vh', [], ''));
  });

  it('merges identical lines and removes at zero', () => {
    const sel = { variantId: 'vf', options: { g1: ['mild'], g2: ['cheese'] } };
    let cart = addLine([], buildLine(item, groups, sel, '', 1));
    cart = addLine(cart, buildLine(item, groups, sel, '', 2));
    cart = addLine(cart, buildLine(item, groups, { ...sel, options: { g1: ['hot'], g2: [] } }, '', 1));
    expect(cart).toHaveLength(2);
    expect(cartCount(cart)).toBe(4);
    expect(cartTotal(cart)).toBe(3 * 31000 + 28000);
    cart = adjustLine(cart, cart[1].key, -1);
    expect(cart).toHaveLength(1);
  });

  it('validates required variant and group min/max', () => {
    expect(validateSelection(item, groups, { variantId: null, options: {} }).map((i) => i.code)).toEqual(['variantRequired', 'groupMin']);
    expect(validateSelection(item, groups, { variantId: 'vf', options: { g1: ['mild'] } })).toEqual([]);
    expect(validateSelection(item, groups, { variantId: 'vf', options: { g1: ['mild'], g2: ['cheese', 'butter', 'onion'] } })[0]).toMatchObject({ code: 'groupMax', max: 2 });
  });

  it('computes bounds and toggles honouring them', () => {
    expect(groupBounds(spice)).toEqual({ min: 1, max: 1 });
    expect(groupBounds(extras)).toEqual({ min: 0, max: 2 });
    expect(toggleOption(spice, ['mild'], 'hot')).toEqual(['hot']);
    expect(toggleOption(spice, ['mild'], 'mild')).toEqual(['mild']);
    expect(toggleOption(extras, ['cheese', 'butter'], 'onion')).toEqual(['cheese', 'butter']);
    expect(toggleOption(extras, ['cheese'], 'cheese')).toEqual([]);
  });

  it('defaults to first variant and default options', () => {
    expect(defaultSelection(item, groups)).toEqual({ variantId: 'vh', options: { g1: ['hot'], g2: [] } });
  });

  it('emits the order DTO line shape', () => {
    const sel = { variantId: 'vf', options: { g1: ['mild'], g2: ['cheese'] } };
    const lines = toApiLines([buildLine(item, groups, sel, ' no onion ', 2), buildLine({ ...item, variants: [] }, [], { variantId: null, options: {} }, '', 1)]);
    expect(lines[0]).toEqual({
      catalogItemId: 'i1',
      variantId: 'vf',
      quantity: 2,
      notes: 'no onion',
      modifiers: [{ modifierOptionId: 'cheese' }, { modifierOptionId: 'mild' }],
    });
    expect(lines[1]).toEqual({ catalogItemId: 'i1', quantity: 1, modifiers: [] });
  });
});
