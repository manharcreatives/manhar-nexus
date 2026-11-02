import { z } from 'zod';

const brandingFields = {
  /** URL-friendly unique handle, kebab-case, e.g. "the-grand-cafe". */
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric and hyphens').optional(),
  /** Hex color string, e.g. "#FF6B35". */
  accentColor: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional().nullable(),
  /** URL to logo image. */
  logoUrl: z.string().trim().url('Invalid logo URL').max(2048).optional().nullable(),
  /** Legal name on invoices (falls back to legalName/name). */
  invoiceName: z.string().trim().min(1).max(200).optional().nullable(),
  /** Full address block for invoices. */
  invoiceAddress: z.string().trim().min(1).max(1000).optional().nullable(),
  /** GST / tax registration number. */
  taxId: z.string().trim().min(1).max(50).optional().nullable(),
};

export const createBusinessSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    legalName: z.string().trim().min(1).max(200).optional(),
    /** Machine key from the BusinessType catalog, e.g. "restaurant". */
    businessTypeKey: z.string().trim().min(1),
    currencyCode: z.string().trim().length(3).toUpperCase().optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
    ...brandingFields,
  })
  .strict();
export type CreateBusinessDto = z.infer<typeof createBusinessSchema>;

export const updateBusinessSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    legalName: z.string().trim().min(1).max(200).nullable().optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
    slug: brandingFields.slug,
    accentColor: brandingFields.accentColor,
    logoUrl: brandingFields.logoUrl,
    invoiceName: brandingFields.invoiceName,
    invoiceAddress: brandingFields.invoiceAddress,
    taxId: brandingFields.taxId,
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });
export type UpdateBusinessDto = z.infer<typeof updateBusinessSchema>;

/** Permanent-deletion guard: the caller must repeat the exact phrase. */
export const deleteBusinessSchema = z
  .object({
    confirmation: z.literal('delete this restaurant'),
  })
  .strict();
export type DeleteBusinessDto = z.infer<typeof deleteBusinessSchema>;
