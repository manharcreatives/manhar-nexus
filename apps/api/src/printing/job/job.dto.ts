import { z } from 'zod';
import { PrintPurpose, PrintJobSourceType, PrintJobStatus } from '@prisma/client';

export const enqueueJobSchema = z.object({
  idempotencyKey: z.string().uuid(),
  purpose: z.nativeEnum(PrintPurpose),
  sourceType: z.nativeEnum(PrintJobSourceType),
  /** Required for INVOICE / SERVICE_REQUEST. May be any string for MANUAL. */
  sourceId: z.string().min(1).max(200),
  /** Required when sourceType=MANUAL; ignored otherwise (built from source). */
  payload: z.record(z.unknown()).optional(),
  /** If omitted, the service routes to the first active printer for purpose+location. */
  printerId: z.string().uuid().optional(),
  /** Required when sourceType=MANUAL; ignored otherwise (derived from source). */
  locationId: z.string().uuid().optional(),
  maxRetries: z.number().int().min(0).max(10).optional().default(3),
});
export type EnqueueJobDto = z.infer<typeof enqueueJobSchema>;

export const reprintJobSchema = z.object({
  idempotencyKey: z.string().uuid(),
  printerId: z.string().uuid().optional(),
  reason: z.string().min(1).max(200).optional(),
});
export type ReprintJobDto = z.infer<typeof reprintJobSchema>;

export const cancelJobSchema = z.object({
  reason: z.string().min(1).max(200).optional(),
});
export type CancelJobDto = z.infer<typeof cancelJobSchema>;

// Agent status update DTOs
export const agentStatusSentSchema = z.object({}).optional();
export const agentStatusPrintedSchema = z.object({}).optional();
export const agentStatusFailedSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type AgentStatusFailedDto = z.infer<typeof agentStatusFailedSchema>;

export const agentStatusOfflineSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type AgentStatusOfflineDto = z.infer<typeof agentStatusOfflineSchema>;

export const listJobsSchema = z.object({
  status: z.nativeEnum(PrintJobStatus).optional(),
  purpose: z.nativeEnum(PrintPurpose).optional(),
  locationId: z.string().uuid().optional(),
  printerId: z.string().uuid().optional(),
});
export type ListJobsFilter = z.infer<typeof listJobsSchema>;
