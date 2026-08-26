import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentPrincipal, RequirePermission, scopeFromPrincipal, type Principal } from '../../iam/principal';
import { RequireModule } from '../../modules/module-gating.guard';
import { zodBody } from '../../common/zod-validation.pipe';
import { BookingService } from './booking.service';
import {
  createBookingSchema,
  updateBookingSchema,
  type CreateBookingDto,
  type UpdateBookingDto,
} from './booking.dto';

@Controller('admin/bookings')
@RequireModule('restaurant')
export class BookingController {
  constructor(private readonly bookings: BookingService) {}

  @Get()
  @RequirePermission('restaurant.booking.view')
  list(@CurrentPrincipal() p: Principal, @Query('locationId', new ParseUUIDPipe({ optional: true })) locationId?: string) {
    return this.bookings.list(scopeFromPrincipal(p), locationId);
  }

  @Get(':id')
  @RequirePermission('restaurant.booking.view')
  findOne(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.bookings.findByIdOrThrow(scopeFromPrincipal(p), id);
  }

  @Post()
  @RequirePermission('restaurant.booking.manage')
  create(
    @CurrentPrincipal() p: Principal,
    @Body(zodBody(createBookingSchema)) dto: CreateBookingDto,
  ) {
    return this.bookings.create(scopeFromPrincipal(p), dto);
  }

  @Patch(':id')
  @RequirePermission('restaurant.booking.manage')
  update(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updateBookingSchema)) dto: UpdateBookingDto,
  ) {
    return this.bookings.update(scopeFromPrincipal(p), id, dto);
  }
}
