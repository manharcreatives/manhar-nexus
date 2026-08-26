import { z } from 'zod';

/**
 * The ordered milestone steps of the client go-live journey (ADR-027).
 * New steps can be inserted without a DB migration because they are stored
 * as TEXT[] (not a Postgres enum column).
 */
export const ONBOARDING_STEPS = [
  'BUSINESS_CREATED',
  'LOCATION_ADDED',
  'MODULES_SELECTED',
  'BRANDING_SET',
  'CONFIGURATION_DONE',
  'USERS_PROVISIONED',
  'DEVICES_CONFIGURED',
  'VALIDATED',
  'COMPLETED',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const onboardingStepSchema = z.enum(ONBOARDING_STEPS);

export const initOnboardingSchema = z.object({
  notes: z.string().max(2000).optional(),
});
export type InitOnboardingDto = z.infer<typeof initOnboardingSchema>;

export const completeStepSchema = z.object({
  /** Optional context note for this step completion. */
  note: z.string().max(500).optional(),
});
export type CompleteStepDto = z.infer<typeof completeStepSchema>;

export const updateNotesSchema = z.object({
  notes: z.string().max(2000).nullable(),
});
export type UpdateNotesDto = z.infer<typeof updateNotesSchema>;

export const listOnboardingQuerySchema = z.object({
  currentStep: onboardingStepSchema.optional(),
  /** true = only incomplete; false = only completed; omit = all */
  completed: z
    .string()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined))
    .optional(),
  skip: z.coerce.number().int().min(0).default(0),
  take: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListOnboardingQuery = z.infer<typeof listOnboardingQuerySchema>;
