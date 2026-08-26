import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ServiceRequestStatus } from '@prisma/client';
import { CurrentPrincipal, RequirePermission, scopeFromPrincipal, type Principal } from '../../iam/principal';
import { RequireModule } from '../../modules/module-gating.guard';
import { zodBody } from '../../common/zod-validation.pipe';
import { OrderService } from './order.service';
import {
  createDraftSchema,
  addLinesSchema,
  updateLineSchema,
  sendToKitchenSchema,
  cancelRequestSchema,
  cancelLineSchema,
  lineStatusSchema,
  type CreateDraftDto,
  type AddLinesDto,
  type UpdateLineDto,
  type SendToKitchenDto,
  type CancelRequestDto,
  type CancelLineDto,
  type LineStatusDto,
} from './order.dto';

@Controller('admin/orders')
@RequireModule('restaurant')
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  @Get()
  @RequirePermission('restaurant.order.view')
  list(
    @CurrentPrincipal() p: Principal,
    @Query('sessionId', new ParseUUIDPipe({ optional: true })) sessionId?: string,
    @Query('locationId', new ParseUUIDPipe({ optional: true })) locationId?: string,
    @Query('status', new ParseEnumPipe(ServiceRequestStatus, { optional: true })) status?: ServiceRequestStatus,
  ) {
    return this.orders.listRequests(scopeFromPrincipal(p), { sessionId, locationId, status });
  }

  @Get(':id')
  @RequirePermission('restaurant.order.view')
  findOne(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.findRequestOrThrow(scopeFromPrincipal(p), id);
  }

  @Post()
  @RequirePermission('restaurant.order.manage')
  createDraft(@CurrentPrincipal() p: Principal, @Body(zodBody(createDraftSchema)) dto: CreateDraftDto) {
    return this.orders.createDraft(scopeFromPrincipal(p), dto);
  }

  @Post(':id/lines')
  @RequirePermission('restaurant.order.manage')
  addLines(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(addLinesSchema)) dto: AddLinesDto,
  ) {
    return this.orders.addLines(scopeFromPrincipal(p), id, dto);
  }

  @Patch(':id/lines/:lineId')
  @RequirePermission('restaurant.order.manage')
  updateLine(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body(zodBody(updateLineSchema)) dto: UpdateLineDto,
  ) {
    return this.orders.updateLine(scopeFromPrincipal(p), id, lineId, dto);
  }

  @Delete(':id/lines/:lineId')
  @RequirePermission('restaurant.order.manage')
  @HttpCode(200)
  removeLine(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
  ) {
    return this.orders.removeLine(scopeFromPrincipal(p), id, lineId);
  }

  @Post(':id/send')
  @RequirePermission('restaurant.order.manage')
  send(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(sendToKitchenSchema)) dto: SendToKitchenDto,
  ) {
    return this.orders.sendToKitchen(scopeFromPrincipal(p), id, dto);
  }

  @Post(':id/cancel')
  @RequirePermission('restaurant.order.manage')
  cancel(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(cancelRequestSchema)) dto: CancelRequestDto,
  ) {
    return this.orders.cancelRequest(scopeFromPrincipal(p), id, dto);
  }

  @Post(':id/lines/:lineId/cancel')
  @RequirePermission('restaurant.order.manage')
  cancelLine(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body(zodBody(cancelLineSchema)) dto: CancelLineDto,
  ) {
    return this.orders.cancelLine(scopeFromPrincipal(p), id, lineId, dto);
  }

  @Post(':id/serve')
  @RequirePermission('restaurant.order.manage')
  serve(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(lineStatusSchema)) dto: LineStatusDto,
  ) {
    return this.orders.markServed(scopeFromPrincipal(p), id, dto.lineIds);
  }
}

@Controller('admin/kitchen')
@RequireModule('restaurant')
export class KitchenController {
  constructor(private readonly orders: OrderService) {}

  @Get()
  @RequirePermission('restaurant.kitchen.view')
  list(
    @CurrentPrincipal() p: Principal,
    @Query('locationId', new ParseUUIDPipe({ optional: true })) locationId?: string,
    @Query('productionAreaId', new ParseUUIDPipe({ optional: true })) productionAreaId?: string,
  ) {
    return this.orders.listKitchenQueue(scopeFromPrincipal(p), { locationId, productionAreaId });
  }

  @Post(':id/accept')
  @RequirePermission('restaurant.kitchen.manage')
  accept(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(lineStatusSchema)) dto: LineStatusDto,
  ) {
    return this.orders.acceptRequest(scopeFromPrincipal(p), id, dto.lineIds);
  }

  @Post(':id/prepare')
  @RequirePermission('restaurant.kitchen.manage')
  startPreparation(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(lineStatusSchema)) dto: LineStatusDto,
  ) {
    return this.orders.startPreparation(scopeFromPrincipal(p), id, dto.lineIds);
  }

  @Post(':id/ready')
  @RequirePermission('restaurant.kitchen.manage')
  markReady(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(lineStatusSchema)) dto: LineStatusDto,
  ) {
    return this.orders.markReady(scopeFromPrincipal(p), id, dto.lineIds);
  }
}
