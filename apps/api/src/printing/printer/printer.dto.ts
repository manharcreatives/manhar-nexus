import { z } from 'zod';
import { PrintPurpose, PrinterConnectionType } from '@prisma/client';

export const createPrinterSchema = z.object({
  locationId: z.string().uuid(),
  agentId: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  purpose: z.nativeEnum(PrintPurpose),
  connectionType: z.nativeEnum(PrinterConnectionType),
  deviceConfig: z.record(z.unknown()).optional().default({}),
});
export type CreatePrinterDto = z.infer<typeof createPrinterSchema>;

export const updatePrinterSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  agentId: z.string().uuid().nullable().optional(),
  purpose: z.nativeEnum(PrintPurpose).optional(),
  connectionType: z.nativeEnum(PrinterConnectionType).optional(),
  deviceConfig: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});
export type UpdatePrinterDto = z.infer<typeof updatePrinterSchema>;
