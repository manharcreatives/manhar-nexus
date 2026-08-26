import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CoreModule } from '../core/core.module';
import { IamModule } from '../iam/iam.module';
import { BusinessExistsGuard } from '../common/business-exists.guard';
import { ModuleRegistry } from './module.registry';
import { ModuleService } from './module.service';
import { ModuleGatingGuard } from './module-gating.guard';
import { ModuleController } from './module.controller';
import { PlatformModuleController } from './platform-module.controller';

/**
 * Phase 5 — Module Engine.
 * Registers the module catalog (ModuleRegistry), per-business lifecycle service
 * (ModuleService), and the ModuleGatingGuard (third APP_GUARD, runs after authN
 * and authZ — short-circuits to true when no @RequireModule metadata is set).
 *
 * Import order in AppModule determines guard execution:
 *   IamModule  → JwtAuthGuard + PermissionGuard
 *   ModulesModule → ModuleGatingGuard
 */
@Module({
  imports: [
    CoreModule,  // PrismaService + AuditService
    IamModule,   // PermissionRegistry (ModuleRegistry registers module permissions into it)
  ],
  controllers: [ModuleController, PlatformModuleController],
  providers: [
    ModuleRegistry,
    ModuleService,
    BusinessExistsGuard,
    { provide: APP_GUARD, useClass: ModuleGatingGuard },
  ],
  exports: [ModuleRegistry, ModuleService],
})
export class ModulesModule {}
