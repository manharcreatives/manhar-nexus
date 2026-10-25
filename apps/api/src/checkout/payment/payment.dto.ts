import { z } from 'zod';
import { PaymentMethod } from '@prisma/client';

export const initiatePaymentSchema = z.object({
  idempotencyKey: z.string().uuid(),
  method: z.nativeEnum(PaymentMethod),
  amountMinorUnits: z.number().int().positive(),
  cashReceivedMinorUnits: z.number().int().positive().optional(),
  referenceCode: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
});

export const capturePaymentSchema = z.object({
  referenceCode: z.string().max(200).optional(),
  providerTransactionId: z.string().max(200).optional(),
  expectedVersion: z.number().int().optional(),
});

export const cancelPaymentSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
  expectedVersion: z.number().int().optional(),
});

export const createRefundSchema = z.object({
  /**
   * Optional client-generated UUID. Retrying with the same key replays the
   * original refund; reusing it for a different payment/amount is a 409.
   */
  idempotencyKey: z.string().uuid().optional(),
  reason: z.string().min(1).max(500),
  amountMinorUnits: z.number().int().positive(),
  notes: z.string().max(500).optional(),
});

export type InitiatePaymentDto = z.infer<typeof initiatePaymentSchema>;
export type CapturePaymentDto = z.infer<typeof capturePaymentSchema>;
export type CancelPaymentDto = z.infer<typeof cancelPaymentSchema>;
export type CreateRefundDto = z.infer<typeof createRefundSchema>;
