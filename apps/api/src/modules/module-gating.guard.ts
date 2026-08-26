import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ModuleDisabledError } from '../common/errors';
import type { AuthenticatedRequest } from '../iam/principal';
import { ModuleService } from './module.service';

export const REQUIRED_MODULE = 'requiredModule';

/**
 * Marks a route as requiring a specific module to be ACTIVE for the calling
 * business. Platform-realm principals bypass the check (they are not scoped to
 * a single business). No-op when no `@RequireModule` metadata is set.
 *
 * Usage:
 *   @RequireModule('restaurant')
 *   async someRestaurantRoute() { ... }
 *
 * The guard runs AFTER JwtAuthGuard (authentication) and PermissionGuard
 * (authorization). A 403 with code MODULE_DISABLED is returned when the module
 * is not active — distinct from the generic FORBIDDEN code so clients can show
 * a meaningful "enable this module" call-to-action.
 */
@Injectable()
export class ModuleGatingGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly modules: ModuleService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const moduleKey = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRED_MODULE,
      [context.getHandler(), context.getClass()],
    );

    if (!moduleKey) return true; // no module gate on this route

    const req = context.switchToHttp().getRequest<AuthenticatedRequest & Request>();
    const principal = req.principal;

    // Unauthenticated requests are handled by JwtAuthGuard before us.
    if (!principal) return true;

    // Platform-realm users have cross-business access; bypass module gate.
    if (principal.realm === 'PLATFORM') return true;

    // Business-realm: check module is ACTIVE for the principal's business.
    if (!principal.businessId) return true;

    const isActive = await this.modules.isActive(principal.businessId, moduleKey);
    if (!isActive) throw new ModuleDisabledError(moduleKey);

    return true;
  }
}

/** Declares that the decorated route requires a module to be ACTIVE. */
export const RequireModule = (moduleKey: string): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_MODULE, moduleKey);
