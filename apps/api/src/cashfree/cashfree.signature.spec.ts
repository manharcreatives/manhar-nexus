import { createHmac } from 'node:crypto';
import { expectedSignatures, verifyWebhookSignature } from './cashfree.signature';

const SECRET = 'test-secret-not-real';
const TS = '1793900000000';
const BODY = '{"type":"PAYMENT_LINK_EVENT","data":{"link_id":"NX-ABC123-ab12cd34","link_status":"PAID"}}';
const sign = (signed: string, secret = SECRET): string => createHmac('sha256', secret).update(signed).digest('base64');

describe('verifyWebhookSignature', () => {
  it('accepts base64(HMAC-SHA256(secret, timestamp + rawBody))', () => {
    expect(verifyWebhookSignature({ timestamp: TS, signature: sign(`${TS}${BODY}`), rawBody: BODY, secret: SECRET })).toBe(true);
  });

  it('also accepts the dotted form some Cashfree pages show (timestamp + "." + rawBody)', () => {
    expect(verifyWebhookSignature({ timestamp: TS, signature: sign(`${TS}.${BODY}`), rawBody: BODY, secret: SECRET })).toBe(true);
  });

  it('rejects a body that was changed after signing, even by one character', () => {
    const signature = sign(`${TS}${BODY}`);
    expect(verifyWebhookSignature({ timestamp: TS, signature, rawBody: BODY.replace('PAID', 'PAIZ'), secret: SECRET })).toBe(false);
  });

  it('rejects a body re-serialised with different spacing (the raw bytes are what is signed)', () => {
    const signature = sign(`${TS}${BODY}`);
    const pretty = JSON.stringify(JSON.parse(BODY), null, 2);
    expect(verifyWebhookSignature({ timestamp: TS, signature, rawBody: pretty, secret: SECRET })).toBe(false);
  });

  it('rejects a different timestamp, a different secret, and a signature of the wrong length', () => {
    const signature = sign(`${TS}${BODY}`);
    expect(verifyWebhookSignature({ timestamp: '1793900000001', signature, rawBody: BODY, secret: SECRET })).toBe(false);
    expect(verifyWebhookSignature({ timestamp: TS, signature, rawBody: BODY, secret: 'other-secret' })).toBe(false);
    expect(verifyWebhookSignature({ timestamp: TS, signature: 'abc', rawBody: BODY, secret: SECRET })).toBe(false);
  });

  it('rejects when anything is missing, and never throws on garbage', () => {
    const signature = sign(`${TS}${BODY}`);
    expect(verifyWebhookSignature({ timestamp: undefined, signature, rawBody: BODY, secret: SECRET })).toBe(false);
    expect(verifyWebhookSignature({ timestamp: TS, signature: undefined, rawBody: BODY, secret: SECRET })).toBe(false);
    expect(verifyWebhookSignature({ timestamp: TS, signature, rawBody: undefined, secret: SECRET })).toBe(false);
    expect(verifyWebhookSignature({ timestamp: TS, signature, rawBody: BODY, secret: '' })).toBe(false);
    expect(verifyWebhookSignature({ timestamp: TS, signature: '\u0000￿', rawBody: BODY, secret: SECRET })).toBe(false);
  });

  it('an empty body is signed like any other', () => {
    expect(verifyWebhookSignature({ timestamp: TS, signature: sign(TS), rawBody: '', secret: SECRET })).toBe(true);
  });
});

describe('expectedSignatures', () => {
  it('returns the plain and dotted forms', () => {
    expect(expectedSignatures(TS, BODY, SECRET)).toEqual([sign(`${TS}${BODY}`), sign(`${TS}.${BODY}`)]);
  });
});
