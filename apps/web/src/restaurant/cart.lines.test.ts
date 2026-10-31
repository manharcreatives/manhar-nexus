import { describe, expect, it } from 'vitest';
import type { CatalogItem } from './api';
import { MAX_NOTE, MAX_QTY, addLine, adjustLine, buildLine, cartCount, cartTotal, lineDetail, lineSubtotal, removeLine, setLineNote, setLineQuantity, toApiLines } from './cart';

const plain = (id: string, name: string, price: number): CatalogItem => ({
  id, name, sku: '', basePriceMinorUnits: price, categoryId: null, taxCategoryId: null, isActive: true, type: 'ITEM', variants: [], modifierGroups: [],
});
const none = { variantId: null, options: {} };
const dosa = plain('d', 'Dosa', 14000);
const tea = plain('t', 'Tea', 3000);

describe('cart line edits used by the order pane', () => {
  it('removeLine drops exactly one line and leaves the total exact', () => {
    let cart = addLine([], buildLine(dosa, [], none, '', 2));
    cart = addLine(cart, buildLine(tea, [], none, '', 1));
    expect(cartTotal(cart)).toBe(31000);
    const key = cart[0]?.key ?? '';
    cart = removeLine(cart, key);
    expect(cart.map((l) => l.itemName)).toEqual(['Tea']);
    expect(cartTotal(cart)).toBe(3000);
    expect(removeLine(cart, 'missing')).toEqual(cart);
  });

  it('setLineQuantity clamps to 1..MAX_QTY and never deletes (that is removeLine)', () => {
    const cart = addLine([], buildLine(dosa, [], none, '', 2));
    const key = cart[0]?.key ?? '';
    expect(setLineQuantity(cart, key, 0)[0]?.quantity).toBe(1);
    expect(setLineQuantity(cart, key, -5)[0]?.quantity).toBe(1);
    expect(setLineQuantity(cart, key, 5000)[0]?.quantity).toBe(MAX_QTY);
    expect(setLineQuantity(cart, key, 7)[0]?.quantity).toBe(7);
  });

  it('stepping a quantity down from 1 removes the line (stepper and trash agree)', () => {
    const cart = addLine([], buildLine(dosa, [], none, '', 1));
    expect(adjustLine(cart, cart[0]?.key ?? '', -1)).toEqual([]);
  });

  it('setLineNote recomputes the identity key and trims', () => {
    const cart = addLine([], buildLine(dosa, [], none, '', 1));
    const before = cart[0]?.key ?? '';
    const next = setLineNote(cart, before, '  no onion ');
    expect(next[0]?.note).toBe('no onion');
    expect(next[0]?.key).not.toBe(before);
    expect(toApiLines(next)[0]?.notes).toBe('no onion');
    expect(setLineNote(next, next[0]?.key ?? '', '')[0]?.key).toBe(before);
  });

  it('setLineNote merges into an identical line instead of leaving a duplicate', () => {
    let cart = addLine([], buildLine(dosa, [], none, '', 2));
    cart = addLine(cart, buildLine(dosa, [], none, 'spicy', 1));
    expect(cart).toHaveLength(2);
    const noted = cart.find((l) => l.note === 'spicy');
    const merged = setLineNote(cart, noted?.key ?? '', '');
    expect(merged).toHaveLength(1);
    expect(merged[0]?.quantity).toBe(3);
    expect(cartCount(merged)).toBe(3);
  });

  it('setLineNote caps the note at the API limit and ignores unknown keys', () => {
    const cart = addLine([], buildLine(dosa, [], none, '', 1));
    const long = setLineNote(cart, cart[0]?.key ?? '', 'x'.repeat(MAX_NOTE + 50));
    expect(long[0]?.note).toHaveLength(MAX_NOTE);
    expect(setLineNote(cart, 'nope', 'hi')).toBe(cart);
  });

  it('lineDetail and lineSubtotal feed the second row and the line total', () => {
    expect(lineDetail({ variantName: 'Half', optionNames: ['Cheese', 'Butter'] })).toBe('Half, Cheese, Butter');
    expect(lineDetail({ variantName: null, optionNames: [] })).toBe('');
    expect(lineSubtotal({ unitPriceMinorUnits: 12345, quantity: 3 })).toBe(37035);
  });
});
