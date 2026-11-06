import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { PasswordService } from '../iam/password.service';
import { ModulesModule } from '../modules/modules.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { AutoProvisionService } from './auto-provision.service';
import { BillingRecordService } from './billing-record.service';
import { RegistrationProvisioningController } from './registration-provisioning.controller';
import { RegistrationProvisioningService } from './registration-provisioning.service';

/**
 * The resumable "create the restaurant account" job for registration requests, its automatic trigger after a payment,
 * and the billing record on the client. PrismaModule is global.
 */
@Module({
  imports: [CoreModule, ModulesModule, OnboardingModule],
  controllers: [RegistrationProvisioningController],
  providers: [RegistrationProvisioningService, AutoProvisionService, BillingRecordService, PasswordService],
  exports: [AutoProvisionService, BillingRecordService],
})
export class ProvisioningModule {}
