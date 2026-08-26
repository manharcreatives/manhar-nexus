import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { CatalogService } from './catalog/catalog.service';
import {
  TaxCategoryController,
  CatalogCategoryController,
  CatalogItemController,
  ModifierGroupController,
  ProductionAreaController,
} from './catalog/catalog.controller';
import { DiningService } from './dining/dining.service';
import { DiningAreaController, DiningTableController } from './dining/dining.controller';
import { PeopleService } from './people/people.service';
import { StaffController, GuestController } from './people/people.controller';
import { BookingService } from './booking/booking.service';
import { BookingController } from './booking/booking.controller';
import { SessionService } from './session/session.service';
import { SessionController, TableResetController } from './session/session.controller';
import { OrderService } from './order/order.service';
import { OrderController, KitchenController } from './order/order.controller';

/**
 * Phase 8 — Restaurant Operations.
 * Extends Phase 7 with: production areas, guest sessions, service requests
 * (full DRAFT→SENT→ACCEPTED→PREPARING→READY→SERVED state machine), and
 * kitchen queue.  All routes require the 'restaurant' (or 'catalog') module
 * to be ACTIVE for the business.
 */
@Module({
  imports: [CoreModule],
  controllers: [
    TaxCategoryController,
    CatalogCategoryController,
    CatalogItemController,
    ModifierGroupController,
    ProductionAreaController,
    DiningAreaController,
    DiningTableController,
    StaffController,
    GuestController,
    BookingController,
    SessionController,
    TableResetController,
    OrderController,
    KitchenController,
  ],
  providers: [CatalogService, DiningService, PeopleService, BookingService, SessionService, OrderService],
})
export class RestaurantModule {}
