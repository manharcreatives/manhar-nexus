import { z } from 'zod';

export const PLAN_KEYS = ['counter', 'floor', 'pass', 'many-doors', 'not-sure'] as const;
export const BILLING_CYCLES = ['monthly', 'yearly'] as const;
export const BUSINESS_KINDS = [
  'restaurant',
  'cafe',
  'bakery',
  'cloud-kitchen',
  'hotel',
  'food-court',
  'other',
] as const;

/**
 * Versions of the Terms + Privacy text a visitor may have consented to. Pinned
 * server-side: when the legal text changes, add the new version here (and ship the
 * web form with it); unknown values are rejected so a stale or forged consent
 * version is never recorded as valid.
 */
export const CONSENT_VERSIONS = ['2026-10-31'] as const;
export const CURRENT_CONSENT_VERSION = CONSENT_VERSIONS[CONSENT_VERSIONS.length - 1];

/** Minimum time (ms) a human needs to fill the form; faster submissions are bots. */
export const MIN_FILL_MS = 2_000;

// Control characters are never legitimate in these fields.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const text = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((v) => !CONTROL_CHARS.test(v), { message: 'contains invalid characters' });

/** Digits with an optional leading +, spaces/dashes/brackets tolerated: 7-20 chars as typed. */
const phone = z
  .string()
  .trim()
  .min(7)
  .max(20)
  .regex(/^\+?[0-9][0-9\s\-()]{5,18}[0-9]$/, { message: 'invalid phone number' });

/**
 * Public registration request. `.strict()`: unknown keys are a 400, so the contract
 * cannot be probed or polluted. `website` is the honeypot (hidden field, must be
 * empty for humans); `startedAt` is the client's form-open time (ms epoch).
 */
export const createRegistrationSchema = z
  .object({
    restaurantName: text(2, 120),
    contactName: text(2, 120),
    email: z.string().trim().toLowerCase().email().max(254),
    phone,
    city: text(2, 80),
    businessKind: z.enum(BUSINESS_KINDS),
    outlets: z.number().int().min(1).max(500),
    planKey: z.enum(PLAN_KEYS),
    billingCycle: z.enum(BILLING_CYCLES),
    message: z
      .string()
      .trim()
      .max(1000)
      .refine((v) => !CONTROL_CHARS.test(v), { message: 'contains invalid characters' })
      .optional(),
    consent: z.literal(true),
    consentVersion: z.enum(CONSENT_VERSIONS),
    // Honeypot: no length limit here on purpose, so a bot filling it with anything
    // still gets the uniform 202 (not a distinguishable 400). Truncated before use.
    website: z.string().optional(),
    startedAt: z.number().int().nonnegative().max(8_640_000_000_000_000).optional(),
  })
  .strict();
export type CreateRegistrationDto = z.infer<typeof createRegistrationSchema>;

// ── Platform-side (internal/registrations) ───────────────────────────────────

export const REGISTRATION_STATUSES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'CONVERTED',
  'REJECTED',
  'SPAM',
] as const;
export type RegistrationStatusKey = (typeof REGISTRATION_STATUSES)[number];

export const listRegistrationsQuerySchema = z
  .object({
    status: z.enum(REGISTRATION_STATUSES).optional(),
    skip: z.coerce.number().int().min(0).default(0),
    take: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
export type ListRegistrationsQuery = z.infer<typeof listRegistrationsQuerySchema>;

/**
 * Status transitions staff may make. SPAM and REJECTED can be reopened to NEW (a
 * false positive from the honeypot/time-trap is recoverable); CONVERTED is terminal
 * (it means a tenant exists; undo that in the Onboarding/Commercial screens).
 */
export const REGISTRATION_TRANSITIONS: Record<RegistrationStatusKey, readonly RegistrationStatusKey[]> =
  {
    NEW: ['CONTACTED', 'QUALIFIED', 'CONVERTED', 'REJECTED', 'SPAM'],
    CONTACTED: ['NEW', 'QUALIFIED', 'CONVERTED', 'REJECTED', 'SPAM'],
    QUALIFIED: ['NEW', 'CONTACTED', 'CONVERTED', 'REJECTED', 'SPAM'],
    CONVERTED: [],
    REJECTED: ['NEW', 'CONTACTED', 'QUALIFIED', 'SPAM'],
    SPAM: ['NEW', 'REJECTED'],
  };

export const updateRegistrationSchema = z
  .object({
    status: z.enum(REGISTRATION_STATUSES).optional(),
    assignedTo: z.string().trim().min(1).max(120).nullable().optional(),
    internalNotes: z.string().trim().max(4000).nullable().optional(),
    /** Set together with status CONVERTED once the workspace exists. */
    businessId: z.string().uuid().nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'at least one field is required' });
export type UpdateRegistrationDto = z.infer<typeof updateRegistrationSchema>;

/** The uniform public acknowledgement. Never echoes any input. */
export interface RegistrationAck {
  ok: true;
  referenceCode: string;
}
