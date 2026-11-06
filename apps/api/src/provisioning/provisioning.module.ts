import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { PasswordService } from '../iam/password.service';
import { ModulesModule } from '../modules/modules.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { AutoProvisionService } from './auto-provision.service';
import { AttentionController } from './attention.controller';
import { BillingRecordService } from './billing-record.service';
import { ClaimPublicController, ClaimStaffController } from './claim.controller';
import { ClaimService } from './claim.service';
import { CronController } from './cron.controller';
import { RegistrationProvisioningController } from './registration-provisioning.controller';
import { RegistrationProvisioningService } from './registration-provisioning.service';

/**
 * The resumable "create the restaurant account" job for registration requests, its automatic trigger after a payment,
 * and the billing record on the client. PrismaModule is global.
 */
@Module({
  imports: [CoreModule, ModulesModule, OnboardingModule],
  controllers: [RegistrationProvisioningController, ClaimPublicController, ClaimStaffController, CronController, AttentionController],
  providers: [RegistrationProvisioningService, AutoProvisionService, BillingRecordService, ClaimService, PasswordService],
  exports: [AutoProvisionService, BillingRecordService, ClaimService],
})
export class ProvisioningModule {}
