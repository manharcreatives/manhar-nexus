import { ConflictError } from '../common/errors';

/** An idempotency race that could not be resolved to a stored order (should not happen; surfaced as a retryable 409). */
export class UniqueViolation extends ConflictError {
  constructor() {
    super('Your order could not be saved. Please try again.');
  }
}
