import { z } from 'zod';

/** Shared pagination query (?skip=&take=), coerced from string query params. */
export const paginationQuerySchema = z.object({
  skip: z.coerce.number().int().min(0).optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
