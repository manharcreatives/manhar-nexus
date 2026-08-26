import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentPrincipal, RequirePermission, scopeFromPrincipal, type Principal } from '../../iam/principal';
import { RequireModule } from '../../modules/module-gating.guard';
import { zodBody } from '../../common/zod-validation.pipe';
import { PeopleService } from './people.service';
import {
  createStaffProfileSchema,
  updateStaffProfileSchema,
  createGuestSchema,
  updateGuestSchema,
  type CreateStaffProfileDto,
  type UpdateStaffProfileDto,
  type CreateGuestDto,
  type UpdateGuestDto,
} from './people.dto';

@Controller('admin/staff')
@RequireModule('restaurant')
export class StaffController {
  constructor(private readonly people: PeopleService) {}

  @Get()
  @RequirePermission('restaurant.staff.view')
  list(@CurrentPrincipal() p: Principal) {
    return this.people.listStaff(scopeFromPrincipal(p));
  }

  @Get(':id')
  @RequirePermission('restaurant.staff.view')
  findOne(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.people.findStaffOrThrow(scopeFromPrincipal(p), id);
  }

  @Post()
  @RequirePermission('restaurant.staff.manage')
  create(
    @CurrentPrincipal() p: Principal,
    @Body(zodBody(createStaffProfileSchema)) dto: CreateStaffProfileDto,
  ) {
    return this.people.createStaff(scopeFromPrincipal(p), dto);
  }

  @Patch(':id')
  @RequirePermission('restaurant.staff.manage')
  update(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updateStaffProfileSchema)) dto: UpdateStaffProfileDto,
  ) {
    return this.people.updateStaff(scopeFromPrincipal(p), id, dto);
  }

  @Delete(':id')
  @RequirePermission('restaurant.staff.manage')
  @HttpCode(204)
  async remove(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    await this.people.deleteStaff(scopeFromPrincipal(p), id);
  }
}

@Controller('admin/guests')
@RequireModule('restaurant')
export class GuestController {
  constructor(private readonly people: PeopleService) {}

  @Get()
  @RequirePermission('restaurant.guest.view')
  list(@CurrentPrincipal() p: Principal) {
    return this.people.listGuests(scopeFromPrincipal(p));
  }

  @Get(':id')
  @RequirePermission('restaurant.guest.view')
  findOne(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.people.findGuestOrThrow(scopeFromPrincipal(p), id);
  }

  @Post()
  @RequirePermission('restaurant.guest.manage')
  create(
    @CurrentPrincipal() p: Principal,
    @Body(zodBody(createGuestSchema)) dto: CreateGuestDto,
  ) {
    return this.people.createGuest(scopeFromPrincipal(p), dto);
  }

  @Patch(':id')
  @RequirePermission('restaurant.guest.manage')
  update(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updateGuestSchema)) dto: UpdateGuestDto,
  ) {
    return this.people.updateGuest(scopeFromPrincipal(p), id, dto);
  }

  @Delete(':id')
  @RequirePermission('restaurant.guest.manage')
  @HttpCode(204)
  async remove(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    await this.people.deleteGuest(scopeFromPrincipal(p), id);
  }
}
