import { BILLING_CYCLES, PRICED_PLAN_KEYS } from '@nexus/shared';
import { z } from 'zod';

export const MANUAL_PAYMENT_METHODS = ['UPI', 'BANK', 'CASH', 'OTHER'] as const;

const MAX_RUPEES = 1_000_000;
const DAY_MS = 86_400_000;

/**
 * Staff record a payment that did not go through Cashfree (a UPI or bank transfer, or cash). The amount is the server's
 * quote for the plan unless a different one is typed, and then a reason is required. `.strict()`: nothing else is read.
 */
export const manualPaymentSchema = z
  .object({
    planKey: z.enum(PRICED_PLAN_KEYS),
    cycle: z.enum(BILLING_CYCLES),
    launchPack: z.boolean().optional(),
    method: z.enum(MANUAL_PAYMENT_METHODS),
    /** The bank / UPI reference or receipt number, so the payment can be found later. */
    reference: z.string().trim().min(3).max(80),
    /** When the money arrived (any ISO date or date-time, not in the future). Defaults to now. */
    paidOn: z
      .string()
      .trim()
      .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'not a valid date' })
      .refine((v) => Date.parse(v) <= Date.now() + DAY_MS, { message: 'the payment date cannot be in the future' })
      .optional(),
    amountRupees: z
      .number()
      .positive()
      .max(MAX_RUPEES)
      .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, { message: 'at most two decimal places' })
      .optional(),
    overrideReason: z.string().trim().min(3).max(200).optional(),
  })
  .strict();
export type ManualPaymentDto = z.infer<typeof manualPaymentSchema>;

export const acceptMismatchSchema = z
  .object({
    reason: z.string().trim().min(3).max(200),
  })
  .strict();
export type AcceptMismatchDto = z.infer<typeof acceptMismatchSchema>;
