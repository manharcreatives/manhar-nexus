import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentPrincipal, RequirePermission, scopeFromPrincipal, type Principal } from '../../iam/principal';
import { zodBody } from '../../common/zod-validation.pipe';
import { AlertRuleService } from './alert-rule.service';
import {
  createAlertRuleSchema,
  updateAlertRuleSchema,
  type CreateAlertRuleDto,
  type UpdateAlertRuleDto,
} from './alert-rule.dto';

/**
 * Business-realm alert-rule registry.
 * businessId comes from the authenticated principal (NEVER the URL).
 */
@Controller('admin/alerts/rules')
export class AlertRuleController {
  constructor(private readonly rules: AlertRuleService) {}

  @Get()
  @RequirePermission('core.alert.view')
  list(@CurrentPrincipal() p: Principal) {
    return this.rules.list(scopeFromPrincipal(p));
  }

  @Get(':id')
  @RequirePermission('core.alert.view')
  findOne(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.rules.findByIdOrThrow(scopeFromPrincipal(p), id);
  }

  @Post()
  @RequirePermission('core.alert.edit')
  create(
    @CurrentPrincipal() p: Principal,
    @Body(zodBody(createAlertRuleSchema)) dto: CreateAlertRuleDto,
  ) {
    return this.rules.create(scopeFromPrincipal(p), dto);
  }

  @Patch(':id')
  @RequirePermission('core.alert.edit')
  update(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updateAlertRuleSchema)) dto: UpdateAlertRuleDto,
  ) {
    return this.rules.update(scopeFromPrincipal(p), id, dto);
  }

  @Delete(':id')
  @RequirePermission('core.alert.edit')
  @HttpCode(204)
  async remove(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    await this.rules.remove(scopeFromPrincipal(p), id);
  }
}
