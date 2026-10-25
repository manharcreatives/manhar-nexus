import { z } from 'zod';
import { InvoiceStatus } from '@prisma/client';

export const createInvoiceSchema = z.object({
  notes: z.string().max(500).optional(),
});

export const finaliseInvoiceSchema = z.object({
  expectedVersion: z.number().int().optional(),
});

export const voidInvoiceSchema = z.object({
  reason: z.string().min(1).max(500),
  expectedVersion: z.number().int().optional(),
});

export type CreateInvoiceDto = z.infer<typeof createInvoiceSchema>;
export type FinaliseInvoiceDto = z.infer<typeof finaliseInvoiceSchema>;
export type VoidInvoiceDto = z.infer<typeof voidInvoiceSchema>;

/**
 * Invoice list query. `from`/`to` filter on invoice `createdAt`.
 * Accepts a date (YYYY-MM-DD) or a full ISO datetime. A date-only `from` means
 * 00:00:00.000Z of that day; a date-only `to` is INCLUSIVE of the whole day
 * (23:59:59.999Z). A full datetime is used exactly as given.
 */
const dateBound = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Invalid date' });

export const listInvoicesSchema = z
  .object({
    status: z.nativeEnum(InvoiceStatus).optional(),
    from: dateBound.optional(),
    to: dateBound.optional(),
    locationId: z.string().uuid().optional(),
    skip: z.coerce.number().int().min(0).default(0),
    take: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export type ListInvoicesQuery = z.infer<typeof listInvoicesSchema>;
