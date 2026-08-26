import { z } from 'zod';

const modifierSchema = z.object({
  modifierOptionId: z.string().uuid(),
});

const lineSchema = z.object({
  catalogItemId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().min(1).max(999),
  notes: z.string().max(300).optional(),
  kitchenNote: z.string().max(300).optional(),
  modifiers: z.array(modifierSchema).default([]),
});

export const createDraftSchema = z.object({
  sessionId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  staffId: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
  lines: z.array(lineSchema).min(1),
});

export const addLinesSchema = z.object({
  lines: z.array(lineSchema).min(1),
  expectedVersion: z.number().int().optional(),
});

export const updateLineSchema = z.object({
  quantity: z.number().int().min(1).max(999).optional(),
  notes: z.string().max(300).nullable().optional(),
  kitchenNote: z.string().max(300).nullable().optional(),
  expectedVersion: z.number().int().optional(),
});

export const sendToKitchenSchema = z.object({
  notes: z.string().max(500).optional(),
  expectedVersion: z.number().int().optional(),
});

export const cancelRequestSchema = z.object({
  reason: z.string().min(1).max(500),
  expectedVersion: z.number().int().optional(),
});

export const cancelLineSchema = z.object({
  reason: z.string().min(1).max(500),
  expectedVersion: z.number().int().optional(),
});

export const lineStatusSchema = z.object({
  lineIds: z.array(z.string().uuid()).max(500).optional(),
});

export type CreateDraftDto = z.infer<typeof createDraftSchema>;
export type AddLinesDto = z.infer<typeof addLinesSchema>;
export type UpdateLineDto = z.infer<typeof updateLineSchema>;
export type SendToKitchenDto = z.infer<typeof sendToKitchenSchema>;
export type CancelRequestDto = z.infer<typeof cancelRequestSchema>;
export type CancelLineDto = z.infer<typeof cancelLineSchema>;
export type LineStatusDto = z.infer<typeof lineStatusSchema>;
