import { z } from 'zod';

export const createLocationSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    /** Optional short code, unique within the business. */
    code: z.string().trim().min(1).max(32).optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
  })
  .strict();
export type CreateLocationDto = z.infer<typeof createLocationSchema>;

export const updateLocationSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    code: z.string().trim().min(1).max(32).nullable().optional(),
    timezone: z.string().trim().min(1).max(64).nullable().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });
export type UpdateLocationDto = z.infer<typeof updateLocationSchema>;

// ── Location Hours ────────────────────────────────────────────────────────────

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const locationHoursDaySchema = z
  .object({
    /** 0=Sunday … 6=Saturday */
    dayOfWeek: z.number().int().min(0).max(6),
    isClosed: z.boolean(),
    /** Required when isClosed=false */
    openTime: z.string().regex(TIME_RE, 'openTime must be HH:MM').optional().nullable(),
    /** Required when isClosed=false */
    closeTime: z.string().regex(TIME_RE, 'closeTime must be HH:MM').optional().nullable(),
  })
  .refine(
    (v) => v.isClosed || (v.openTime != null && v.closeTime != null),
    { message: 'openTime and closeTime are required when isClosed is false' },
  );

export const upsertLocationHoursSchema = z
  .object({
    /** Full week, 7 entries (one per day); partial weeks are allowed. */
    hours: z.array(locationHoursDaySchema).min(1).max(7),
  })
  .strict();
export type UpsertLocationHoursDto = z.infer<typeof upsertLocationHoursSchema>;

// ── Location Service Modes ────────────────────────────────────────────────────

export const SERVICE_MODES = ['DINE_IN', 'TAKEOUT', 'DELIVERY', 'DRIVE_THROUGH', 'ROOM_SERVICE'] as const;
export type ServiceModeKey = (typeof SERVICE_MODES)[number];

export const upsertServiceModesSchema = z
  .object({
    modes: z
      .array(
        z.object({
          mode: z.enum(SERVICE_MODES),
          isEnabled: z.boolean(),
        }),
      )
      .min(1),
  })
  .strict();
export type UpsertServiceModesDto = z.infer<typeof upsertServiceModesSchema>;
