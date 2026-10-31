import { ServiceLineStatus as L, ServiceRequestStatus as S } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../common/errors';
import type { EditOp } from './order-edit.dto';
import { editOrderSchema } from './order-edit.dto';
import {
  type EditableLine,
  OrderEditLockedError,
  activeTotal,
  assertEditable,
  editLockReason,
  planEdit,
} from './order-edit.plan';

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ctx = { sessionOpen: true, invoiceExists: false };

const line = (n: number, over: Partial<EditableLine> = {}): EditableLine => ({
  id: U(n),
  catalogItemId: U(100 + n),
  variantId: null,
  itemNameSnapshot: `Item ${n}`,
  variantNameSnapshot: null,
  unitPriceMinorUnits: 10000,
  quantity: 2,
  notes: null,
  kitchenNote: null,
  status: L.PENDING,
  modifiers: [],
  ...over,
});

describe('editLockReason: state rules', () => {
  const cases: [S, L, string | null][] = [
    [S.DRAFT, L.PENDING, null],
    [S.SENT, L.PENDING, null],
    [S.ACCEPTED, L.PREPARING, 'KITCHEN_STARTED'],
    [S.PREPARING, L.PREPARING, 'KITCHEN_STARTED'],
    [S.READY, L.READY, 'KITCHEN_STARTED'],
    [S.SERVED, L.SERVED, 'ORDER_SERVED'],
    [S.CLOSED, L.SERVED, 'ORDER_SERVED'],
    [S.CANCELLED, L.CANCELLED, 'ORDER_CANCELLED'],
  ];
  it.each(cases)('status %s with %s lines -> %s', (status, ls, expected) => {
    expect(editLockReason({ status, lines: [{ status: ls }] }, ctx)).toBe(expected);
  });

  it('a partially accepted SENT order (some line already PREPARING) is KITCHEN_STARTED', () => {
    expect(editLockReason({ status: S.SENT, lines: [{ status: L.PENDING }, { status: L.PREPARING }] }, ctx)).toBe('KITCHEN_STARTED');
  });

  it('cancelled lines do not count as started', () => {
    expect(editLockReason({ status: S.SENT, lines: [{ status: L.PENDING }, { status: L.CANCELLED }] }, ctx)).toBeNull();
  });

  it('closed session and live invoice lock the order', () => {
    const req = { status: S.SENT, lines: [{ status: L.PENDING }] };
    expect(editLockReason(req, { sessionOpen: false, invoiceExists: false })).toBe('SESSION_NOT_OPEN');
    expect(editLockReason(req, { sessionOpen: true, invoiceExists: true })).toBe('INVOICE_EXISTS');
  });

  it('assertEditable throws the typed 409 with a human message and details.reason', () => {
    try {
      assertEditable({ status: S.PREPARING, lines: [{ status: L.PREPARING }] }, ctx, { id: 'x' });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(OrderEditLockedError);
      const err = e as OrderEditLockedError;
      expect(err.code).toBe('ORDER_EDIT_LOCKED');
      expect(err.httpStatus).toBe(409);
      expect(err.details).toMatchObject({ reason: 'KITCHEN_STARTED', status: S.PREPARING, id: 'x' });
      expect(err.message).toMatch(/kitchen has already started/i);
    }
  });
});

