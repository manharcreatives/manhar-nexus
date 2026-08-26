import { z } from 'zod';

// ─── Offering ────────────────────────────────────────────────────────────────

export const createOfferingSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9-]+$/, 'key must be kebab-case'),
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).optional(),
    type: z.enum(['SETUP_FEE', 'RECURRING', 'ONE_TIME', 'TRIAL']),
    moduleKeys: z.array(z.string().min(1)).default([]),
    sortOrder: z.number().int().min(0).default(0),
  })
  .strict();

export const updateOfferingSchema = createOfferingSchema
  .omit({ key: true })
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .strict();

export type CreateOfferingDto = z.infer<typeof createOfferingSchema>;
export type UpdateOfferingDto = z.infer<typeof updateOfferingSchema>;

// ─── Price book ──────────────────────────────────────────────────────────────

export const createPriceBookSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).optional(),
    currencyCode: z.string().toUpperCase().length(3).default('INR'),
    isDefault: z.boolean().default(false),
    validFrom: z.string().datetime().optional(),
    validTo: z.string().datetime().optional(),
  })
  .strict();

export const updatePriceBookSchema = createPriceBookSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .strict();

export const createPriceBookEntrySchema = z
  .object({
    offeringId: z.string().uuid(),
    amountMinorUnits: z.number().int().min(0),
    billingPeriodDays: z.number().int().min(1).optional(),
  })
  .strict();

export const updatePriceBookEntrySchema = z
  .object({
    amountMinorUnits: z.number().int().min(0).optional(),
    billingPeriodDays: z.number().int().min(1).optional().nullable(),
  })
  .strict();

export type CreatePriceBookDto = z.infer<typeof createPriceBookSchema>;
export type UpdatePriceBookDto = z.infer<typeof updatePriceBookSchema>;
export type CreatePriceBookEntryDto = z.infer<typeof createPriceBookEntrySchema>;
export type UpdatePriceBookEntryDto = z.infer<typeof updatePriceBookEntrySchema>;

// ─── Bundle ──────────────────────────────────────────────────────────────────

export const createBundleSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9-]+$/, 'key must be kebab-case'),
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).optional(),
  })
  .strict();

export const updateBundleSchema = createBundleSchema
  .omit({ key: true })
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .strict();

export type CreateBundleDto = z.infer<typeof createBundleSchema>;
export type UpdateBundleDto = z.infer<typeof updateBundleSchema>;

// ─── Client account ──────────────────────────────────────────────────────────

export const updateClientAccountSchema = z
  .object({
    commercialStatus: z
      .enum(['PROSPECT', 'TRIAL', 'ACTIVE', 'SUSPENDED', 'CHURNED'])
      .optional(),
    accountNotes: z.string().trim().max(2000).optional(),
    assignedTo: z.string().trim().max(100).optional().nullable(),
  })
  .strict();

export const createClientPriceOverrideSchema = z
  .object({
    offeringId: z.string().uuid(),
    amountMinorUnits: z.number().int().min(0),
    currencyCode: z.string().toUpperCase().length(3).default('INR'),
    effectiveFrom: z.string().datetime(),
    effectiveTo: z.string().datetime().optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export const updateClientPriceOverrideSchema = z
  .object({
    amountMinorUnits: z.number().int().min(0).optional(),
    effectiveTo: z.string().datetime().optional().nullable(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export type UpdateClientAccountDto = z.infer<typeof updateClientAccountSchema>;
export type CreateClientPriceOverrideDto = z.infer<typeof createClientPriceOverrideSchema>;
export type UpdateClientPriceOverrideDto = z.infer<typeof updateClientPriceOverrideSchema>;

// ─── Activation request ──────────────────────────────────────────────────────

export const createActivationRequestSchema = z
  .object({
    bundleId: z.string().uuid().optional(),
    moduleKeys: z.array(z.string().min(1)).default([]),
    requestedBy: z.string().trim().max(100).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict()
  .refine((d) => (d.bundleId ?? '') !== '' || d.moduleKeys.length > 0, {
    message: 'Provide at least a bundleId or one moduleKey',
  });

export const VALID_TRANSITIONS: Record<string, string[]> = {
  REQUESTED: ['QUOTED', 'REMOVED'],
  QUOTED: ['APPROVED', 'REQUESTED', 'REMOVED'],
  APPROVED: ['PENDING_SETUP', 'QUOTED', 'REMOVED'],
  PENDING_SETUP: ['ACTIVE', 'REMOVED'],
  ACTIVE: ['SUSPENDED', 'REMOVED'],
  SUSPENDED: ['ACTIVE', 'REMOVED'],
  REMOVED: [],
};

export const transitionActivationSchema = z
  .object({
    toStatus: z.enum(['QUOTED', 'APPROVED', 'PENDING_SETUP', 'ACTIVE', 'SUSPENDED', 'REMOVED']),
    note: z.string().trim().max(2000).optional(),
    quotedAmount: z.number().int().min(0).optional(),
    currencyCode: z.string().toUpperCase().length(3).optional(),
  })
  .strict();

export type CreateActivationRequestDto = z.infer<typeof createActivationRequestSchema>;
export type TransitionActivationDto = z.infer<typeof transitionActivationSchema>;

// ─── Deployment checklist ────────────────────────────────────────────────────

export const createChecklistSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            key: z.string().trim().min(1).max(100),
            label: z.string().trim().min(1).max(200),
            sortOrder: z.number().int().min(0).default(0),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();

export const updateChecklistItemSchema = z
  .object({
    completed: z.boolean(),
  })
  .strict();

export type CreateChecklistDto = z.infer<typeof createChecklistSchema>;
export type UpdateChecklistItemDto = z.infer<typeof updateChecklistItemSchema>;

// ─── Shared query ────────────────────────────────────────────────────────────

export const clientListQuerySchema = z.object({
  skip: z.coerce.number().int().min(0).optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
  commercialStatus: z
    .enum(['PROSPECT', 'TRIAL', 'ACTIVE', 'SUSPENDED', 'CHURNED'])
    .optional(),
});

export const activationListQuerySchema = z.object({
  skip: z.coerce.number().int().min(0).optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
  status: z
    .enum(['REQUESTED', 'QUOTED', 'APPROVED', 'PENDING_SETUP', 'ACTIVE', 'SUSPENDED', 'REMOVED'])
    .optional(),
});
