import { z } from 'zod';

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
