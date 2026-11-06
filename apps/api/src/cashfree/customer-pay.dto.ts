import { z } from 'zod';
import type { BreakdownLine } from './cashfree.dto';

/**
 * Who is asking: the reference code they were shown plus the email they registered with. Nothing else is read, so a
 * client can never send a price, a plan or a registration id.
 */
export const customerPaySchema = z
  .object({
    referenceCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9-]{3,31}$/),
    email: z.string().trim().toLowerCase().email().max(254),
  })
  .strict();
export type CustomerPayDto = z.infer<typeof customerPaySchema>;

/** The only fields of a link the owner needs; no ids, no staff data, no personal data. */
export interface CustomerLinkView {
  linkUrl: string;
  amountPaise: number;
  purpose: string;
  breakdown: BreakdownLine[] | null;
  expiresAt: Date | null;
}

export type CustomerPayAnswer =
  | { outcome: 'link'; link: CustomerLinkView }
  /** Already paid: nothing more to pay. */
  | { outcome: 'paid' }
  /** Many Doors, "not sure", or a request staff are already handling: a person will quote and send the link. */
  | { outcome: 'contact-us' };

export interface CustomerPayStatus {
  paid: boolean;
}
