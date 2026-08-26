import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { zodBody } from '../common/zod-validation.pipe';
import { paginationQuerySchema, type PaginationQuery } from '../common/pagination';
import { RoleService } from './role.service';
import {
  createRoleSchema,
  updateRoleSchema,
  type CreateRoleBody,
  type UpdateRoleBody,
} from './iam.dto';
import { CurrentPrincipal, RequirePermission, scopeFromPrincipal, type Principal } from './principal';

/** Business-realm role administration (system roles are read-only templates). */
@Controller('admin/roles')
export class RoleController {
  constructor(private readonly roles: RoleService) {}

  @Get()
  @RequirePermission('core.role.view')
  list(
    @CurrentPrincipal() p: Principal,
    @Query(zodBody(paginationQuerySchema)) q: PaginationQuery,
  ) {
    return this.roles.list(scopeFromPrincipal(p), q);
  }

  @Post()
  @RequirePermission('core.role.create')
  create(@CurrentPrincipal() p: Principal, @Body(zodBody(createRoleSchema)) dto: CreateRoleBody) {
    return this.roles.create(scopeFromPrincipal(p), p, dto);
  }

  @Patch(':id')
  @RequirePermission('core.role.edit')
  update(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updateRoleSchema)) dto: UpdateRoleBody,
  ) {
    return this.roles.update(scopeFromPrincipal(p), p, id, dto);
  }

  @Delete(':id')
  @RequirePermission('core.role.delete')
  @HttpCode(204)
  async remove(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    await this.roles.remove(scopeFromPrincipal(p), id);
  }
}
