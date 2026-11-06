import { randomInt } from 'node:crypto';
import { z } from 'zod';

/** Module keys in dependency order: the core three first, then the optional extras that were chosen. */
export const CORE_MODULES = ['restaurant', 'catalog', 'checkout'] as const;
export const OPTIONAL_MODULES = ['reports', 'costs'] as const;

export const provisionSchema = z
  .object({
    /** Defaults to the request's restaurant name. */
    name: z.string().trim().min(1).max(200).optional(),
    locationName: z.string().trim().min(1).max(200).optional(),
    ownerName: z.string().trim().min(1).max(100).optional(),
    ownerEmail: z.string().trim().email().toLowerCase().optional(),
    commercialStatus: z.enum(['PROSPECT', 'TRIAL', 'ACTIVE']).optional(),
    /** Optional extras on top of the core modules. */
    extraModules: z.array(z.enum(OPTIONAL_MODULES)).max(OPTIONAL_MODULES.length).optional(),
    /** Create the account although no payment is recorded (a free pilot). Staff must say so on purpose. */
    allowUnpaid: z.boolean().optional(),
    /** After a finished run: issue a new temporary password (the first one was lost). Only before the owner signed in. */
    reissuePassword: z.boolean().optional(),
  })
  .strict();
export type ProvisionDto = z.infer<typeof provisionSchema>;

export interface ProvisionInput {
  name: string;
  locationName: string;
  ownerName: string;
  ownerEmail: string;
  commercialStatus: 'PROSPECT' | 'TRIAL' | 'ACTIVE';
  modules: string[];
  /** Created automatically after a verified payment: no temporary password is ever issued; the owner claims the account. */
  auto?: boolean;
}

/** Shown to staff when a step failed for a reason that needs a person (and that a blind retry would not fix). */
export const TRANSIENT_FAILURE_MESSAGE = 'Something went wrong on our side. Try again; nothing is duplicated.';

export type StepId = 'business' | 'location' | 'owner' | `module:${string}` | 'commercial' | 'onboarding' | 'finalize';
export type StepState = 'pending' | 'running' | 'done' | 'failed';

export interface ProvisionView {
  status: 'RUNNING' | 'FAILED' | 'DONE';
  steps: { id: StepId; state: StepState }[];
  failedStep: StepId | null;
  /** A short, safe message about the failure (never a secret). */
  error: string | null;
  businessId: string | null;
  ownerEmail: string;
  /** Present ONCE, in the response of the run that issued it. Never stored, never logged. */
  credentials?: { email: string; password: string };
}

export const stepsFor = (modules: string[]): StepId[] => [
  'business',
  'location',
  'owner',
  ...modules.map((m) => `module:${m}` as StepId),
  'commercial',
  'onboarding',
  'finalize',
];

const SAFE = {
  lower: 'abcdefghjkmnpqrstuvwxyz',
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  digit: '23456789',
  symbol: '#$%&*+-=?@',
};

/** A readable 16-character password with every character class, from crypto randomness. */
export function generateTempPassword(length = 16): string {
  const pick = (set: string) => set[randomInt(set.length)] as string;
  const all = SAFE.lower + SAFE.upper + SAFE.digit + SAFE.symbol;
  const chars = [pick(SAFE.lower), pick(SAFE.upper), pick(SAFE.digit), pick(SAFE.symbol)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j] as string, chars[i] as string];
  }
  return chars.join('');
}
