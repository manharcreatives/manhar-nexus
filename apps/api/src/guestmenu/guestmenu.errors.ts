import { DomainError } from '../common/errors';

/** The QR is valid but the restaurant / table switched the guest menu off. */
export class MenuDisabledError extends DomainError {
  readonly code = 'MENU_DISABLED';
  readonly httpStatus = 403;
}

/** Guest ordering is off (restaurant-wide or for this table); the menu itself may still be viewable. */
export class OrderingOffError extends DomainError {
  readonly code = 'ORDERING_OFF';
  readonly httpStatus = 403;
}

/** No open guest session at this table ("ask your waiter to open the table"). */
export class TableClosedError extends DomainError {
  readonly code = 'TABLE_CLOSED';
  readonly httpStatus = 409;
}

/** Missing, unknown, expired or revoked guest token (or one that belongs to another table visit). The client re-issues one. */
export class GuestTokenError extends DomainError {
  readonly code = 'GUEST_TOKEN_INVALID';
  readonly httpStatus = 401;
}

export class SoldOutError extends DomainError {
  readonly code = 'SOLD_OUT';
  readonly httpStatus = 409;
}

export class IdempotencyReuseError extends DomainError {
  readonly code = 'IDEMPOTENCY_KEY_REUSED';
  readonly httpStatus = 409;
}

/** Bill not final yet / nothing to pay / UPI unavailable. */
export class BillNotReadyError extends DomainError {
  readonly code = 'BILL_NOT_READY';
  readonly httpStatus = 409;
}

export class UpiUnavailableError extends DomainError {
  readonly code = 'UPI_UNAVAILABLE';
  readonly httpStatus = 409;
}

/** Abuse limits (rate, pending orders, guests per visit). `retryAfterSeconds` is also sent as the Retry-After header. */
export class RateLimitedError extends DomainError {
  readonly code = 'RATE_LIMITED';
  readonly httpStatus = 429;
  constructor(
    message: string,
    readonly retryAfterSeconds: number,
    details?: Record<string, unknown>,
  ) {
    super(message, { ...details, retryAfterSeconds });
  }
}

export class UnsupportedMediaError extends DomainError {
  readonly code = 'UNSUPPORTED_MEDIA';
  readonly httpStatus = 415;
}

export class PayloadTooLargeError extends DomainError {
  readonly code = 'PAYLOAD_TOO_LARGE';
  readonly httpStatus = 413;
}

/** Image storage is not configured on this deployment (MEDIA_DIR unset in production). */
export class MediaUnavailableError extends DomainError {
  readonly code = 'MEDIA_NOT_CONFIGURED';
  readonly httpStatus = 503;
}
