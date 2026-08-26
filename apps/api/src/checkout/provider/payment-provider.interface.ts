import type { PaymentMethod, PaymentStatus, RefundStatus } from '@prisma/client';

export interface InitiateParams {
  invoiceId: string;
  amountMinorUnits: number;
  currencyCode: string;
  method: PaymentMethod;
  cashReceivedMinorUnits?: number;
  referenceCode?: string;
  notes?: string;
}

export interface InitiateResult {
  status: PaymentStatus;
  capturedAt?: Date;
  changeMinorUnits?: number;
  providerOrderId?: string;
  providerTransactionId?: string;
}

export interface CaptureParams {
  paymentId: string;
  referenceCode?: string;
  providerTransactionId?: string;
}

export interface CaptureResult {
  status: PaymentStatus;
  capturedAt: Date;
  providerTransactionId?: string;
  referenceCode?: string;
}

export interface RefundParams {
  paymentId: string;
  amountMinorUnits: number;
  reason: string;
}

export interface RefundResult {
  status: RefundStatus;
  providerRefundId?: string;
  processedAt?: Date;
}

export interface PaymentProvider {
  readonly method: PaymentMethod;
  initiate(params: InitiateParams): Promise<InitiateResult>;
  capture(params: CaptureParams): Promise<CaptureResult>;
  refund(params: RefundParams): Promise<RefundResult>;
}
