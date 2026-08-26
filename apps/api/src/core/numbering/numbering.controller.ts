import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { BusinessExistsGuard } from '../../common/business-exists.guard';
import { CurrentActor, scopeFor } from '../../common/current-actor.decorator';
import { RequirePermission } from '../../iam/principal';
import { zodBody } from '../../common/zod-validation.pipe';
import type { ActorContext } from '../../common/tenant-scope';
import { NumberingService } from './numbering.service';
import {
  allocateQuerySchema,
  configureNumberingSchema,
  type AllocateQuery,
  type ConfigureNumberingDto,
} from './numbering.dto';

@Controller('internal/businesses/:businessId/numbering')
@RequirePermission('platform.numbering.manage')
@UseGuards(BusinessExistsGuard)
export class NumberingController {
  constructor(private readonly numbering: NumberingService) {}

  @Get()
  list(@CurrentActor() actor: ActorContext, @Param('businessId') businessId: string) {
    return this.numbering.list(scopeFor(actor, businessId));
  }

  @Post(':key/allocate')
  allocate(
    @CurrentActor() actor: ActorContext,
    @Param('businessId') businessId: string,
    @Param('key') key: string,
    @Query(zodBody(allocateQuerySchema)) q: AllocateQuery,
  ) {
    return this.numbering.allocate(scopeFor(actor, businessId), key, { locationId: q.locationId });
  }

  @Post(':key/configure')
  configure(
    @CurrentActor() actor: ActorContext,
    @Param('businessId') businessId: string,
    @Param('key') key: string,
    @Body(zodBody(configureNumberingSchema)) dto: ConfigureNumberingDto,
  ) {
    return this.numbering.configure(scopeFor(actor, businessId), key, dto);
  }
}
