import { z } from 'zod';

// ── Expense Category ──────────────────────────────────────────────────────────

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  requiresApproval: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  requiresApproval: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export type CreateCategoryDto = z.infer<typeof createCategorySchema>;
export type UpdateCategoryDto = z.infer<typeof updateCategorySchema>;

// ── Expense ───────────────────────────────────────────────────────────────────

export const createExpenseSchema = z.object({
  locationId: z.string().uuid(),
  expenseCategoryId: z.string().uuid(),
  amountMinorUnits: z.number().int().min(1).max(2_147_483_647),
  paidAt: z.string().datetime(),
  description: z.string().max(500).optional(),
  vendorName: z.string().max(200).optional(),
  isRecurring: z.boolean().default(false),
  recurringNote: z.string().max(300).optional(),
  idempotencyKey: z.string().uuid(),
});

export const listExpenseSchema = z.object({
  locationId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(['PENDING_APPROVAL', 'APPROVED', 'REJECTED']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const approveExpenseSchema = z.object({});

export const rejectExpenseSchema = z.object({
  rejectionReason: z.string().min(1).max(500),
});

export type CreateExpenseDto = z.infer<typeof createExpenseSchema>;
export type ListExpenseDto = z.infer<typeof listExpenseSchema>;
export type RejectExpenseDto = z.infer<typeof rejectExpenseSchema>;
