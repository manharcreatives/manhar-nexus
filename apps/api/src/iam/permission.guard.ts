import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenError, UnauthorizedError } from '../common/errors';
import { WILDCARD } from './permission.registry';
import {
  IS_PUBLIC,
  REQUIRED_PERMISSION,
  canAccessLocation,
  type AuthenticatedRequest,
  type PermissionRequirement,
} from './principal';

/**
 * Authorization guard (runs after JwtAuthGuard). Enforces the route's
 * `@RequirePermission`. Platform-namespaced permissions additionally require a
 * PLATFORM principal, so a business wildcard can never reach the platform realm.
 * Location-scoped routes verify the target location is within the principal's
 * scope.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requirement = this.reflector.getAllAndOverride<PermissionRequirement>(
      REQUIRED_PERMISSION,
      [context.getHandler(), context.getClass()],
    );
    // No permission declared → authentication (already enforced) is sufficient.
    if (!requirement) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const principal = req.principal;
    if (!principal) throw new UnauthorizedError('No authenticated principal');

    // Platform permissions are only reachable by platform principals.
    if (requirement.key.startsWith('platform.') && principal.realm !== 'PLATFORM') {
      throw new ForbiddenError('Platform permission required', { permission: requirement.key });
    }

    const allowed =
      principal.permissions.has(WILDCARD) || principal.permissions.has(requirement.key);
    if (!allowed) {
      throw new ForbiddenError('Missing permission', { permission: requirement.key });
    }

    if (requirement.locationParam) {
      const locationId = req.params[requirement.locationParam];
      if (typeof locationId === 'string' && !canAccessLocation(principal, locationId)) {
        throw new ForbiddenError('Location out of scope', { locationId });
      }
    }
    return true;
  }
}
