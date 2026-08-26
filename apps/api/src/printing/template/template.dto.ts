import { z } from 'zod';
import { PrintPurpose } from '@prisma/client';

export const createTemplateSchema = z.object({
  locationId: z.string().uuid().optional(),
  purpose: z.nativeEnum(PrintPurpose),
  name: z.string().min(1).max(100),
  config: z.record(z.unknown()).optional().default({}),
  isDefault: z.boolean().optional().default(false),
});
export type CreateTemplateDto = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: z.record(z.unknown()).optional(),
  isDefault: z.boolean().optional(),
});
export type UpdateTemplateDto = z.infer<typeof updateTemplateSchema>;

/** Default config values when no template is found. */
export const DEFAULT_RECEIPT_CONFIG = {
  showBusinessName: true,
  showAddress: true,
  showTaxId: true,
  showTaxBreakdown: true,
  showPaymentDetails: true,
  footerText: 'Thank you for dining with us!',
};

export const DEFAULT_KOT_CONFIG = {
  showTableCode: true,
  showRoundNumber: true,
  showKitchenNotes: true,
  showModifiers: true,
};
