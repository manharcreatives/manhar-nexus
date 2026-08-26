import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentPrincipal, RequirePermission, scopeFromPrincipal, type Principal } from '../../iam/principal';
import { zodBody } from '../../common/zod-validation.pipe';
import { SettingsService } from './settings.service';
import { SettingsRegistry } from './settings.registry';
import {
  setSettingSchema,
  settingScopeQuerySchema,
  type SetSettingDto,
  type SettingScopeQuery,
} from './settings.dto';

const namespaceQuerySchema = settingScopeQuerySchema.extend({
  namespace: z.string().trim().min(1),
});

/**
 * Business-realm settings API.
 * businessId comes from the authenticated principal (NEVER the URL).
 */
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly registry: SettingsRegistry,
  ) {}

  /** List all known setting definitions (schema catalog for the frontend). */
  @Get('schema')
  @RequirePermission('core.setting.view')
  schema(@Query('namespace') namespace?: string) {
    return this.registry.list(namespace).map((d) => ({
      namespace: d.namespace,
      key: d.key,
      valueType: d.valueType,
      description: d.description,
      default: d.default,
      sensitive: d.sensitive ?? false,
    }));
  }

  /** Effective values for a whole namespace, with optional location override. */
  @Get('effective')
  @RequirePermission('core.setting.view')
  effectiveNamespace(
    @CurrentPrincipal() p: Principal,
    @Query(zodBody(namespaceQuerySchema)) q: SettingScopeQuery & { namespace: string },
  ) {
    return this.settings.getEffectiveNamespace(
      scopeFromPrincipal(p),
      q.namespace,
      q.locationId,
    );
  }

  /** Effective value for one setting. */
  @Get(':namespace/:key')
  @RequirePermission('core.setting.view')
  effective(
    @CurrentPrincipal() p: Principal,
    @Param('namespace') namespace: string,
    @Param('key') key: string,
    @Query(zodBody(settingScopeQuerySchema)) q: SettingScopeQuery,
  ) {
    return this.settings.getEffective(scopeFromPrincipal(p), namespace, key, q.locationId);
  }

  /** Create or update one setting at business or (with ?locationId=) location scope. */
  @Put(':namespace/:key')
  @RequirePermission('core.setting.edit')
  set(
    @CurrentPrincipal() p: Principal,
    @Param('namespace') namespace: string,
    @Param('key') key: string,
    @Query(zodBody(settingScopeQuerySchema)) q: SettingScopeQuery,
    @Body(zodBody(setSettingSchema)) dto: SetSettingDto,
  ) {
    return this.settings.set(scopeFromPrincipal(p), namespace, key, dto.value, {
      locationId: q.locationId,
      expectedVersion: dto.expectedVersion,
    });
  }
}
