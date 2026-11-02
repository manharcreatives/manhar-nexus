import { ApiError } from './api';

/** What the page should do about a failed order submission. */
export interface OrderFailure {
  message: string;
  /** Re-read the menu (sold out, table closed, ordering switched off ...). */
  refreshMenu: boolean;
  /** Forget the Idempotency-Key: the server judged this exact cart, a corrected cart is a new request. */
  newKey: boolean;
}

/** Copy for each documented error of POST /orders. Server messages are already guest-safe; we add our own where useful. */
export function orderFailure(e: unknown, fallback: string, offline: string): OrderFailure {
  if (!(e instanceof ApiError)) return { message: fallback, refreshMenu: false, newKey: false };
  switch (e.code) {
    case 'TABLE_CLOSED':
      return { message: 'This table is not open any more. Please ask your waiter.', refreshMenu: true, newKey: false };
    case 'ORDERING_OFF':
      return { message: 'Ordering from the table is switched off. Please tell your waiter what you would like.', refreshMenu: true, newKey: false };
    case 'ORDERING_LOCKED':
      return { message: 'A bill has already been prepared for your table. Please ask your waiter to add anything else.', refreshMenu: false, newKey: false };
    case 'SOLD_OUT':
      return { message: e.message || 'An item in your order just sold out.', refreshMenu: true, newKey: true };
    case 'IDEMPOTENCY_KEY_REUSED':
      return { message: fallback, refreshMenu: false, newKey: true };
    case 'GUEST_TOKEN_INVALID':
      return { message: 'Your table session has ended. Please try again.', refreshMenu: true, newKey: false };
  }
  if (e.kind === 'network' || e.kind === 'timeout') return { message: offline, refreshMenu: false, newKey: false };
  if (e.kind === 'rate') {
    if (e.reason === 'PENDING_ORDERS') {
      return { message: 'Your table already has several orders waiting for the waiter. Please wait until they are confirmed.', refreshMenu: false, newKey: false };
    }
    const wait = e.retryAfterSec ? ` ${e.retryAfterSec}s` : ' a moment';
    return { message: `Too many orders just now. Please wait${wait} and try again.`, refreshMenu: false, newKey: false };
  }
  if (e.kind === 'invalid' || e.kind === 'not-found') {
    // ITEM_NOT_ON_MENU / VARIANT_REQUIRED / caps: the cart no longer matches the menu.
    return { message: e.message || fallback, refreshMenu: true, newKey: true };
  }
  if (e.kind === 'server') return { message: fallback, refreshMenu: false, newKey: false };
  return { message: e.message || fallback, refreshMenu: false, newKey: false };
}
