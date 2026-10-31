import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentPrincipal, RequirePermission, scopeFromPrincipal, type Principal } from '../../iam/principal';
import { RequireModule } from '../../modules/module-gating.guard';
import { zodBody } from '../../common/zod-validation.pipe';
import { OrderEditService } from './order-edit.service';
import { editOrderSchema, type EditOrderDto } from './order-edit.dto';

/**
 * Order edit before the kitchen starts it (update round 2, A2).
 *   POST /admin/orders/:id/edit    audited, idempotent, version-checked edit      (restaurant.order.edit)
 *   GET  /admin/orders/:id/edits   { editable: {allowed, reason?, message?}, edits } (restaurant.order.view)
 * Errors: 409 ORDER_EDIT_LOCKED (details.reason), 409 VERSION_CONFLICT, 400 VALIDATION (details.reason NO_CHANGES | EMPTY_ORDER | ...).
 */
@Controller('admin/orders')
@RequireModule('restaurant')
export class OrderEditController {
  constructor(private readonly edits: OrderEditService) {}

  @Post(':id/edit')
  @HttpCode(200)
  @RequirePermission('restaurant.order.edit')
  edit(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(editOrderSchema)) dto: EditOrderDto,
  ) {
    return this.edits.editOrder(scopeFromPrincipal(p), id, dto);
  }

  @Get(':id/edits')
  @RequirePermission('restaurant.order.view')
  state(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.edits.getEditState(scopeFromPrincipal(p), id);
  }
}
