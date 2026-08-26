import { Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentPrincipal, RequirePermission, scopeFromPrincipal, type Principal } from '../iam/principal';
import { ModuleService } from './module.service';

/**
 * Business-realm: owners manage their own business's module activations.
 * BusinessId always comes from the authenticated principal — never the URL.
 */
@Controller('admin/modules')
export class ModuleController {
  constructor(private readonly modules: ModuleService) {}

  @Get()
  @RequirePermission('core.modules.view')
  list(@CurrentPrincipal() p: Principal) {
    if (!p.businessId) return [];
    return this.modules.listForBusiness(p.businessId);
  }

  @Get(':moduleKey')
  @RequirePermission('core.modules.view')
  get(@CurrentPrincipal() p: Principal, @Param('moduleKey') moduleKey: string) {
    if (!p.businessId) return null;
    return this.modules.getForBusiness(p.businessId, moduleKey);
  }

  @Post(':moduleKey/activate')
  @RequirePermission('core.modules.manage')
  activate(@CurrentPrincipal() p: Principal, @Param('moduleKey') moduleKey: string) {
    return this.modules.activate(scopeFromPrincipal(p), moduleKey);
  }

  @Post(':moduleKey/complete-setup')
  @RequirePermission('core.modules.manage')
  completeSetup(@CurrentPrincipal() p: Principal, @Param('moduleKey') moduleKey: string) {
    return this.modules.completeSetup(scopeFromPrincipal(p), moduleKey);
  }

  @Post(':moduleKey/disable')
  @RequirePermission('core.modules.manage')
  disable(@CurrentPrincipal() p: Principal, @Param('moduleKey') moduleKey: string) {
    return this.modules.disable(scopeFromPrincipal(p), moduleKey);
  }

  @Post(':moduleKey/resume')
  @RequirePermission('core.modules.manage')
  resume(@CurrentPrincipal() p: Principal, @Param('moduleKey') moduleKey: string) {
    return this.modules.resume(scopeFromPrincipal(p), moduleKey);
  }
}
