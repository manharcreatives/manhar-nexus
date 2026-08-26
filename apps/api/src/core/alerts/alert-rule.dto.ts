import { z } from 'zod';

export const createAlertRuleSchema = z
  .object({
    eventKey: z
      .string()
      .trim()
      .min(3)
      .max(120)
      .regex(/^[a-z0-9_.]+$/, 'eventKey must be dotted lowercase, e.g. "order.completed"'),
    targetRoleKey: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9-]+$/, 'targetRoleKey must be a kebab-case role key'),
    channel: z.enum(['IN_APP']).default('IN_APP'),
    enabled: z.boolean().default(true),
  })
  .strict();
export type CreateAlertRuleDto = z.infer<typeof createAlertRuleSchema>;

export const updateAlertRuleSchema = z
  .object({
    enabled: z.boolean(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();
export type UpdateAlertRuleDto = z.infer<typeof updateAlertRuleSchema>;
