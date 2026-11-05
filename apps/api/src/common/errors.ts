/**
 * Typed domain errors. Services throw these; the DomainExceptionFilter maps
 * them to stable HTTP responses with a machine-readable `code`. This keeps
 * transport concerns out of domain logic and gives clients a contract.
 */

export abstract class DomainError extends Error {
  /** Stable machine code, e.g. "NOT_FOUND" (clients switch on this, not text). */
  abstract readonly code: string;
  /** HTTP status the filter should emit. */
  abstract readonly httpStatus: number;

  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  readonly httpStatus = 404;
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION';
  readonly httpStatus = 400;
}

export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
  readonly httpStatus = 409;
}

/** Optimistic-concurrency conflict (ADR-017): version mismatch on a hot write. */
export class VersionConflictError extends DomainError {
  readonly code = 'VERSION_CONFLICT';
  readonly httpStatus = 409;
}

/**
 * Abuse limits (rate, caps). `retryAfterSeconds` is also sent as the Retry-After header (see DomainExceptionFilter).
 * 429 with code RATE_LIMITED; `details.kind` may say which limit was hit.
 */
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

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
  readonly httpStatus = 401;
}

export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
  readonly httpStatus = 403;
}

/**
 * The requested feature is gated behind a module that is not ACTIVE for this
 * business (e.g. DISABLED, PENDING_SETUP, SUSPENDED, or never activated).
 * HTTP 403 with a distinct code so clients can show an "enable this module" CTA
 * instead of a generic "access denied" message.
 */
export class ModuleDisabledError extends DomainError {
  readonly code = 'MODULE_DISABLED';
  readonly httpStatus = 403;
  constructor(moduleKey: string) {
    super(`Module '${moduleKey}' is not active for this business`, { moduleKey });
  }
}
