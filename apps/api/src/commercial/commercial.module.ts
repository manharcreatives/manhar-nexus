import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OfferingService } from './offering.service';
import { OfferingController } from './offering.controller';
import { PriceBookService } from './price-book.service';
import { PriceBookController } from './price-book.controller';
import { BundleService } from './bundle.service';
import { BundleController } from './bundle.controller';
import { ClientAccountService } from './client-account.service';
import { ClientAccountController } from './client-account.controller';
import { ActivationService } from './activation.service';
import { ActivationController } from './activation.controller';

@Module({
  imports: [PrismaModule],
  providers: [
    OfferingService,
    PriceBookService,
    BundleService,
    ClientAccountService,
    ActivationService,
  ],
  controllers: [
    OfferingController,
    PriceBookController,
    BundleController,
    ClientAccountController,
    ActivationController,
  ],
})
export class CommercialModule {}
