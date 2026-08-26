import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BusinessExistsGuard } from '../../common/business-exists.guard';
import { CurrentActor, scopeFor } from '../../common/current-actor.decorator';
import { RequirePermission } from '../../iam/principal';
import { zodBody } from '../../common/zod-validation.pipe';
import type { ActorContext } from '../../common/tenant-scope';
import { LocationService } from './location.service';
import {
  createLocationSchema,
  updateLocationSchema,
  type CreateLocationDto,
  type UpdateLocationDto,
} from './location.dto';

@Controller('internal/businesses/:businessId/locations')
@RequirePermission('platform.location.manage')
@UseGuards(BusinessExistsGuard)
export class LocationController {
  constructor(private readonly locations: LocationService) {}

  @Post()
  create(
    @CurrentActor() actor: ActorContext,
    @Param('businessId') businessId: string,
    @Body(zodBody(createLocationSchema)) dto: CreateLocationDto,
  ) {
    return this.locations.create(scopeFor(actor, businessId), dto);
  }

  @Get()
  list(@CurrentActor() actor: ActorContext, @Param('businessId') businessId: string) {
    return this.locations.list(scopeFor(actor, businessId));
  }

  @Get(':locationId')
  get(
    @CurrentActor() actor: ActorContext,
    @Param('businessId') businessId: string,
    @Param('locationId', ParseUUIDPipe) locationId: string,
  ) {
    return this.locations.findByIdOrThrow(scopeFor(actor, businessId), locationId);
  }

  @Patch(':locationId')
  update(
    @CurrentActor() actor: ActorContext,
    @Param('businessId') businessId: string,
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Body(zodBody(updateLocationSchema)) dto: UpdateLocationDto,
  ) {
    return this.locations.update(scopeFor(actor, businessId), locationId, dto);
  }
}
