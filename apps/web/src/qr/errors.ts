import type { TFunction } from 'i18next';
import { describeError } from '../restaurant/errors';

type Coded = { status?: number; code?: string; message?: string } | null;

export const isVersionConflict = (err: unknown): boolean => {
  const e = err as Coded;
  return e?.status === 409 && e.code === 'VERSION_CONFLICT';
};

/** 409 from confirm / reject / edit: somebody else got there first (or the table closed / was billed). */
export const isOrderConflict = (err: unknown): boolean => (err as Coded)?.status === 409;
export const isGone = (err: unknown): boolean => (err as Coded)?.status === 404;
export const isOrderingLocked = (err: unknown): boolean => {
  const e = err as Coded;
  return e?.status === 409 && e.code === 'ORDERING_LOCKED';
};

/** The API's own sentence when it sent one (not the client's "Request failed (415)" placeholder). */
const specific = (e: NonNullable<Coded>): string | null => (e.message && !/^Request failed \(\d+\)$/.test(e.message) ? e.message : null);

/**
 * Error code -> sentence for the QR screens (the API's codes: guestmenu.errors.ts, common/errors.ts).
 * Everything else falls back to the shared mapper; `contextKey` names the failed action.
 */
export function describeQrError(err: unknown, t: TFunction, contextKey: string): string {
  const e = err as Coded;
  if (e && typeof e.status === 'number') {
    if (isVersionConflict(err)) return t('qr.errors.versionConflict');
    if (isOrderingLocked(err)) return t('qr.errors.orderingLocked');
    // Picture rejections come with a specific reason (too small, animated, rotated by hidden camera data, too many pixels ...).
    // The upload size cap itself answers 413 with code ERROR and the multer text "File too large": use our own sentence for that.
    if (e.code === 'PAYLOAD_TOO_LARGE') return specific(e) ?? t('qr.errors.tooLarge');
    if (e.status === 413) return t('qr.errors.tooLarge');
    if (e.status === 415 || e.code === 'UNSUPPORTED_MEDIA') return specific(e) ?? t('qr.errors.unsupportedMedia');
    if (e.status === 503 && e.code === 'MEDIA_NOT_CONFIGURED') return t('qr.errors.mediaNotConfigured');
    if (e.status === 429) return t('qr.errors.rateLimited');
    // 400 VALIDATION messages from these endpoints are written for people ("The order has no items left. Reject it instead.").
    if (e.status === 400 && e.code === 'VALIDATION' && e.message) return e.message;
  }
  return describeError(err, t, contextKey);
}
