import { BILLING_CYCLES, PRICED_PLAN_KEYS } from '@nexus/shared';
import { z } from 'zod';

/** Largest single payment link staff may create, in rupees (a sanity bound, not a business rule). */
export const MAX_LINK_RUPEES = 1_000_000;

/**
 * Create a payment link. Two ways, and the first is the normal one:
 *
 *  1. From the plan catalog (default): the amount is computed on the server from the plan, billing cycle, the Founding
 *     offer (judged at the request's registration date), the optional Launch Pack and 18% GST. Plan and cycle default to
 *     what the request chose; staff may pick them when the visitor said "not sure". A client-supplied amount is never read.
 *  2. A typed amount (override), for deals the catalog does not cover: needs an `overrideReason`, stored with the link.
 *
 * `replaceOpen` cancels the request's current open link (at Cashfree too) before making the new one; without it an
 * open link blocks a second one, so two live links can never both be paid.
 */
export const createPaymentLinkSchema = z
  .object({
    planKey: z.enum(PRICED_PLAN_KEYS).optional(),
    cycle: z.enum(BILLING_CYCLES).optional(),
    launchPack: z.boolean().optional(),
    amountRupees: z
      .number()
      .positive()
      .max(MAX_LINK_RUPEES)
      .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, { message: 'at most two decimal places' })
      .optional(),
    overrideReason: z.string().trim().min(3).max(200).optional(),
    replaceOpen: z.boolean().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.amountRupees !== undefined && v.overrideReason === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['overrideReason'], message: 'a typed amount needs a reason' });
    }
    if (v.amountRupees === undefined && v.overrideReason !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['overrideReason'], message: 'a reason only goes with a typed amount' });
    }
    if (v.amountRupees !== undefined && (v.planKey !== undefined || v.cycle !== undefined || v.launchPack !== undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['amountRupees'], message: 'a typed amount replaces the plan: send one or the other' });
    }
  });
export type CreatePaymentLinkDto = z.infer<typeof createPaymentLinkSchema>;

export interface BreakdownLine {
  label: string;
  amountPaise: number;
}

/** What staff see for one payment link. */
export interface PaymentLinkView {
  id: string;
  registrationId: string;
  linkId: string;
  linkUrl: string;
  amountPaise: number;
  currency: string;
  purpose: string;
  status: string;
  paidAmountPaise: number | null;
  planKey: string | null;
  billingCycle: string | null;
  /** The priced lines (plan, discount, Launch Pack, GST), or null for a typed amount. */
  breakdown: BreakdownLine[] | null;
  /** Reason given for a typed amount, else null. */
  overrideReason: string | null;
  source: string;
  expiresAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
}
