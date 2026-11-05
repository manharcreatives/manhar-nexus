import { CONTACT } from './nav';
import type {
  BeginMode,
  BillingCycle,
  BusinessKind,
  ConsentSegment,
  RegisterPlanKey,
  RegistrationErrors,
  RegistrationFailureKind,
  RegistrationField,
  RegistrationFieldName,
  RegistrationFormValues,
  RegistrationPayload,
  SectionHeader,
  SelectOption,
  TextLink,
} from './types';

/** Version of the consent wording the visitor agreed to. Bump when consent text or policies change. */
export const consentVersion = '2026-10-31';
export const CONSENT_VERSION = consentVersion;

export const REGISTER_HEADER: SectionHeader = {
  eyebrow: 'REGISTER YOUR RESTAURANT',
  headline: {
    text: 'Tell us about your restaurant. We’ll take it from here.',
    accent: 'restaurant',
  },
  subhead:
    'Two minutes now. A person replies the same working day with your payment link, pilot or demo.',
};

/** Side panel: “What happens next”. */
export const REGISTER_NEXT_STEPS: readonly string[] = [
  'We read your request.',
  'We confirm the plan with you.',
  'You pay securely online (Cashfree).',
  'We set up your Business Workspace.',
  'You open your first table.',
];
export const REGISTER_NEXT_TITLE = 'What happens next';

/* ───────────────────────────── options ───────────────────────────── */

export const BUSINESS_KIND_OPTIONS: readonly SelectOption<BusinessKind>[] = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'cafe', label: 'Café' },
  { value: 'food-court', label: 'Food court' },
  { value: 'other', label: 'Other' },
];

export const PLAN_OPTIONS: readonly SelectOption<RegisterPlanKey>[] = [
  { value: 'counter', label: 'Counter' },
  { value: 'floor', label: 'Floor' },
  { value: 'pass', label: 'Pass' },
  { value: 'many-doors', label: 'Many Doors (4+ outlets)' },
  { value: 'not-sure', label: 'Not sure' },
];

export const BILLING_OPTIONS: readonly SelectOption<BillingCycle>[] = [
  { value: 'yearly', label: 'Yearly (2 months free)' },
  { value: 'monthly', label: 'Monthly' },
];

export const BEGIN_OPTIONS: readonly SelectOption<BeginMode>[] = [
  { value: 'pay-and-start', label: 'Pay and start' },
  { value: 'pilot', label: '14-day pilot (we’ll call you first)' },
  { value: 'demo', label: 'Live demo first' },
];

/* ───────────────────────────── fields ───────────────────────────── */

export const REGISTRATION_FIELDS: Readonly<Record<RegistrationFieldName, RegistrationField>> = {
  restaurantName: {
    name: 'restaurantName',
    label: 'Restaurant name',
    placeholder: 'e.g. Shree Ram Dining',
    help: 'Required. Up to 120 characters.',
    required: true,
    maxLength: 120,
  },
  contactName: {
    name: 'contactName',
    label: 'Your name',
    placeholder: 'e.g. Rajesh Patel',
    help: 'Required.',
    required: true,
    maxLength: 120,
  },
  phone: {
    name: 'phone',
    label: 'Mobile number',
    placeholder: '98765 43210',
    help: '10-digit Indian mobile number. We use this to reach you on WhatsApp.',
    required: true,
    maxLength: 16,
  },
  email: {
    name: 'email',
    label: 'Email',
    placeholder: 'you@yourrestaurant.in',
    help: 'Required. Your payment link and invoice go here.',
    required: true,
    maxLength: 254,
  },
  city: {
    name: 'city',
    label: 'City',
    placeholder: 'e.g. Visnagar',
    help: 'Required.',
    required: true,
    maxLength: 80,
  },
  businessKind: {
    name: 'businessKind',
    label: 'Type of business',
    placeholder: 'Choose one',
    help: 'Select the closest match.',
    required: true,
  },
  outlets: {
    name: 'outlets',
    label: 'Number of outlets',
    placeholder: '1',
    help: '1 to 500.',
    required: true,
  },
  planKey: {
    name: 'planKey',
    label: 'Plan you’re considering',
    placeholder: 'Not sure',
    help: 'Preselected from the pricing button.',
    required: true,
  },
  billingCycle: {
    name: 'billingCycle',
    label: 'Billing',
    placeholder: 'Yearly',
    help: 'Yearly is the default.',
    required: true,
  },
  begin: {
    name: 'begin',
    label: 'How would you like to begin?',
    placeholder: 'Pay and start',
    help: 'Required.',
    required: true,
  },
  code: {
    name: 'code',
    label: 'Founding or referral code (optional)',
    placeholder: 'e.g. FOUNDING26',
    help: 'Optional.',
    required: false,
    maxLength: 40,
  },
  message: {
    name: 'message',
    label: 'Anything we should know? (optional)',
    placeholder: 'Printers you use, your menu size, your questions…',
    help: 'Up to 1,000 characters.',
    required: false,
    maxLength: 1000,
  },
  consent: {
    name: 'consent',
    label: 'Consent',
    placeholder: '',
    help: '',
    required: true,
  },
};

