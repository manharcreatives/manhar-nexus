import {
  DEFAULT_REGISTRATION_RATE_LIMIT,
  DEFAULT_REGISTRATION_RATE_TTL_MS,
} from '../config/configuration';

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** Max POSTs per IP per window on the public endpoint (env REGISTRATION_RATE_LIMIT, default 5). */
export function registrationRateLimit(): number {
  return positiveInt(process.env.REGISTRATION_RATE_LIMIT, DEFAULT_REGISTRATION_RATE_LIMIT);
}

/** Window length in ms (env REGISTRATION_RATE_TTL_MS, default 1 hour). */
export function registrationRateTtlMs(): number {
  return positiveInt(process.env.REGISTRATION_RATE_TTL_MS, DEFAULT_REGISTRATION_RATE_TTL_MS);
}
