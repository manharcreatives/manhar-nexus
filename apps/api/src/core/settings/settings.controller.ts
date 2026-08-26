import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { BusinessExistsGuard } from '../../common/business-exists.guard';
import { CurrentActor, scopeFor } from '../../common/current-actor.decorator';
import { RequirePermission } from '../../iam/principal';
import { zodBody } from '../../common/zod-validation.pipe';
import type { ActorContext } from '../../common/tenant-scope';
import { SettingsService } from './settings.service';
import {
  setSettingSchema,
  settingScopeQuerySchema,
  type SetSettingDto,
  type SettingScopeQuery,
} from './settings.dto';

const namespaceQuerySchema = settingScopeQuerySchema.extend({
  namespace: z.string().trim().min(1),
});

@Controller('internal/businesses/:businessId/settings')
@RequirePermission('platform.setting.manage')
@UseGuards(BusinessExistsGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Raw stored setting rows (both scopes). */
  @Get('raw')
  listRaw(@CurrentActor() actor: ActorContext, @Param('businessId') businessId: string) {
    return this.settings.listRaw(scopeFor(actor, businessId));
  }

  /** Effective values for a whole namespace, optionally at a location. */
  @Get('effective')
  effectiveNamespace(
    @CurrentActor() actor: ActorContext,
    @Param('businessId') businessId: string,
    @Query(zodBody(namespaceQuerySchema)) q: SettingScopeQuery & { namespace: string },
  ) {
    return this.settings.getEffectiveNamespace(
      scopeFor(actor, businessId),
      q.namespace,
      q.locationId,
    );
  }

  /** Effective value for one setting. */
  @Get(':namespace/:key')
  effective(
    @CurrentActor() actor: ActorContext,
    @Param('businessId') businessId: string,
    @Param('namespace') namespace: string,
    @Param('key') key: string,
    @Query(zodBody(settingScopeQuerySchema)) q: SettingScopeQuery,
  ) {
    return this.settings.getEffective(scopeFor(actor, businessId), namespace, key, q.locationId);
  }

  /** Create/update one setting at business or (with ?locationId=) location scope. */
  @Put(':namespace/:key')
  set(
    @CurrentActor() actor: ActorContext,
    @Param('businessId') businessId: string,
    @Param('namespace') namespace: string,
    @Param('key') key: string,
    @Query(zodBody(settingScopeQuerySchema)) q: SettingScopeQuery,
    @Body(zodBody(setSettingSchema)) dto: SetSettingDto,
  ) {
    return this.settings.set(scopeFor(actor, businessId), namespace, key, dto.value, {
      locationId: q.locationId,
      expectedVersion: dto.expectedVersion,
    });
  }
}
