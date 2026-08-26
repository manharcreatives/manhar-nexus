import { z } from 'zod';

// ── Dining Area ────────────────────────────────────────────────────────────────

export const createDiningAreaSchema = z
  .object({
    locationId: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().min(0).default(0),
  })
  .strict();
export type CreateDiningAreaDto = z.infer<typeof createDiningAreaSchema>;

export const updateDiningAreaSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();
export type UpdateDiningAreaDto = z.infer<typeof updateDiningAreaSchema>;

// ── Dining Table ───────────────────────────────────────────────────────────────

export const createDiningTableSchema = z
  .object({
    diningAreaId: z.string().uuid(),
    locationId: z.string().uuid(),
    code: z.string().trim().min(1).max(20),
    capacity: z.number().int().min(1).default(4),
    isActive: z.boolean().default(true),
  })
  .strict();
export type CreateDiningTableDto = z.infer<typeof createDiningTableSchema>;

export const updateDiningTableSchema = z
  .object({
    code: z.string().trim().min(1).max(20).optional(),
    capacity: z.number().int().min(1).optional(),
    status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING']).optional(),
    isActive: z.boolean().optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();
export type UpdateDiningTableDto = z.infer<typeof updateDiningTableSchema>;
