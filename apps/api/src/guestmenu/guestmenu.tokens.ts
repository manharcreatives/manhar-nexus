import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Table QR token: 24 random bytes = 192 bits, base64url = exactly 32 characters. */
export const TABLE_TOKEN_REGEX = /^[A-Za-z0-9_-]{32}$/;
/** Guest device token: 32 random bytes = 256 bits, base64url = 43 characters. */
export const GUEST_TOKEN_REGEX = /^[A-Za-z0-9_-]{43}$/;
/** Client Idempotency-Key for guest orders (any opaque id of a sane length; a UUID is the usual case). */
export const IDEMPOTENCY_KEY_REGEX = /^[A-Za-z0-9_-]{8,100}$/;

export const newTableToken = (): string => randomBytes(24).toString('base64url');
export const newGuestToken = (): string => randomBytes(32).toString('base64url');

export const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');

/** Constant-time string comparison (length is not secret here: both sides are fixed-format tokens). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Deterministic UUID (version-5 layout) from a guest token id + the client's Idempotency-Key. service_request.idempotencyKey
 * is a UUID unique per business, so the same guest retrying the same key lands on the same row, while two guests (or two
 * businesses) can never collide on a key.
 */
export function idempotencyUuid(guestTokenId: string, clientKey: string): string {
  const h = createHash('sha256').update(`guestmenu:${guestTokenId}:${clientKey}`).digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Deterministic JSON (sorted keys) so equal payloads hash equally. */
export function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const o = value as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
    .join(',')}}`;
}

/** Short stable fingerprint (base64url, 16 chars) used for ETags. */
export const fingerprint = (value: unknown): string =>
  createHash('sha256').update(stable(value)).digest('base64url').slice(0, 16);

/** Weak ETag value for a fingerprint. */
export const weakEtag = (fp: string): string => `W/"${fp}"`;

/** True when an `If-None-Match` header lists the given ETag (weak comparison, `*` matches anything). */
export function etagMatches(ifNoneMatch: string | undefined, etag: string): boolean {
  if (!ifNoneMatch) return false;
  const norm = (v: string): string => v.trim().replace(/^W\//, '');
  const want = norm(etag);
  return ifNoneMatch.split(',').some((c) => {
    const t = c.trim();
    return t === '*' || norm(t) === want;
  });
}
