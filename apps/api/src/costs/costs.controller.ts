import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentPrincipal, RequirePermission, scopeFromPrincipal, type Principal } from '../iam/principal';
import { RequireModule } from '../modules/module-gating.guard';
import { zodBody, zodQuery } from '../common/zod-validation.pipe';
import { CostsService } from './costs.service';
import {
  createCategorySchema,
  updateCategorySchema,
  createExpenseSchema,
  listExpenseSchema,
  rejectExpenseSchema,
  type CreateCategoryDto,
  type UpdateCategoryDto,
  type CreateExpenseDto,
  type ListExpenseDto,
  type RejectExpenseDto,
} from './costs.dto';
import { z } from 'zod';

const summaryQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  locationId: z.string().uuid().optional(),
});

@Controller('admin/costs')
@RequireModule('costs')
export class CostsController {
  constructor(private readonly costs: CostsService) {}

  // ── Categories ──────────────────────────────────────────────────────────────

  @Get('categories')
  @RequirePermission('costs.category.view')
  listCategories(@CurrentPrincipal() p: Principal) {
    return this.costs.listCategories(scopeFromPrincipal(p));
  }

  @Post('categories')
  @RequirePermission('costs.category.manage')
  createCategory(
    @CurrentPrincipal() p: Principal,
    @Body(zodBody(createCategorySchema)) dto: CreateCategoryDto,
  ) {
    return this.costs.createCategory(scopeFromPrincipal(p), dto);
  }

  @Get('categories/:id')
  @RequirePermission('costs.category.view')
  getCategory(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.costs.getCategoryOrThrow(scopeFromPrincipal(p), id);
  }

  @Patch('categories/:id')
  @RequirePermission('costs.category.manage')
  updateCategory(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updateCategorySchema)) dto: UpdateCategoryDto,
  ) {
    return this.costs.updateCategory(scopeFromPrincipal(p), id, dto);
  }

  // ── Expenses ────────────────────────────────────────────────────────────────

  @Get('expenses')
  @RequirePermission('costs.expense.view')
  listExpenses(
    @CurrentPrincipal() p: Principal,
    @Query(zodQuery(listExpenseSchema)) filters: ListExpenseDto,
  ) {
    return this.costs.listExpenses(scopeFromPrincipal(p), filters);
  }

  @Post('expenses')
  @RequirePermission('costs.expense.create')
  createExpense(
    @CurrentPrincipal() p: Principal,
    @Body(zodBody(createExpenseSchema)) dto: CreateExpenseDto,
  ) {
    return this.costs.createExpense(scopeFromPrincipal(p), dto, p.userId);
  }

  @Get('expenses/:id')
  @RequirePermission('costs.expense.view')
  getExpense(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.costs.getExpenseOrThrow(scopeFromPrincipal(p), id);
  }

  @Post('expenses/:id/approve')
  @RequirePermission('costs.expense.approve')
  approveExpense(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.costs.approveExpense(scopeFromPrincipal(p), id, p.userId);
  }

  @Post('expenses/:id/reject')
  @RequirePermission('costs.expense.approve')
  rejectExpense(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(rejectExpenseSchema)) dto: RejectExpenseDto,
  ) {
    return this.costs.rejectExpense(scopeFromPrincipal(p), id, dto, p.userId);
  }

  @Get('summary')
  @RequirePermission('costs.expense.view')
  getSummary(
    @CurrentPrincipal() p: Principal,
    @Query(zodQuery(summaryQuerySchema)) query: z.infer<typeof summaryQuerySchema>,
  ) {
    return this.costs.getSummary(scopeFromPrincipal(p), query.from, query.to, query.locationId);
  }
}
