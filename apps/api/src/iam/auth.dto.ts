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

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(8).max(200),
  })
  .strict()
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'New password must be different from the current one',
    path: ['newPassword'],
  });
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
