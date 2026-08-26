import { Injectable } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { ValidationError } from '../../common/errors';
import type { PaymentProvider, InitiateParams, InitiateResult, CaptureParams, CaptureResult, RefundParams, RefundResult } from './payment-provider.interface';

/**
 * Manual UPI provider: payment stays PENDING until staff enters the
 * UTR / reference code from the guest's UPI app. No SDK integration.
 * Razorpay dynamic QR is deferred to a later phase (ADR-008).
 */
@Injectable()
export class ManualUpiProvider implements PaymentProvider {
  readonly method = PaymentMethod.UPI;

  async initiate(_params: InitiateParams): Promise<InitiateResult> {
    return { status: 'PENDING' };
  }

  async capture(params: CaptureParams): Promise<CaptureResult> {
    if (!params.referenceCode) {
      throw new ValidationError('referenceCode (UTR) is required to confirm UPI payment', {});
    }
    return {
      status: 'CAPTURED',
      capturedAt: new Date(),
      referenceCode: params.referenceCode,
      providerTransactionId: params.referenceCode,
    };
  }

  async refund(_params: RefundParams): Promise<RefundResult> {
    // Manual UPI refunds require operator action outside the system — record as PENDING
    return { status: 'PENDING' };
  }
}
