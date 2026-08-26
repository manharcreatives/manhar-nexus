import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { LocationService } from '../core/location/location.service';
import {
  createLocationSchema,
  updateLocationSchema,
  upsertLocationHoursSchema,
  upsertServiceModesSchema,
  type CreateLocationDto,
  type UpdateLocationDto,
  type UpsertLocationHoursDto,
  type UpsertServiceModesDto,
} from '../core/location/location.dto';
import { zodBody } from '../common/zod-validation.pipe';
import {
  CurrentPrincipal,
  RequirePermission,
  canAccessLocation,
  scopeFromPrincipal,
  type Principal,
} from './principal';

/**
 * Business-realm location management, enforcing BOTH business scope (from the
 * principal) and location scope (a user restricted to certain locations can
 * only see/act on those).
 */
@Controller('admin/locations')
export class BusinessLocationController {
  constructor(private readonly locations: LocationService) {}

  @Post()
  @RequirePermission('core.location.create')
  create(@CurrentPrincipal() p: Principal, @Body(zodBody(createLocationSchema)) dto: CreateLocationDto) {
    return this.locations.create(scopeFromPrincipal(p), dto);
  }

  @Get()
  @RequirePermission('core.location.view')
  async list(@CurrentPrincipal() p: Principal) {
    const all = await this.locations.list(scopeFromPrincipal(p));
    return p.allLocations ? all : all.filter((l) => canAccessLocation(p, l.id));
  }

  @Get(':locationId')
  @RequirePermission('core.location.view', { locationParam: 'locationId' })
  get(@CurrentPrincipal() p: Principal, @Param('locationId', ParseUUIDPipe) locationId: string) {
    return this.locations.findByIdOrThrow(scopeFromPrincipal(p), locationId);
  }

  @Patch(':locationId')
  @RequirePermission('core.location.edit', { locationParam: 'locationId' })
  update(
    @CurrentPrincipal() p: Principal,
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Body(zodBody(updateLocationSchema)) dto: UpdateLocationDto,
  ) {
    return this.locations.update(scopeFromPrincipal(p), locationId, dto);
  }

  // ── Operating Hours ────────────────────────────────────────────────────────

  @Get(':locationId/hours')
  @RequirePermission('core.location.view', { locationParam: 'locationId' })
  getHours(@CurrentPrincipal() p: Principal, @Param('locationId', ParseUUIDPipe) locationId: string) {
    return this.locations.getHours(scopeFromPrincipal(p), locationId);
  }

  @Put(':locationId/hours')
  @RequirePermission('core.location.edit', { locationParam: 'locationId' })
  upsertHours(
    @CurrentPrincipal() p: Principal,
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Body(zodBody(upsertLocationHoursSchema)) dto: UpsertLocationHoursDto,
  ) {
    return this.locations.upsertHours(scopeFromPrincipal(p), locationId, dto);
  }

  // ── Service Modes ──────────────────────────────────────────────────────────

  @Get(':locationId/service-modes')
  @RequirePermission('core.location.view', { locationParam: 'locationId' })
  getServiceModes(
    @CurrentPrincipal() p: Principal,
    @Param('locationId', ParseUUIDPipe) locationId: string,
  ) {
    return this.locations.getServiceModes(scopeFromPrincipal(p), locationId);
  }

  @Put(':locationId/service-modes')
  @RequirePermission('core.location.edit', { locationParam: 'locationId' })
  upsertServiceModes(
    @CurrentPrincipal() p: Principal,
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Body(zodBody(upsertServiceModesSchema)) dto: UpsertServiceModesDto,
  ) {
    return this.locations.upsertServiceModes(scopeFromPrincipal(p), locationId, dto);
  }
}
