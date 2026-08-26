import { Injectable } from '@nestjs/common';
import { type ExpenseCategory, type Expense, ExpenseStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../common/errors';
import { TenantScopedRepository } from '../common/tenant-scoped.repository';
import { AuditService } from '../core/audit/audit.service';
import type { TenantScope } from '../common/tenant-scope';
import type {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateExpenseDto,
  ListExpenseDto,
  RejectExpenseDto,
} from './costs.dto';

const EXPENSE_WITH_RELATIONS = {
  category: { select: { id: true, name: true, requiresApproval: true } },
  location: { select: { id: true, name: true } },
  createdBy: { select: { id: true, email: true } },
  approvedBy: { select: { id: true, email: true } },
} as const;

@Injectable()
export class CostsService extends TenantScopedRepository {
  constructor(
    prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    super(prisma);
  }

  // ── Categories ──────────────────────────────────────────────────────────────

  async listCategories(scope: TenantScope): Promise<ExpenseCategory[]> {
    return this.prisma.expenseCategory.findMany({
      where: this.scoped(scope),
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createCategory(scope: TenantScope, dto: CreateCategoryDto): Promise<ExpenseCategory> {
    const existing = await this.prisma.expenseCategory.findFirst({
      where: this.scoped(scope, { name: dto.name }),
    });
    if (existing) throw new ConflictError(`Expense category '${dto.name}' already exists`);

    const category = await this.prisma.expenseCategory.create({
      data: { ...dto, businessId: scope.businessId },
    });

    await this.audit.record(scope, {
      action: 'created',
      resourceType: 'costs.category',
      resourceId: category.id,
      metadata: { name: category.name },
    });

    return category;
  }

  async updateCategory(
    scope: TenantScope,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<ExpenseCategory> {
    const existing = await this.prisma.expenseCategory.findFirst({
      where: this.scoped(scope, { id }),
    });
    if (!existing) throw new NotFoundError(`ExpenseCategory ${id} not found`);

    if (dto.name && dto.name !== existing.name) {
      const dupe = await this.prisma.expenseCategory.findFirst({
        where: this.scoped(scope, { name: dto.name }),
      });
      if (dupe) throw new ConflictError(`Expense category '${dto.name}' already exists`);
    }

    const updated = await this.prisma.expenseCategory.update({
      where: { id },
      data: { ...dto, version: { increment: 1 } },
    });

    await this.audit.record(scope, {
      action: 'updated',
      resourceType: 'costs.category',
      resourceId: id,
      metadata: { changes: dto as Record<string, unknown> },
    });

    return updated;
  }

  async getCategoryOrThrow(scope: TenantScope, id: string): Promise<ExpenseCategory> {
    const row = await this.prisma.expenseCategory.findFirst({
      where: this.scoped(scope, { id }),
    });
    if (!row) throw new NotFoundError(`ExpenseCategory ${id} not found`);
    return row;
  }

  // ── Expenses ────────────────────────────────────────────────────────────────

  async listExpenses(scope: TenantScope, filters: ListExpenseDto): Promise<Expense[]> {
    return this.prisma.expense.findMany({
      where: {
        ...this.scoped(scope),
        ...(filters.locationId ? { locationId: filters.locationId } : {}),
        ...(filters.categoryId ? { expenseCategoryId: filters.categoryId } : {}),
        ...(filters.status ? { status: filters.status as ExpenseStatus } : {}),
        ...(filters.from || filters.to
          ? {
              paidAt: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to ? { lte: new Date(filters.to) } : {}),
              },
            }
          : {}),
      },
      include: EXPENSE_WITH_RELATIONS,
      orderBy: { paidAt: 'desc' },
    });
  }

  async createExpense(
    scope: TenantScope,
    dto: CreateExpenseDto,
    principalId: string | undefined,
  ): Promise<Expense> {
    // Idempotency: return existing record for the same key
    const existing = await this.prisma.expense.findFirst({
      where: this.scoped(scope, { idempotencyKey: dto.idempotencyKey }),
      include: EXPENSE_WITH_RELATIONS,
    });
    if (existing) return existing;

    // Location must belong to this business
    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, businessId: scope.businessId },
    });
    if (!location) throw new ForbiddenError('Location not accessible');

    // Category must be active and belong to this business
    const category = await this.prisma.expenseCategory.findFirst({
      where: this.scoped(scope, { id: dto.expenseCategoryId, isActive: true }),
    });
    if (!category) throw new NotFoundError(`ExpenseCategory ${dto.expenseCategoryId} not found`);

    // Auto-approve when the category does not require approval
    const status = category.requiresApproval ? ExpenseStatus.PENDING_APPROVAL : ExpenseStatus.APPROVED;
    const approvedAt = status === ExpenseStatus.APPROVED ? new Date() : null;

    const expense = await this.prisma.expense.create({
      data: {
        businessId: scope.businessId,
        locationId: dto.locationId,
        expenseCategoryId: dto.expenseCategoryId,
        amountMinorUnits: dto.amountMinorUnits,
        paidAt: new Date(dto.paidAt),
        description: dto.description,
        vendorName: dto.vendorName,
        isRecurring: dto.isRecurring,
        recurringNote: dto.recurringNote,
        idempotencyKey: dto.idempotencyKey,
        status,
        ...(approvedAt !== null ? { approvedAt, approvedById: principalId } : {}),
        ...(principalId ? { createdById: principalId } : {}),
      },
      include: EXPENSE_WITH_RELATIONS,
    });

    await this.audit.record(scope, {
      action: 'created',
      resourceType: 'costs.expense',
      resourceId: expense.id,
      locationId: expense.locationId,
      metadata: {
        amountMinorUnits: expense.amountMinorUnits,
        status: expense.status,
        categoryId: expense.expenseCategoryId,
      },
    });

    return expense;
  }

  async getExpenseOrThrow(scope: TenantScope, id: string): Promise<Expense> {
    const row = await this.prisma.expense.findFirst({
      where: this.scoped(scope, { id }),
      include: EXPENSE_WITH_RELATIONS,
    });
    if (!row) throw new NotFoundError(`Expense ${id} not found`);
    return row;
  }

  async approveExpense(
    scope: TenantScope,
    id: string,
    approverId: string | undefined,
  ): Promise<Expense> {
    const expense = await this.getExpenseOrThrow(scope, id);

    if (expense.status !== ExpenseStatus.PENDING_APPROVAL) {
      throw new ValidationError(`Expense is ${expense.status}, cannot approve`);
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        status: ExpenseStatus.APPROVED,
        approvedAt: new Date(),
        ...(approverId ? { approvedById: approverId } : {}),
        rejectionReason: null,
        version: { increment: 1 },
      },
      include: EXPENSE_WITH_RELATIONS,
    });

    await this.audit.record(scope, {
      action: 'approved',
      resourceType: 'costs.expense',
      resourceId: id,
      metadata: { ...(approverId ? { approverId } : {}) },
    });

    return updated;
  }

  async rejectExpense(
    scope: TenantScope,
    id: string,
    dto: RejectExpenseDto,
    rejecterId: string | undefined,
  ): Promise<Expense> {
    const expense = await this.getExpenseOrThrow(scope, id);

    if (expense.status !== ExpenseStatus.PENDING_APPROVAL) {
      throw new ValidationError(`Expense is ${expense.status}, cannot reject`);
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        status: ExpenseStatus.REJECTED,
        rejectionReason: dto.rejectionReason,
        version: { increment: 1 },
      },
      include: EXPENSE_WITH_RELATIONS,
    });

    await this.audit.record(scope, {
      action: 'rejected',
      resourceType: 'costs.expense',
      resourceId: id,
      metadata: {
        ...(rejecterId ? { rejecterId } : {}),
        reason: dto.rejectionReason,
      },
    });

    return updated;
  }

  async getSummary(
    scope: TenantScope,
    from: string,
    to: string,
    locationId?: string,
  ) {
    const expenses = await this.prisma.expense.findMany({
      where: {
        ...this.scoped(scope),
        status: ExpenseStatus.APPROVED,
        paidAt: { gte: new Date(from), lte: new Date(to) },
        ...(locationId ? { locationId } : {}),
      },
      include: { category: { select: { id: true, name: true } } },
    });

    type CategoryBucket = {
      categoryId: string;
      categoryName: string;
      totalMinorUnits: number;
      count: number;
    };

    const byCategory = new Map<string, CategoryBucket>();

    for (const e of expenses) {
      const key = e.expenseCategoryId;
      const entry = byCategory.get(key) ?? {
        categoryId: key,
        categoryName: e.category.name,
        totalMinorUnits: 0,
        count: 0,
      };
      entry.totalMinorUnits += e.amountMinorUnits;
      entry.count += 1;
      byCategory.set(key, entry);
    }

    return {
      from,
      to,
      ...(locationId ? { locationId } : {}),
      grandTotalMinorUnits: expenses.reduce((s, e) => s + e.amountMinorUnits, 0),
      expenseCount: expenses.length,
      byCategory: Array.from(byCategory.values()).sort((a, b) => b.totalMinorUnits - a.totalMinorUnits),
    };
  }
}
