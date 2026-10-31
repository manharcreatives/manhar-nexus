import { describe, expect, it } from 'vitest';
import type { ServiceRequestStatus } from '../api';
import { buildLine } from '../cart';
import {
  addCartLine, adjustQuantity, changeCount, draftTotal, fromOrder, hasChanges, noteForSave, qtyForItem, rebase,
  removeLine, restoreLine, setNote, setOrderNote, signature, toOps, wouldEmpty,
} from './editDraft';
import { clientLockReason, showsEditButton } from './editRules';
import { chipForExisting } from './lineState';
import { item, line, makeOrder } from './testFixtures';

const none = { variantId: null, options: {} };

describe('edit draft: diffing into append-only ops', () => {
  it('starts without changes and without ops', () => {
    const d = fromOrder(makeOrder());
    expect(hasChanges(d)).toBe(false);
    expect(toOps(d)).toEqual([]);
    expect(changeCount(d)).toBe(0);
  });

  it('a quantity change becomes an update op with only the changed field', () => {
    let d = fromOrder(makeOrder());
    d = adjustQuantity(d, 'l-1', 1);
    expect(toOps(d)).toEqual([{ op: 'update', lineId: 'l-1', quantity: 3 }]);
    expect(draftTotal(d)).toBe(3 * 14000 + 28000);
  });

  it('stepping back to the original quantity cancels the change', () => {
    let d = fromOrder(makeOrder());
    d = adjustQuantity(adjustQuantity(d, 'l-1', 1), 'l-1', -1);
    expect(hasChanges(d)).toBe(false);
    expect(toOps(d)).toEqual([]);
  });

  it('notes: set, change and clear (clearing sends null)', () => {
    let d = fromOrder(makeOrder({ lines: [line('l-1', 'Dosa', 1, 100, { notes: 'less oil' }), line('l-2', 'Tea', 1, 50)] }));
    d = setNote(d, 'l-1', '');
    expect(toOps(d)).toEqual([{ op: 'update', lineId: 'l-1', notes: null }]);
    d = setNote(d, 'l-2', ' no sugar ');
    expect(toOps(d)).toEqual([
      { op: 'update', lineId: 'l-1', notes: null },
      { op: 'update', lineId: 'l-2', notes: 'no sugar' },
    ]);
  });

  it('removing a saved line is reversible until saved; removing a new line just drops it', () => {
    const order = makeOrder();
    let d = removeLine(fromOrder(order), 'l-1');
    expect(d.lines.find((l) => l.id === 'l-1')?.removed).toBe(true);
    expect(toOps(d)).toEqual([{ op: 'remove', lineId: 'l-1' }]);
    expect(draftTotal(d)).toBe(28000);
    d = restoreLine(d, 'l-1', order);
    expect(hasChanges(d)).toBe(false);
    d = addCartLine(d, buildLine(item('i-lassi', 'Lassi', 9000), [], none, '', 1));
    const newId = d.lines.find((l) => !l.lineId)?.id ?? '';
    expect(removeLine(d, newId).lines.some((l) => !l.lineId)).toBe(false);
  });

  it('minus at quantity 1 removes (saved: marked, new: dropped)', () => {
    let d = fromOrder(makeOrder({ lines: [line('l-1', 'Dosa', 1, 100)] }));
    d = adjustQuantity(d, 'l-1', -1);
    expect(d.lines[0]?.removed).toBe(true);
    expect(d.lines[0]?.chip).toBe('removing');
    expect(wouldEmpty(d)).toBe(true);
  });

  it('new lines become add ops with the exact API shape; identical new lines collapse', () => {
    let d = fromOrder(makeOrder());
    const lassi = item('i-lassi', 'Sweet Lassi', 9000);
    d = addCartLine(d, buildLine(lassi, [], none, '', 1));
    d = addCartLine(d, buildLine(lassi, [], none, '', 2));
    const newLines = d.lines.filter((l) => !l.lineId);
    expect(newLines).toHaveLength(1);
    expect(newLines[0]?.chip).toBe('new');
    expect(toOps(setNote(d, newLines[0]?.id ?? '', 'cold'))).toEqual([
      { op: 'add', line: { catalogItemId: 'i-lassi', quantity: 3, notes: 'cold', modifiers: [] } },
    ]);
    expect(qtyForItem(d, 'i-lassi')).toBe(3);
    expect(qtyForItem(d, 'i-dosa')).toBe(2); // saved lines count for the menu badge too
  });

  it('order note: only sent when it changed; empty clears with null', () => {
    const d0 = fromOrder(makeOrder({ notes: 'Birthday' }));
    expect(noteForSave(d0)).toBeUndefined();
    expect(noteForSave(setOrderNote(d0, 'Anniversary'))).toBe('Anniversary');
    expect(noteForSave(setOrderNote(d0, '  '))).toBeNull();
    expect(hasChanges(setOrderNote(d0, 'x'))).toBe(true);
  });

  it('signature changes with the version, the edit and the reason (decides idempotency key reuse)', () => {
    const d = fromOrder(makeOrder());
    const a = adjustQuantity(d, 'l-1', 1);
    expect(signature(3, a, '')).toBe(signature(3, a, ''));
    expect(signature(3, a, '')).not.toBe(signature(4, a, ''));
    expect(signature(3, a, '')).not.toBe(signature(3, adjustQuantity(a, 'l-1', 1), ''));
    expect(signature(3, a, '')).not.toBe(signature(3, a, 'why'));
  });

  it('cancelled lines are not part of the editable order', () => {
    const d = fromOrder(makeOrder({ lines: [line('l-1', 'Dosa', 1, 100), line('l-x', 'Gone', 1, 100, { status: 'CANCELLED' })] }));
    expect(d.lines.map((l) => l.id)).toEqual(['l-1']);
  });
});

