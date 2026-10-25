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
import { UserService } from './user.service';
import {
  assignRoleSchema,
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
  userDirectoryQuerySchema,
  type AssignRoleBody,
  type CreateUserBody,
  type ResetPasswordBody,
  type UpdateUserBody,
  type UserDirectoryQuery,
} from './iam.dto';
import { CurrentPrincipal, RequirePermission, scopeFromPrincipal, type Principal } from './principal';

/** Business-realm user administration. businessId is derived from the token. */
@Controller('admin/users')
export class UserController {
  constructor(private readonly users: UserService) {}

  @Post()
  @RequirePermission('core.user.create')
  create(@CurrentPrincipal() p: Principal, @Body(zodBody(createUserSchema)) dto: CreateUserBody) {
    return this.users.create(scopeFromPrincipal(p), p, dto);
  }

  @Get()
  @RequirePermission('core.user.view')
  list(
    @CurrentPrincipal() p: Principal,
    @Query(zodBody(paginationQuerySchema)) q: PaginationQuery,
  ) {
    return this.users.list(scopeFromPrincipal(p), q);
  }

  /** Team directory (search/filter/paginate, roles + locations by name). Declared before :id. */
  @Get('directory')
  @RequirePermission('core.user.view')
  directory(
    @CurrentPrincipal() p: Principal,
    @Query(zodBody(userDirectoryQuerySchema)) q: UserDirectoryQuery,
  ) {
    return this.users.directory(scopeFromPrincipal(p), p, q);
  }

  @Post(':id/password')
  @RequirePermission('core.user.edit')
  @HttpCode(204)
  async resetPassword(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(resetPasswordSchema)) dto: ResetPasswordBody,
  ) {
    await this.users.resetPassword(scopeFromPrincipal(p), p, id, dto.password);
  }

  @Get(':id')
  @RequirePermission('core.user.view')
  get(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.findByIdOrThrow(scopeFromPrincipal(p), id);
  }

  @Patch(':id')
  @RequirePermission('core.user.edit')
  update(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updateUserSchema)) dto: UpdateUserBody,
  ) {
    return this.users.update(scopeFromPrincipal(p), id, dto);
  }

  @Post(':id/roles')
  @RequirePermission('core.role.assign')
  @HttpCode(204)
  async assignRole(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(assignRoleSchema)) dto: AssignRoleBody,
  ) {
    await this.users.assignRole(scopeFromPrincipal(p), p, id, dto);
  }

  @Delete(':id/roles/:roleId')
  @RequirePermission('core.role.assign')
  @HttpCode(204)
  async removeRole(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    await this.users.removeRole(scopeFromPrincipal(p), p, id, roleId);
  }
}
