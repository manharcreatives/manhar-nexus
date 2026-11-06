import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { PasswordService } from '../iam/password.service';
import { ModulesModule } from '../modules/modules.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { RegistrationProvisioningController } from './registration-provisioning.controller';
import { RegistrationProvisioningService } from './registration-provisioning.service';

/** The resumable "create the restaurant account" job for registration requests. PrismaModule is global. */
@Module({
  imports: [CoreModule, ModulesModule, OnboardingModule],
  controllers: [RegistrationProvisioningController],
  providers: [RegistrationProvisioningService, PasswordService],
})
export class ProvisioningModule {}
