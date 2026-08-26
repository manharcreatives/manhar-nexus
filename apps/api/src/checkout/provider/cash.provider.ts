import { Injectable } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { ValidationError } from '../../common/errors';
import type { PaymentProvider, InitiateParams, InitiateResult, CaptureParams, CaptureResult, RefundParams, RefundResult } from './payment-provider.interface';

@Injectable()
export class CashProvider implements PaymentProvider {
  readonly method = PaymentMethod.CASH;

  async initiate(params: InitiateParams): Promise<InitiateResult> {
    if (params.cashReceivedMinorUnits === undefined) {
      throw new ValidationError('cashReceivedMinorUnits is required for cash payment', {});
    }
    if (params.cashReceivedMinorUnits < params.amountMinorUnits) {
      throw new ValidationError('Cash received is less than invoice total', {
        received: params.cashReceivedMinorUnits,
        required: params.amountMinorUnits,
      });
    }
    return {
      status: 'CAPTURED',
      capturedAt: new Date(),
      changeMinorUnits: params.cashReceivedMinorUnits - params.amountMinorUnits,
    };
  }

  async capture(_params: CaptureParams): Promise<CaptureResult> {
    throw new ValidationError('Cash payments are captured immediately on initiation', {});
  }

  async refund(_params: RefundParams): Promise<RefundResult> {
    // Cash refunds are physical; record as immediately processed
    return { status: 'PROCESSED', processedAt: new Date() };
  }
}