/** Render order of the visible fields. */
export const REGISTRATION_FIELD_ORDER: readonly RegistrationFieldName[] = [
  'restaurantName',
  'contactName',
  'phone',
  'email',
  'city',
  'businessKind',
  'outlets',
  'message',
];

export const MANY_DOORS_NOTE =
  'Four or more outlets? Choose Many Doors — central menu and cross-outlet comparison aren’t built yet, and you would help us decide the order.';
export const MANY_DOORS_THRESHOLD = 4;

/* ───────────────────────────── consent ───────────────────────────── */

/** Required checkbox. Render each segment; segments with `href` are links. */
export const CONSENT_SEGMENTS: readonly ConsentSegment[] = [
  { text: 'I agree to the ' },
  { text: 'Terms & Conditions', href: '/terms' },
  { text: ', ' },
  { text: 'Privacy Policy', href: '/privacy' },
  { text: ' and ' },
  { text: 'Refund & Cancellation Policy', href: '/refund-policy' },
  {
    text: ', and I’m happy for Manhar Creatives to contact me about this request by phone, WhatsApp and email.',
  },
];

/** Plain-text version of the consent line (stored/audited with consentVersion). */
export const CONSENT_TEXT = CONSENT_SEGMENTS.map((s) => s.text).join('');

export const UPDATES_LABEL = 'Send me occasional product updates. I can unsubscribe at any time.';
export const CONSENT_SMALL_PRINT =
  'Manhar Creatives will use these details to respond to your request and set up your account, as described in the Privacy Policy. Payment is made later, on a secure Cashfree page — we never see your card or UPI PIN.';

/* ───────────────────────────── buttons, microcopy ───────────────────────────── */

export const SUBMIT_LABEL = 'Send my request';
export const SUBMIT_LOADING_LABEL = 'Sending…';
export const SUBMIT_MICROCOPY =
  'We’ll never sell or share your details. You can ask us to delete them any time.';
export const FALLBACK_LINE = 'Prefer to talk?';
export const FALLBACK_WHATSAPP_LABEL = 'WhatsApp us';
export const FALLBACK_EMAIL_LABEL = 'info@manharcreatives.com';
export const FALLBACK_BUTTONS = {
  whatsapp: 'Send this on WhatsApp',
  email: 'Email these details',
} as const;

/* ───────────────────────────── validation + errors ───────────────────────────── */

export const VALIDATION_MESSAGES = {
  required: (label: string): string => `Please fill in ${label.toLowerCase()}.`,
  email: 'That email doesn’t look right. Please check it.',
  phone: 'Enter a 10-digit Indian mobile number.',
  outlets: 'Enter a number from 1 to 500.',
  consent: 'Please accept the terms to continue.',
  tooShort: (label: string): string => `${label} needs at least 2 characters.`,
} as const;

