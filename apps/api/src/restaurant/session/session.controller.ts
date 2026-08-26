import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { GuestSessionStatus } from '@prisma/client';
import { CurrentPrincipal, RequirePermission, scopeFromPrincipal, type Principal } from '../../iam/principal';
import { RequireModule } from '../../modules/module-gating.guard';
import { zodBody } from '../../common/zod-validation.pipe';
import { SessionService } from './session.service';
import {
  openSessionSchema,
  updateSessionSchema,
  closeSessionSchema,
  voidSessionSchema,
  seatBookingSchema,
  type OpenSessionDto,
  type UpdateSessionDto,
  type CloseSessionDto,
  type VoidSessionDto,
  type SeatBookingDto,
} from './session.dto';

@Controller('admin/sessions')
@RequireModule('restaurant')
export class SessionController {
  constructor(private readonly sessions: SessionService) {}

  @Get()
  @RequirePermission('restaurant.session.view')
  list(
    @CurrentPrincipal() p: Principal,
    @Query('locationId', new ParseUUIDPipe({ optional: true })) locationId?: string,
    @Query('tableId', new ParseUUIDPipe({ optional: true })) tableId?: string,
    @Query('status', new ParseEnumPipe(GuestSessionStatus, { optional: true })) status?: GuestSessionStatus,
  ) {
    return this.sessions.listSessions(scopeFromPrincipal(p), { locationId, tableId, status });
  }

  @Get(':id')
  @RequirePermission('restaurant.session.view')
  findOne(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.sessions.findSessionOrThrow(scopeFromPrincipal(p), id);
  }

  @Post()
  @RequirePermission('restaurant.session.manage')
  open(@CurrentPrincipal() p: Principal, @Body(zodBody(openSessionSchema)) dto: OpenSessionDto) {
    return this.sessions.openSession(scopeFromPrincipal(p), dto);
  }

  @Patch(':id')
  @RequirePermission('restaurant.session.manage')
  update(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updateSessionSchema)) dto: UpdateSessionDto,
  ) {
    return this.sessions.updateSession(scopeFromPrincipal(p), id, dto);
  }

  @Post(':id/close')
  @RequirePermission('restaurant.session.manage')
  close(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(closeSessionSchema)) dto: CloseSessionDto,
  ) {
    return this.sessions.closeSession(scopeFromPrincipal(p), id, dto);
  }

  @Post(':id/void')
  @RequirePermission('restaurant.session.manage')
  void_(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(voidSessionSchema)) dto: VoidSessionDto,
  ) {
    return this.sessions.voidSession(scopeFromPrincipal(p), id, dto);
  }

  @Post('bookings/:bookingId/seat')
  @RequirePermission('restaurant.session.manage')
  seatBooking(
    @CurrentPrincipal() p: Principal,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body(zodBody(seatBookingSchema)) dto: SeatBookingDto,
  ) {
    return this.sessions.seatBooking(scopeFromPrincipal(p), bookingId, dto);
  }
}

@Controller('admin/dining/tables')
@RequireModule('restaurant')
export class TableResetController {
  constructor(private readonly sessions: SessionService) {}

  @Post(':id/reset')
  @RequirePermission('restaurant.dining.manage')
  @HttpCode(204)
  async resetTable(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.sessions.resetTable(scopeFromPrincipal(p), id);
  }
}