describe('edit draft: rebase after the order changed underneath', () => {
  it('keeps what the user touched, takes the server value for the rest', () => {
    const old = adjustQuantity(fromOrder(makeOrder()), 'l-1', 1); // user: dosa 2 -> 3
    const fresh = makeOrder({
      version: 4,
      lines: [line('l-1', 'Masala Dosa', 2, 14000), line('l-2', 'Paneer Tikka', 5, 28000, { catalogItemId: 'i-paneer' })], // other editor: paneer 1 -> 5
    });
    const { draft, dropped } = rebase(old, fresh);
    expect(dropped).toBe(0);
    expect(draft.lines.find((l) => l.id === 'l-1')?.quantity).toBe(3);
    expect(draft.lines.find((l) => l.id === 'l-2')?.quantity).toBe(5);
    expect(toOps(draft)).toEqual([{ op: 'update', lineId: 'l-1', quantity: 3 }]); // diffed against the NEW base
  });

  it('drops a pending change to a line that was removed elsewhere, and counts it', () => {
    const old = adjustQuantity(fromOrder(makeOrder()), 'l-2', 2);
    const fresh = makeOrder({ version: 4, lines: [line('l-1', 'Masala Dosa', 2, 14000), line('l-2', 'Paneer Tikka', 1, 28000, { status: 'CANCELLED' })] });
    const { draft, dropped } = rebase(old, fresh);
    expect(dropped).toBe(1);
    expect(draft.lines.map((l) => l.id)).toEqual(['l-1']);
    expect(hasChanges(draft)).toBe(false);
  });

  it('keeps new lines and removal marks, and shows lines another editor added', () => {
    let old = fromOrder(makeOrder());
    old = removeLine(old, 'l-1');
    old = addCartLine(old, buildLine(item('i-lassi', 'Lassi', 9000), [], none, '', 1));
    const fresh = makeOrder({ version: 4, lines: [...makeOrder().lines, line('l-3', 'Papad', 1, 2000)] });
    const { draft } = rebase(old, fresh);
    expect(draft.lines.find((l) => l.id === 'l-1')?.removed).toBe(true);
    expect(draft.lines.some((l) => l.id === 'l-3')).toBe(true);
    expect(draft.lines.some((l) => !l.lineId)).toBe(true);
    expect(toOps(draft).map((o) => o.op).sort()).toEqual(['add', 'remove']);
  });
});

describe('editable rule mirror (what the browser can know)', () => {
  const lock = (status: ServiceRequestStatus, lineStatus: 'PENDING' | 'PREPARING' | 'CANCELLED' = 'PENDING') =>
    clientLockReason(makeOrder({ status, lines: [line('l', 'x', 1, 1, { status: lineStatus })] }));

  it('DRAFT and SENT are editable', () => {
    expect(lock('DRAFT')).toBeNull();
    expect(lock('SENT')).toBeNull();
  });
  it('accepted / preparing / ready mean the kitchen started', () => {
    for (const s of ['ACCEPTED', 'PREPARING', 'READY'] as const) expect(lock(s)).toBe('KITCHEN_STARTED');
  });
  it('a partial accept (SENT with a PREPARING line) also counts as started; cancelled lines do not', () => {
    expect(lock('SENT', 'PREPARING')).toBe('KITCHEN_STARTED');
    expect(lock('SENT', 'CANCELLED')).toBeNull();
  });
  it('served and cancelled explain themselves; cancelled shows no button at all', () => {
    expect(lock('SERVED')).toBe('ORDER_SERVED');
    expect(lock('CANCELLED')).toBe('ORDER_CANCELLED');
    expect(showsEditButton({ status: 'CANCELLED' })).toBe(false);
    expect(showsEditButton({ status: 'PREPARING' })).toBe(true);
  });
  it('line chips follow the line, with "saved" only for drafts', () => {
    expect(chipForExisting('SENT', 'PENDING')).toBe('sent');
    expect(chipForExisting('DRAFT', 'PENDING')).toBe('saved');
    expect(chipForExisting('SENT', 'PREPARING')).toBe('preparing');
    expect(chipForExisting('SENT', 'READY')).toBe('ready');
  });
});