export const FAILURE_MESSAGES: Readonly<Record<RegistrationFailureKind, string>> = {
  'rate-limit':
    'We’ve received several requests from your network. Please wait a little and try again, or WhatsApp us.',
  network:
    'We couldn’t reach the server. Check your connection and try again — or WhatsApp us your details.',
  server:
    'Something went wrong on our side. Your request was not lost if you see a reference; otherwise please try again or write to info@manharcreatives.com.',
  // INTEGRATION POINT: until Cashfree is live, the success state also shows this line.
  interim: 'We’ll send your payment link by WhatsApp or email within one working day.',
};

export interface RegistrationSuccess {
  readonly title: string;
  /** Text before the reference. */
  readonly lead: string;
  readonly referenceLabel: string;
  readonly reference: string;
  /** Text after the reference. */
  readonly tail: string;
  readonly interim: string;
  readonly secondary: readonly TextLink[];
  readonly secondaryHint: string;
}

/** Success state. Render lead + <strong>reference</strong> + tail. */
export function registrationSuccess(contactName: string, referenceCode: string): RegistrationSuccess {
  const name = contactName.trim();
  return {
    title: 'Request received.',
    lead: `Thank you${name ? `, ${name}` : ''}. Your reference is `,
    referenceLabel: 'Reference',
    reference: referenceCode,
    tail: '. Someone from Manhar Creatives will message you on WhatsApp or email within one working day with the next step. Keep this reference handy.',
    interim: FAILURE_MESSAGES.interim,
    secondary: [{ text: 'Read how a night runs →', href: '/#why' }],
    secondaryHint: 'While you wait: add info@manharcreatives.com to your contacts so our email doesn’t land in spam.',
  };
}

/* ───────────────────────────── defaults and pure helpers ───────────────────────────── */

