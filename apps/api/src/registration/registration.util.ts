import { createHmac, randomInt } from 'node:crypto';

/**
 * Reference-code alphabet: 30 characters, no 0/O, 1/I/L or U, so a code read out over
 * the phone or typed from a screenshot is never ambiguous.
 */
export const REFERENCE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
export const REFERENCE_PREFIX = 'NX-';
export const REFERENCE_SUFFIX_LENGTH = 6;
export const REFERENCE_CODE_PATTERN = /^NX-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/;

/** Visitor-facing reference, e.g. "NX-7K2Q9M". `rand` is injectable for tests. */
export function generateReferenceCode(
  rand: (maxExclusive: number) => number = (n) => randomInt(n),
): string {
  let suffix = '';
  for (let i = 0; i < REFERENCE_SUFFIX_LENGTH; i++) {
    suffix += REFERENCE_ALPHABET[rand(REFERENCE_ALPHABET.length)];
  }
  return `${REFERENCE_PREFIX}${suffix}`;
}

/** Strips the IPv4-mapped IPv6 prefix so `::ffff:1.2.3.4` and `1.2.3.4` hash identically. */
export function normaliseIp(ip: string): string {
  const trimmed = ip.trim().toLowerCase();
  return trimmed.startsWith('::ffff:') && trimmed.includes('.') ? trimmed.slice(7) : trimmed;
}

/**
 * HMAC-SHA256(ip, secret) as hex. Keyed so the stored value cannot be reversed by
 * brute-forcing the IPv4 space without the server secret. Returns null when the
 * request carries no usable IP (the DB-backed caps then simply cannot apply).
 */
export function hashIp(ip: string | undefined | null, secret: string): string | null {
  if (!ip || ip.trim() === '') return null;
  return createHmac('sha256', secret).update(normaliseIp(ip)).digest('hex');
}

export const USER_AGENT_MAX = 200;

/** Truncates the User-Agent to its stored length; empty or missing becomes null. */
export function truncateUserAgent(ua: string | undefined | null): string | null {
  if (!ua) return null;
  const trimmed = ua.trim();
  return trimmed === '' ? null : trimmed.slice(0, USER_AGENT_MAX);
}
