import { z } from 'zod';

// ── Staff Profile ──────────────────────────────────────────────────────────────

export const createStaffProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120),
    roleTag: z.string().trim().min(1).max(60).default('staff'),
    isActive: z.boolean().default(true),
  })
  .strict();
export type CreateStaffProfileDto = z.infer<typeof createStaffProfileSchema>;

export const updateStaffProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    roleTag: z.string().trim().min(1).max(60).optional(),
    isActive: z.boolean().optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();
export type UpdateStaffProfileDto = z.infer<typeof updateStaffProfileSchema>;

// ── Guest ──────────────────────────────────────────────────────────────────────

export const createGuestSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120),
    phone: z.string().trim().max(30).optional(),
    notes: z.string().trim().max(500).optional(),
    tags: z.array(z.string().trim().max(40)).default([]),
  })
  .strict();
export type CreateGuestDto = z.infer<typeof createGuestSchema>;

export const updateGuestSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
    tags: z.array(z.string().trim().max(40)).optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();
export type UpdateGuestDto = z.infer<typeof updateGuestSchema>;
