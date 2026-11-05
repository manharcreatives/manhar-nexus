import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Cashfree signs each webhook: base64(HMAC-SHA256(secret, x-webhook-timestamp + rawBody)), sent in
 * x-webhook-signature. Cashfree's own pages disagree on whether a "." sits between timestamp and body (the
 * payloads-and-signatures page concatenates directly; the payments/webhooks page shows a dot), so both forms are
 * accepted. This costs nothing in security: forging either needs the secret.
 *
 * The RAW body must be used, never re-serialised JSON.
 */
export function expectedSignatures(timestamp: string, rawBody: string, secret: string): string[] {
  return [`${timestamp}${rawBody}`, `${timestamp}.${rawBody}`].map((signed) =>
    createHmac('sha256', secret).update(signed).digest('base64'),
  );
}

export function verifyWebhookSignature(input: {
  timestamp: string | undefined;
  signature: string | undefined;
  rawBody: string | undefined;
  secret: string;
}): boolean {
  const { timestamp, signature, rawBody, secret } = input;
  if (!timestamp || !signature || rawBody === undefined || !secret) return false;
  const given = Buffer.from(signature);
  return expectedSignatures(timestamp, rawBody, secret).some((expected) => {
    const want = Buffer.from(expected);
    return want.length === given.length && timingSafeEqual(want, given);
  });
}
