import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { BusinessExistsGuard } from '../common/business-exists.guard';
import { CurrentActor } from '../common/current-actor.decorator';
import type { ActorContext } from '../common/tenant-scope';
import { RequirePermission } from '../iam/principal';
import { ModuleService } from './module.service';

/**
 * Platform-realm: Manhar staff manage modules on behalf of any business.
 * Lives under /internal/businesses/:businessId/modules so BusinessExistsGuard
 * validates the businessId before any operation.
 */
@Controller('internal/businesses/:businessId/modules')
@RequirePermission('platform.modules.manage')
@UseGuards(BusinessExistsGuard)
export class PlatformModuleController {
  constructor(private readonly modules: ModuleService) {}

  @Get()
  list(@Param('businessId') businessId: string) {
    return this.modules.listForBusiness(businessId);
  }

  @Get(':moduleKey')
  get(
    @Param('businessId') businessId: string,
    @Param('moduleKey') moduleKey: string,
  ) {
    return this.modules.getForBusiness(businessId, moduleKey);
  }

  @Post(':moduleKey/activate')
  activate(
    @CurrentActor() actor: ActorContext,
    @Param('businessId') businessId: string,
    @Param('moduleKey') moduleKey: string,
  ) {
    return this.modules.activate({ businessId, actor }, moduleKey);
  }

  @Post(':moduleKey/complete-setup')
  completeSetup(
    @CurrentActor() actor: ActorContext,
    @Param('businessId') businessId: string,
    @Param('moduleKey') moduleKey: string,
  ) {
    return this.modules.completeSetup({ businessId, actor }, moduleKey);
  }

  @Post(':moduleKey/suspend')
  suspend(
    @CurrentActor() actor: ActorContext,
    @Param('businessId') businessId: string,
    @Param('moduleKey') moduleKey: string,
  ) {
    return this.modules.suspend({ businessId, actor }, moduleKey);
  }

  @Post(':moduleKey/unsuspend')
  unsuspend(
    @CurrentActor() actor: ActorContext,
    @Param('businessId') businessId: string,
    @Param('moduleKey') moduleKey: string,
  ) {
    return this.modules.unsuspend({ businessId, actor }, moduleKey);
  }
}
