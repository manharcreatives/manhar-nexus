import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { CurrentPrincipal, RequirePermission, scopeFromPrincipal, type Principal } from '../../iam/principal';
import { RequireModule } from '../../modules/module-gating.guard';
import { OrderTimelineService } from './order-timeline.service';

/**
 * GET /admin/kitchen/:id/timeline: what happened to one order, step by step, with who did it
 * and how long each step took. View-only (`restaurant.kitchen.view`), same audience as the KOS.
 */
@Controller('admin/kitchen')
@RequireModule('restaurant')
export class OrderTimelineController {
  constructor(private readonly timelines: OrderTimelineService) {}

  @Get(':id/timeline')
  @RequirePermission('restaurant.kitchen.view')
  timeline(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.timelines.timeline(scopeFromPrincipal(p), p, id);
  }
}