describe('planEdit', () => {
  const lines = [line(1), line(2, { notes: 'no onion', variantId: U(500), modifiers: [{ modifierOptionId: U(600), optionNameSnapshot: 'Cheese' }] })];
  const addOp = (n: number): EditOp => ({ op: 'add', line: { catalogItemId: U(n), quantity: 1, modifiers: [] } });

  it('plans adds, removes, quantity and note updates in order', () => {
    const plan = planEdit(lines, [
      addOp(9),
      { op: 'remove', lineId: U(1) },
      { op: 'update', lineId: U(2), quantity: 5, notes: 'extra spicy' },
    ]);
    expect(plan.ops.map((o) => o.kind)).toEqual(['add', 'remove', 'update']);
    expect(plan.activeAfter).toBe(2);
    expect(plan.needsSnapshot.map((n) => n.opIndex)).toEqual([0]);
    expect(plan.ops[2]).toMatchObject({ kind: 'update', lineId: U(2), quantity: 5, notes: 'extra spicy' });
  });

  it('drops no-op updates (same quantity, note equal after trim)', () => {
    const plan = planEdit(lines, [{ op: 'update', lineId: U(2), quantity: 2, notes: ' no onion ' }]);
    expect(plan.ops).toEqual([]);
  });

  it('a note set to empty string clears it; clearing an empty note is a no-op', () => {
    expect(planEdit(lines, [{ op: 'update', lineId: U(2), notes: '' }]).ops[0]).toMatchObject({ kind: 'update', notes: null });
    expect(planEdit(lines, [{ op: 'update', lineId: U(1), notes: '' }]).ops).toEqual([]);
  });

  it('a changed variant or option set becomes a reconfigure that keeps item, quantity and note', () => {
    const plan = planEdit(lines, [{ op: 'update', lineId: U(2), variantId: U(501) }]);
    expect(plan.ops[0]).toMatchObject({ kind: 'reconfigure', lineId: U(2) });
    const input = (plan.ops[0] as { input: { catalogItemId: string; variantId: string; quantity: number; notes: string; modifiers: unknown[] } }).input;
    expect(input).toMatchObject({ catalogItemId: U(102), variantId: U(501), quantity: 2, notes: 'no onion', modifiers: [{ modifierOptionId: U(600) }] });
    expect(plan.activeAfter).toBe(2);
    expect(plan.needsSnapshot).toHaveLength(1);
  });

  it('unchanged variant / options with a new quantity stays an in-place update', () => {
    const plan = planEdit(lines, [{ op: 'update', lineId: U(2), quantity: 3, variantId: U(500), modifiers: [{ modifierOptionId: U(600) }] }]);
    expect(plan.ops).toEqual([{ kind: 'update', opIndex: 0, lineId: U(2), quantity: 3 }]);
    expect(plan.needsSnapshot).toEqual([]);
  });

  it('clearing the variant (null) is a reconfigure', () => {
    expect(planEdit(lines, [{ op: 'update', lineId: U(2), variantId: null }]).ops[0]?.kind).toBe('reconfigure');
  });

  it('rejects unknown, cancelled and twice-touched lines', () => {
    expect(() => planEdit(lines, [{ op: 'remove', lineId: U(77) }])).toThrow(NotFoundError);
    expect(() => planEdit([line(1, { status: L.CANCELLED }), line(2)], [{ op: 'remove', lineId: U(1) }])).toThrow(NotFoundError);
    expect(() => planEdit(lines, [{ op: 'remove', lineId: U(1) }, { op: 'update', lineId: U(1), quantity: 1 }])).toThrow(
      expect.objectContaining({ details: expect.objectContaining({ reason: 'LINE_TOUCHED_TWICE' }) }),
    );
  });

  it('refuses to empty the order (cancel the order instead)', () => {
    expect(() => planEdit(lines, [{ op: 'remove', lineId: U(1) }, { op: 'remove', lineId: U(2) }])).toThrow(ValidationError);
    expect(planEdit(lines, [{ op: 'remove', lineId: U(1) }, { op: 'remove', lineId: U(2) }, addOp(9)]).activeAfter).toBe(1);
  });

  it('cannot reconfigure a line whose catalog item was deleted', () => {
    expect(() => planEdit([line(1, { catalogItemId: null })], [{ op: 'update', lineId: U(1), variantId: U(5) }])).toThrow(
      expect.objectContaining({ details: expect.objectContaining({ reason: 'ITEM_REMOVED' }) }),
    );
  });
});

describe('activeTotal', () => {
  it('sums price x quantity of non-cancelled lines in integer minor units', () => {
    expect(activeTotal([line(1), line(2, { quantity: 1, unitPriceMinorUnits: 4950 }), line(3, { status: L.CANCELLED })])).toBe(2 * 10000 + 4950);
  });
});

describe('editOrderSchema', () => {
  const base = { idempotencyKey: U(1), expectedVersion: 3 };
  it('requires an idempotency key and expectedVersion', () => {
    expect(editOrderSchema.safeParse({ ops: [{ op: 'remove', lineId: U(1) }] }).success).toBe(false);
    expect(editOrderSchema.safeParse({ ...base, ops: [{ op: 'remove', lineId: U(1) }] }).success).toBe(true);
  });
  it('rejects an empty edit, accepts a notes-only edit, rejects an update that changes nothing', () => {
    expect(editOrderSchema.safeParse({ ...base, ops: [] }).success).toBe(false);
    expect(editOrderSchema.safeParse({ ...base, ops: [], notes: 'rush' }).success).toBe(true);
    expect(editOrderSchema.safeParse({ ...base, ops: [{ op: 'update', lineId: U(1) }] }).success).toBe(false);
  });
  it('bounds quantity and note length', () => {
    expect(editOrderSchema.safeParse({ ...base, ops: [{ op: 'update', lineId: U(1), quantity: 0 }] }).success).toBe(false);
    expect(editOrderSchema.safeParse({ ...base, ops: [{ op: 'update', lineId: U(1), notes: 'x'.repeat(301) }] }).success).toBe(false);
  });
});
