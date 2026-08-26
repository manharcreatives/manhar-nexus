import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { BusinessExistsGuard } from '../common/business-exists.guard';
import { zodBody } from '../common/zod-validation.pipe';
import { UserService } from './user.service';
import { createUserSchema, type CreateUserBody } from './iam.dto';
import {
  CurrentPrincipal,
  RequirePermission,
  scopeForPlatform,
  type Principal,
} from './principal';

/**
 * Platform-realm endpoint to provision a business's users (e.g. its first
 * Owner) right after the business is created via /internal. businessId comes
 * from the validated path param because platform admins act cross-business.
 */
@Controller('internal/businesses/:businessId/users')
@UseGuards(BusinessExistsGuard)
export class PlatformUserController {
  constructor(private readonly users: UserService) {}

  @Post()
  @RequirePermission('platform.business.configure')
  create(
    @CurrentPrincipal() p: Principal,
    @Param('businessId') businessId: string,
    @Body(zodBody(createUserSchema)) dto: CreateUserBody,
  ) {
    return this.users.create(scopeForPlatform(p, businessId), p, {
      ...dto,
      roleKeys: dto.roleKeys ?? ['owner'],
    });
  }

  @Get()
  @RequirePermission('platform.business.view')
  list(@CurrentPrincipal() p: Principal, @Param('businessId') businessId: string) {
    return this.users.list(scopeForPlatform(p, businessId));
  }
}
