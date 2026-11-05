import { z } from 'zod';

/** Largest single payment link staff may create, in rupees (a sanity bound, not a business rule). */
export const MAX_LINK_RUPEES = 1_000_000;

export const createPaymentLinkSchema = z
  .object({
    /** Rupees, at most two decimals. Staff type the amount: pricing is not hard-coded here. */
    amountRupees: z
      .number()
      .positive()
      .max(MAX_LINK_RUPEES)
      .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, { message: 'at most two decimal places' }),
    purpose: z.string().trim().min(3).max(200).default('Manhar Nexus subscription'),
  })
  .strict();
export type CreatePaymentLinkDto = z.infer<typeof createPaymentLinkSchema>;

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
  expiresAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
}
