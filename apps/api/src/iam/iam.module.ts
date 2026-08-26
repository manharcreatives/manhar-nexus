import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { BusinessExistsGuard } from '../common/business-exists.guard';
import { CoreModule } from '../core/core.module';
import { PermissionRegistry } from './permission.registry';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { AuthorizationService } from './authorization.service';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { RoleService } from './role.service';
import { ProvisioningService } from './provisioning.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionGuard } from './permission.guard';
import { AuthController } from './auth.controller';
import { UserController } from './user.controller';
import { RoleController } from './role.controller';
import { PlatformUserController } from './platform-user.controller';
import { BusinessLocationController } from './business-location.controller';
import { AdminBusinessController } from './admin-business.controller';
import { ProvisioningController } from './provisioning.controller';

/**
 * Identity & Access Management (Phase 3): authentication + RBAC.
 * Registers the two global guards — JwtAuthGuard (authN) then PermissionGuard
 * (authZ) — so every route is protected by default (opt out with @Public).
 */
@Module({
  imports: [
    CoreModule, // AuditService for auditing IAM changes
    JwtModule.register({}), // secret passed per-call in TokenService
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('AUTH_RATE_TTL_MS', 60_000),
          limit: config.get<number>('AUTH_RATE_LIMIT', 10),
        },
      ],
    }),
  ],
  controllers: [
    AuthController,
    UserController,
    RoleController,
    PlatformUserController,
    BusinessLocationController,
    AdminBusinessController,
    ProvisioningController,
  ],
  providers: [
    PermissionRegistry,
    PasswordService,
    TokenService,
    AuthorizationService,
    AuthService,
    UserService,
    RoleService,
    ProvisioningService,
    BusinessExistsGuard,
    // Global guards — order matters: authenticate, then authorize.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
  exports: [PermissionRegistry, AuthorizationService],
})
export class IamModule {}
