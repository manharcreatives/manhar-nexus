import { z } from 'zod';

export const allocateQuerySchema = z.object({
  locationId: z.string().uuid().optional(),
});
export type AllocateQuery = z.infer<typeof allocateQuerySchema>;

export const configureNumberingSchema = z
  .object({
    prefix: z.string().trim().max(16).nullable().optional(),
    padding: z.number().int().min(0).max(20).optional(),
    startAt: z.number().int().min(1).optional(),
    locationId: z.string().uuid().optional(),
  })
  .strict();
export type ConfigureNumberingDto = z.infer<typeof configureNumberingSchema>;
