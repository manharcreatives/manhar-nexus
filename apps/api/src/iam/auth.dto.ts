import { z } from 'zod';

export const loginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1).max(200),
  })
  .strict();
export type LoginDto = z.infer<typeof loginSchema>;

// refreshToken optional: browsers send it via the httpOnly cookie instead.
export const refreshSchema = z
  .object({
    refreshToken: z.string().min(1).optional(),
  })
  .strict();
export type RefreshDto = z.infer<typeof refreshSchema>;
