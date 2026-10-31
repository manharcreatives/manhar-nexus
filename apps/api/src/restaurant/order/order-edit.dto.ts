import { z } from 'zod';
import { lineSchema } from './order.dto';

const modifierSchema = z.object({ modifierOptionId: z.string().uuid() });

const addOp = z.object({ op: z.literal('add'), line: lineSchema });

/**
 * Change one existing line. quantity / notes / kitchenNote change in place;
 * `variantId` (null clears it) or `modifiers` re-price the line, which the
 * server does by cancelling the old line and adding a freshly snapshotted one.
 */
const updateOp = z
  .object({
    op: z.literal('update'),
    lineId: z.string().uuid(),
    quantity: z.number().int().min(1).max(999).optional(),
    notes: z.string().max(300).nullable().optional(),
    kitchenNote: z.string().max(300).nullable().optional(),
    variantId: z.string().uuid().nullable().optional(),
    modifiers: z.array(modifierSchema).max(50).optional(),
  });

const removeOp = z.object({ op: z.literal('remove'), lineId: z.string().uuid() });

export const editOrderSchema = z.object({
  /** Client-generated; retrying with the same key returns the original result (ADR-017). */
  idempotencyKey: z.string().uuid(),
  /** Version the client's screen was built from. Required: edits never silently overwrite. */
  expectedVersion: z.number().int().min(1),
  reason: z.string().trim().min(1).max(300).optional(),
  /** Order-level note (replaces the current one; null clears it). */
  notes: z.string().max(500).nullable().optional(),
  ops: z.array(z.discriminatedUnion('op', [addOp, updateOp, removeOp])).max(100),
}).superRefine((dto, ctx) => {
  if (dto.ops.length === 0 && dto.notes === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ops'], message: 'An edit needs at least one change' });
  }
  dto.ops.forEach((o, i) => {
    if (
      o.op === 'update' &&
      o.quantity === undefined &&
      o.notes === undefined &&
      o.kitchenNote === undefined &&
      o.variantId === undefined &&
      o.modifiers === undefined
    ) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ops', i], message: 'An update must change at least one field' });
    }
  });
});

export type EditOrderDto = z.infer<typeof editOrderSchema>;
export type EditOp = EditOrderDto['ops'][number];
