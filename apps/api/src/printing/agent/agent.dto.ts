import { z } from 'zod';

export const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  locationId: z.string().uuid(),
});
export type CreateAgentDto = z.infer<typeof createAgentSchema>;

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateAgentDto = z.infer<typeof updateAgentSchema>;
