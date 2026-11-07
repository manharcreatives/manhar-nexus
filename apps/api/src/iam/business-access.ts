import { ForbiddenError } from '../common/errors';

/** What a paused client sees. Plain and actionable: the owner cannot fix this themselves. */
export const ACCOUNT_PAUSED_MESSAGE = 'This account is paused. Please contact Manhar support.';

export interface BusinessAccessState {
  status: string;
  commercialStatus: string;
}

/** A business is paused when Manhar suspended it, or the commercial record says SUSPENDED or CHURNED. */
export function isBusinessPaused(b: BusinessAccessState | null | undefined): boolean {
  if (!b) return false;
  return b.status === 'SUSPENDED' || b.commercialStatus === 'SUSPENDED' || b.commercialStatus === 'CHURNED';
}

/**
 * Throws the 403 for a paused client. Platform users have no business and are never paused by this. Guest QR menu
 * routes do not go through the user guard and are deliberately unaffected.
 */
export function assertBusinessNotPaused(b: BusinessAccessState | null | undefined): void {
  if (isBusinessPaused(b)) throw new ForbiddenError(ACCOUNT_PAUSED_MESSAGE, { reason: 'ACCOUNT_PAUSED' });
}
