import type { RegistrationErrors, RegistrationFieldName, RegistrationPayload } from '../content';

/** Path of the public lead-capture endpoint (apps/api: POST /public/registrations, no auth, throttled per IP). */
export const REGISTRATION_PATH = '/public/registrations';

/** Same ceiling the form promises: give up after 15 seconds and offer the WhatsApp / email fallback. */
export const REQUEST_TIMEOUT_MS = 15_000;

export type SubmitFailureKind = 'rate-limit' | 'already-received' | 'network' | 'server' | 'validation';

export type SubmitResult =
  | { readonly ok: true; readonly referenceCode: string }
  | {
      readonly ok: false;
      readonly kind: SubmitFailureKind;
      readonly status?: number;
      /** Only for kind 'validation': messages keyed by form field when the API names the field. */
      readonly fieldErrors?: RegistrationErrors;
    };

export interface SubmitOptions {
  /** Injected in tests. Defaults to the global fetch. */
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  /** Overrides the API base (tests). */
  readonly baseUrl?: string;
}

/**
 * API base URL, matching the rest of the app (auth/api.ts uses VITE_API_URL, default http://localhost:3000 in
 * dev). In production builds VITE_API_URL is '/api' (Caddy strips the prefix); a build without the variable
 * also falls back to '/api'. In `vite dev` without the variable we call the API origin directly, exactly like
 * auth/api.ts, because the dev proxy forwards '/api/...' without stripping the prefix.
 */
export function apiBase(): string {
  const configured = import.meta.env.VITE_API_URL as string | undefined;
  const raw = configured ?? (import.meta.env.DEV ? 'http://localhost:3000' : '/api');
  return raw.replace(/\/+$/, '');
}

const KNOWN_FIELDS: readonly RegistrationFieldName[] = [
  'restaurantName',
  'contactName',
  'phone',
  'email',
  'city',
  'businessKind',
  'outlets',
  'planKey',
  'billingCycle',
  'message',
  'consent',
];

/** Reference codes look like NX-7K2Q9M; accept any short URL-safe code so a format change cannot break the success state. */
const REFERENCE_RE = /^[A-Za-z0-9][A-Za-z0-9-]{3,31}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Pull `error.details.issues[{path,message}]` from the API's standard 400 envelope. Never echoes submitted values. */
export function fieldErrorsFromBody(body: unknown): RegistrationErrors | undefined {
  if (!isRecord(body) || !isRecord(body.error) || !isRecord(body.error.details)) return undefined;
  const issues = body.error.details.issues;
  if (!Array.isArray(issues)) return undefined;
  const out: { -readonly [K in RegistrationFieldName]?: string } = {};
  for (const issue of issues as unknown[]) {
    if (!isRecord(issue)) continue;
    const path = typeof issue.path === 'string' ? issue.path : '';
    const field = KNOWN_FIELDS.find((f) => f === path);
    if (field && out[field] === undefined) out[field] = 'Please check this field.';
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return (await res.json()) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * POST the registration. Plain fetch, JSON, no cookies, 15 s timeout. Resolves (never rejects) with a typed
 * result so the form can always show either the reference code or a calm failure with the Tier-0 fallback.
 * Nothing here logs: the payload contains personal data.
 */
export async function submitRegistration(payload: RegistrationPayload, options: SubmitOptions = {}): Promise<SubmitResult> {
  const doFetch = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const url = `${(options.baseUrl ?? apiBase()).replace(/\/+$/, '')}${REGISTRATION_PATH}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);

  try {
    const res = await doFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });

    if (res.status === 429) {
      // Two different 429s: this network sent too many requests, or this email already has requests on file.
      const body = await readJson(res);
      const details = isRecord(body) && isRecord(body.error) && isRecord(body.error.details) ? body.error.details : undefined;
      return { ok: false, kind: details?.kind === 'email' ? 'already-received' : 'rate-limit', status: 429 };
    }

    if (res.status === 400) {
      const fieldErrors = fieldErrorsFromBody(await readJson(res));
      return { ok: false, kind: 'validation', status: 400, ...(fieldErrors ? { fieldErrors } : {}) };
    }

    if (res.ok) {
      const body = await readJson(res);
      const code = isRecord(body) && typeof body.referenceCode === 'string' ? body.referenceCode : '';
      if (REFERENCE_RE.test(code)) return { ok: true, referenceCode: code };
      return { ok: false, kind: 'server', status: res.status };
    }

    return { ok: false, kind: 'server', status: res.status };
  } catch {
    // Network error, CORS failure, offline, or our own timeout abort.
    return { ok: false, kind: 'network' };
  } finally {
    clearTimeout(timer);
  }
}