export const DEFAULT_FORM_VALUES: RegistrationFormValues = {
  restaurantName: '',
  contactName: '',
  phone: '',
  email: '',
  city: '',
  businessKind: 'restaurant',
  outlets: '1',
  planKey: 'not-sure',
  billingCycle: 'yearly',
  begin: 'pay-and-start',
  code: '',
  message: '',
  consent: false,
  updates: false,
  website: '',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Returns the 10-digit Indian mobile number, or null when the input is not one. */
export function normalizeIndianMobile(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/** Validate the whole form. An empty object means valid. Messages are ready to render. */
export function validateRegistration(values: RegistrationFormValues): RegistrationErrors {
  const errors: { -readonly [K in RegistrationFieldName]?: string } = {};
  const f = REGISTRATION_FIELDS;

  const text = (name: 'restaurantName' | 'contactName' | 'city'): void => {
    const v = values[name].trim();
    if (v.length === 0) errors[name] = VALIDATION_MESSAGES.required(f[name].label);
    else if (v.length < 2) errors[name] = VALIDATION_MESSAGES.tooShort(f[name].label);
  };
  text('restaurantName');
  text('contactName');
  text('city');

  if (values.phone.trim().length === 0) errors.phone = VALIDATION_MESSAGES.required(f.phone.label);
  else if (normalizeIndianMobile(values.phone) === null) errors.phone = VALIDATION_MESSAGES.phone;

  if (values.email.trim().length === 0) errors.email = VALIDATION_MESSAGES.required(f.email.label);
  else if (!EMAIL_RE.test(values.email.trim())) errors.email = VALIDATION_MESSAGES.email;

  const outlets = Number(values.outlets);
  if (values.outlets.trim().length === 0 || !Number.isInteger(outlets) || outlets < 1 || outlets > 500) {
    errors.outlets = VALIDATION_MESSAGES.outlets;
  }

  if (!values.consent) errors.consent = VALIDATION_MESSAGES.consent;
  return errors;
}

const labelOf = <V extends string>(options: readonly SelectOption<V>[], value: V): string =>
  options.find((o) => o.value === value)?.label ?? value;

/**
 * Registration details that the strict API schema has no field for (how to begin, code,
 * updates opt-in) are folded into `message` so nothing is lost. The result never exceeds 1,000 characters.
 */
export function composeMessage(values: RegistrationFormValues): string {
  const extras: string[] = [];
  if (values.begin === 'demo') extras.push(`Begin: ${labelOf(BEGIN_OPTIONS, values.begin)}`);
  if (values.code.trim()) extras.push(`Code: ${values.code.trim()}`);
  const prefix = extras.map((e) => `[${e}]`).join(' ');
  const note = values.message.trim();
  if (!prefix) return note.slice(0, 1000);
  if (!note) return prefix;
  const room = Math.max(0, 1000 - prefix.length - 2);
  return `${prefix}\n\n${note.slice(0, room)}`.trimEnd();
}

/** Body for POST /public/registrations. Call only after validateRegistration returns no errors. */
export function toRegistrationPayload(
  values: RegistrationFormValues,
  startedAt?: number,
): RegistrationPayload {
  const mobile = normalizeIndianMobile(values.phone);
  const message = composeMessage(values);
  return {
    restaurantName: values.restaurantName.trim(),
    contactName: values.contactName.trim(),
    email: values.email.trim(),
    phone: mobile ? `+91${mobile}` : values.phone.trim(),
    city: values.city.trim(),
    businessKind: values.businessKind,
    outlets: Math.round(Number(values.outlets)),
    planKey: values.planKey,
    billingCycle: values.billingCycle,
    ...(message ? { message } : {}),
    consent: true,
    consentVersion,
    website: values.website,
    ...(startedAt !== undefined ? { startedAt } : {}),
  };
}

type Summarisable = Partial<RegistrationFormValues>;

function summaryLines(values: Summarisable, referenceCode?: string): string[] {
  const lines: string[] = [];
  const add = (label: string, value: string | undefined): void => {
    if (value && value.trim()) lines.push(`${label}: ${value.trim()}`);
  };
  add('Restaurant', values.restaurantName);
  add('Name', values.contactName);
  add('Mobile', values.phone);
  add('Email', values.email);
  add('City', values.city);
  if (values.businessKind) add('Type', labelOf(BUSINESS_KIND_OPTIONS, values.businessKind));
  add('Outlets', values.outlets);
  add('Notes', values.message);
  add('Reference', referenceCode);
  return lines;
}

const GREETING = 'Hello Manhar Nexus team,';
const ASK = 'I’d like to register my restaurant.';

/** Plain-text request, shared by the WhatsApp and mailto fallbacks. */
export function buildRequestText(values: Summarisable, referenceCode?: string): string {
  return [GREETING, ASK, '', ...summaryLines(values, referenceCode), '', 'Thank you.'].join('\n');
}

/** wa.me link with the request prefilled. Pure: safe to call during render. */
export function buildWhatsAppUrl(values: Summarisable = {}, referenceCode?: string): string {
  return `${CONTACT.whatsappUrl}?text=${encodeURIComponent(buildRequestText(values, referenceCode))}`;
}

/** mailto: link with the request prefilled. */
export function buildMailtoUrl(values: Summarisable = {}, referenceCode?: string): string {
  const subject = values.restaurantName?.trim()
    ? `Register ${values.restaurantName.trim()} on Manhar Nexus`
    : 'Register my restaurant on Manhar Nexus';
  return `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    buildRequestText(values, referenceCode),
  )}`;
}

export interface RegisterIntent {
  readonly plan?: RegisterPlanKey;
  readonly cycle?: BillingCycle;
  readonly begin?: BeginMode;
}

const PLAN_VALUES = PLAN_OPTIONS.map((o) => o.value);
const BEGIN_VALUES = BEGIN_OPTIONS.map((o) => o.value);

/**
 * Parse '#register?plan=floor&cycle=yearly&begin=demo' (or the query part alone).
 * Unknown values are ignored.
 */
export function parseRegisterHash(hash: string): RegisterIntent {
  const q = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const params = new URLSearchParams(q);
  const plan = params.get('plan');
  const cycle = params.get('cycle');
  const begin = params.get('begin');
  return {
    ...(plan && (PLAN_VALUES as readonly string[]).includes(plan) ? { plan: plan as RegisterPlanKey } : {}),
    ...(cycle === 'monthly' || cycle === 'yearly' ? { cycle } : {}),
    ...(begin && (BEGIN_VALUES as readonly string[]).includes(begin) ? { begin: begin as BeginMode } : {}),
  };
}
