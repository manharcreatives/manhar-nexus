import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { CoreModule } from './core/core.module';
import { IamModule } from './iam/iam.module';
import { ModulesModule } from './modules/modules.module';
import { RestaurantModule } from './restaurant/restaurant.module';
import { CheckoutModule } from './checkout/checkout.module';
import { PrintingModule } from './printing/printing.module';
import { ReportsModule } from './reports/reports.module';
import { CommercialModule } from './commercial/commercial.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { CostsModule } from './costs/costs.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RegistrationModule } from './registration/registration.module';
import { GuestMenuModule } from './guestmenu/guestmenu.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Fail fast on missing/invalid config; refuses dev defaults in production.
      validate: validateEnv,
    }),
    PrismaModule,
    HealthModule,
    CoreModule,
    IamModule,
    // Phase 5: registers ModuleGatingGuard after the IAM guards.
    ModulesModule,
    // Phase 7: Restaurant MVP — Catalog, Dining Space, Staff, Guests, Bookings.
    RestaurantModule,
    // Phase 9: Checkout & Payments.
    CheckoutModule,
    // Phase 10: Printing & Hardware.
    PrintingModule,
    // Phase 11: Reports / Alerts / Audit.
    ReportsModule,
    // Phase 12: Commercial / Add-on Management.
    CommercialModule,
    // Phase 13: Onboarding / Deployment.
    OnboardingModule,
    // Phase 16: Operating Costs.
    CostsModule,
    // Realtime change notifications (SSE), ADR-032.
    RealtimeModule,
    // Public landing-page registration requests + platform triage, ADR-033.
    RegistrationModule,
    // QR digital menu / guest self-ordering, ADR-035.
    GuestMenuModule,
  ],
})
export class AppModule {}
