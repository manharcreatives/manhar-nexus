import { Body, Controller, Get, Patch } from '@nestjs/common';
import { BusinessService } from '../core/business/business.service';
import { updateBusinessSchema, type UpdateBusinessDto } from '../core/business/business.dto';
import { zodBody } from '../common/zod-validation.pipe';
import { CurrentPrincipal, RequirePermission, actorOf, type Principal } from './principal';
import { ForbiddenError } from '../common/errors';

/**
 * Business-realm self-service: a logged-in business user can view and update
 * their own Business Workspace profile (name, branding, invoice identity).
 * BusinessId comes from the authenticated principal — never the URL.
 */
@Controller('admin/business')
export class AdminBusinessController {
  constructor(private readonly business: BusinessService) {}

  @Get()
  @RequirePermission('core.business.view')
  get(@CurrentPrincipal() p: Principal) {
    if (!p.businessId) throw new ForbiddenError('No business context');
    return this.business.findByIdOrThrow(p.businessId);
  }

  @Patch()
  @RequirePermission('core.business.configure')
  update(
    @CurrentPrincipal() p: Principal,
    @Body(zodBody(updateBusinessSchema)) dto: UpdateBusinessDto,
  ) {
    if (!p.businessId) throw new ForbiddenError('No business context');
    return this.business.update(actorOf(p), p.businessId, dto);
  }
}
