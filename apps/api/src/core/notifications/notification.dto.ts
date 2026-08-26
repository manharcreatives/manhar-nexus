import { z } from 'zod';

export const listNotificationsSchema = z
  .object({
    unreadOnly: z
      .string()
      .optional()
      .transform((v) => v === 'true'),
    skip: z.coerce.number().int().min(0).optional(),
    take: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();
export type ListNotificationsQuery = z.infer<typeof listNotificationsSchema>;
