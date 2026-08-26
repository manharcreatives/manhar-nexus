import { z } from 'zod';

export const createBookingSchema = z
  .object({
    locationId: z.string().uuid(),
    diningTableId: z.string().uuid().optional(),
    guestId: z.string().uuid().optional(),
    partySize: z.number().int().min(1).default(2),
    scheduledAt: z.string().datetime({ offset: true }),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();
export type CreateBookingDto = z.infer<typeof createBookingSchema>;

export const updateBookingSchema = z
  .object({
    status: z.enum(['PENDING', 'CONFIRMED', 'SEATED', 'NO_SHOW', 'CANCELLED']).optional(),
    diningTableId: z.string().uuid().nullable().optional(),
    guestId: z.string().uuid().nullable().optional(),
    partySize: z.number().int().min(1).optional(),
    scheduledAt: z.string().datetime({ offset: true }).optional(),
    notes: z.string().trim().max(500).nullable().optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();
export type UpdateBookingDto = z.infer<typeof updateBookingSchema>;
