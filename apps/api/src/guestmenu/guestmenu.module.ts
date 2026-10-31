import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CoreModule } from '../core/core.module';
import { ModulesModule } from '../modules/modules.module';
import { RestaurantModule } from '../restaurant/restaurant.module';
import { GuestHub } from './guest-hub.service';
import { GuestOrderAdminService } from './guest-order-admin.service';
import { GuestOrderService } from './guest-order.service';
import { GuestTokenService } from './guest-token.service';
import { IMAGE_STORE, LocalDiskImageStore } from './image/image-store';
import { ImageService } from './image/image.service';
import { GuestOrderAdminController, MenuAdminController, MenuPresentationService, QrAdminController } from './admin.controllers';
import { MediaController } from './media.controller';
import { MenuChangeInterceptor } from './menu-change.interceptor';
import { MenuService } from './menu.service';
import { PublicMenuController } from './public-menu.controller';
import { QrAdminService } from './qr-admin.service';
import { RateLimiter } from './rate-limiter.service';
import { TableContextService } from './table-context.service';

/**
 * QR Digital Menu ("Nexus Menu"), ADR-035.
 *   public   /public/menu/:tableToken/*   (rate limited, no login)      /media/:businessId/:file
 *   staff    /admin/qr/*   /admin/menu/*   /admin/guest-orders/*        (restaurant.qr.manage / restaurant.guestorder.manage)
 * Guest orders are ordinary service requests (source GUEST), so the kitchen, bill and reports need no special cases.
 */
@Module({
  imports: [CoreModule, ModulesModule, RestaurantModule],
  controllers: [PublicMenuController, MediaController, QrAdminController, MenuAdminController, GuestOrderAdminController],
  providers: [
    RateLimiter,
    TableContextService,
    MenuService,
    GuestTokenService,
    GuestOrderService,
    GuestHub,
    QrAdminService,
    GuestOrderAdminService,
    ImageService,
    MenuPresentationService,
    { provide: IMAGE_STORE, useClass: LocalDiskImageStore },
    { provide: APP_INTERCEPTOR, useClass: MenuChangeInterceptor },
  ],
})
export class GuestMenuModule {}
