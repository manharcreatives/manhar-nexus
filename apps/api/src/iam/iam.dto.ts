import { z } from 'zod';

// ── Users ──
export const createUserSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).max(200),
    displayName: z.string().trim().min(1).max(200),
    roleKeys: z.array(z.string().trim().min(1)).max(20).optional(),
  })
  .strict();
export type CreateUserBody = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    displayName: z.string().trim().min(1).max(200).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });
export type UpdateUserBody = z.infer<typeof updateUserSchema>;

export const assignRoleSchema = z
  .object({
    roleId: z.string().uuid(),
    allLocations: z.boolean().optional(),
    locationIds: z.array(z.string().uuid()).max(200).optional(),
  })
  .strict();
export type AssignRoleBody = z.infer<typeof assignRoleSchema>;

/** GET /admin/users/directory — bounded, filterable team listing. */
export const userDirectoryQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING']).optional(),
  roleId: z.string().uuid().optional(),
  skip: z.coerce.number().int().min(0).optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
});
export type UserDirectoryQuery = z.infer<typeof userDirectoryQuerySchema>;

/** POST /admin/users/:id/password — an administrator sets a new password. */
export const resetPasswordSchema = z
  .object({
    password: z.string().min(8).max(200),
  })
  .strict();
export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>;

// ── Roles ──
export const createRoleSchema = z
  .object({
    key: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]+$/, 'kebab-case only')
      .max(64),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(280).optional(),
    permissions: z.array(z.string().trim().min(1)).max(200),
  })
  .strict();
export type CreateRoleBody = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(280).nullable().optional(),
    permissions: z.array(z.string().trim().min(1)).max(200).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });
export type UpdateRoleBody = z.infer<typeof updateRoleSchema>;
