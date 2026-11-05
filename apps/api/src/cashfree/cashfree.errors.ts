import { DomainError } from '../common/errors';

/** Cashfree keys are not set on this deployment: staff are told plainly, nothing is attempted. */
export class PaymentsNotConfiguredError extends DomainError {
  readonly code = 'PAYMENTS_NOT_CONFIGURED';
  readonly httpStatus = 503;
}

/** Cashfree refused or failed a call. The message is safe to show staff (never contains a secret). */
export class PaymentProviderError extends DomainError {
  readonly code = 'PAYMENT_PROVIDER_ERROR';
  readonly httpStatus = 502;
}
