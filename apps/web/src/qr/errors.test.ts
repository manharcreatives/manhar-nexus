import { describe, expect, it } from 'vitest';
import i18n from '../i18n';
import { describeQrError, isOrderConflict, isOrderingLocked, isVersionConflict } from './errors';

const t = i18n.t.bind(i18n);
const err = (status: number, code?: string, message = 'x') => Object.assign(new Error(message), { status, code });

describe('describeQrError', () => {
  it('maps the API error codes', () => {
    expect(describeQrError(err(409, 'VERSION_CONFLICT'), t, 'qr.errors.toggle')).toBe(t('qr.errors.versionConflict'));
    expect(describeQrError(err(409, 'ORDERING_LOCKED'), t, 'qr.errors.toggle')).toBe(t('qr.errors.orderingLocked'));
    expect(describeQrError(err(413, 'PAYLOAD_TOO_LARGE', 'Request failed (413)'), t, 'qr.photos.uploadFailed')).toBe(t('qr.errors.tooLarge'));
    expect(describeQrError(err(415, 'UNSUPPORTED_MEDIA', 'Request failed (415)'), t, 'qr.photos.uploadFailed')).toBe(t('qr.errors.unsupportedMedia'));
    expect(describeQrError(err(503, 'MEDIA_NOT_CONFIGURED'), t, 'qr.photos.uploadFailed')).toBe(t('qr.errors.mediaNotConfigured'));
    expect(describeQrError(err(429, 'RATE_LIMITED'), t, 'qr.photos.uploadFailed')).toBe(t('qr.errors.rateLimited'));
  });
  it('shows the API reason for a rejected picture (too small, animated, rotated by hidden data ...)', () => {
    expect(describeQrError(err(415, 'UNSUPPORTED_MEDIA', 'The picture is too small (at least 64px per side).'), t, 'qr.photos.uploadFailed')).toBe('The picture is too small (at least 64px per side).');
    expect(describeQrError(err(413, 'PAYLOAD_TOO_LARGE', 'The picture is larger than 6 MB.'), t, 'qr.photos.uploadFailed')).toBe('The picture is larger than 6 MB.');
    // multer's own size cap: 413 with code ERROR and an English technical text
    expect(describeQrError(err(413, 'ERROR', 'File too large'), t, 'qr.photos.uploadFailed')).toBe(t('qr.errors.tooLarge'));
  });
  it('shows the API message of a 400 validation (written for people)', () => {
    expect(describeQrError(err(400, 'VALIDATION', 'The order has no items left. Reject it instead.'), t, 'qr.orders.acceptFailed')).toBe('The order has no items left. Reject it instead.');
  });
  it('falls back to the shared mapper and the context sentence', () => {
    expect(describeQrError(new Error('offline'), t, 'qr.photos.uploadFailed')).toBe(t('restaurant.errors.network'));
    expect(describeQrError(err(500), t, 'qr.photos.uploadFailed')).toBe(t('qr.photos.uploadFailed'));
  });
  it('predicates', () => {
    expect(isVersionConflict(err(409, 'VERSION_CONFLICT'))).toBe(true);
    expect(isVersionConflict(err(409, 'CONFLICT'))).toBe(false);
    expect(isOrderConflict(err(409, 'CONFLICT'))).toBe(true);
    expect(isOrderingLocked(err(409, 'ORDERING_LOCKED'))).toBe(true);
    expect(isOrderingLocked(err(404))).toBe(false);
  });
});
