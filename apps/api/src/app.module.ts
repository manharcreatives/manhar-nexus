import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './config/configuration';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: (raw: Record<string, unknown>) => {
        const parsed = envSchema.safeParse(raw);
        if (!parsed.success) {
          throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
        }
        return parsed.data;
      },
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
  ],
})
export class AppModule {}
