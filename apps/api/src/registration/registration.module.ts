import { Module } from '@nestjs/common';
import { RegistrationAdminController, RegistrationPublicController } from './registration.controller';
import { RegistrationService } from './registration.service';

/**
 * Public registration requests (ADR-033). PrismaModule and ConfigModule are global.
 * ThrottlerGuard resolves its ThrottlerModule options from IamModule's global
 * registration, exactly as AuthController does.
 */
@Module({
  controllers: [RegistrationPublicController, RegistrationAdminController],
  providers: [RegistrationService],
  exports: [RegistrationService],
})
export class RegistrationModule {}
