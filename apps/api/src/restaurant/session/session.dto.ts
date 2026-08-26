import { z } from 'zod';

export const openSessionSchema = z.object({
  locationId: z.string().uuid(),
  diningTableId: z.string().uuid(),
  partySize: z.number().int().min(1).max(500),
  bookingId: z.string().uuid().optional(),
  guestId: z.string().uuid().optional(),
  assignedStaffId: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
});

export const updateSessionSchema = z.object({
  partySize: z.number().int().min(1).max(500).optional(),
  guestId: z.string().uuid().nullable().optional(),
  assignedStaffId: z.string().uuid().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  expectedVersion: z.number().int().optional(),
});

export const closeSessionSchema = z.object({
  notes: z.string().max(500).optional(),
  expectedVersion: z.number().int().optional(),
});

export const voidSessionSchema = z.object({
  reason: z.string().min(1).max(500),
  expectedVersion: z.number().int().optional(),
});

export const seatBookingSchema = z.object({
  diningTableId: z.string().uuid(),
  assignedStaffId: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
});

export type OpenSessionDto = z.infer<typeof openSessionSchema>;
export type UpdateSessionDto = z.infer<typeof updateSessionSchema>;
export type CloseSessionDto = z.infer<typeof closeSessionSchema>;
export type VoidSessionDto = z.infer<typeof voidSessionSchema>;
export type SeatBookingDto = z.infer<typeof seatBookingSchema>;
