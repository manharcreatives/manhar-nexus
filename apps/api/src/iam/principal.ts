import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import { UnauthorizedError } from '../common/errors';
import type { ActorContext, TenantScope } from '../common/tenant-scope';

/** The authenticated caller, resolved by JwtAuthGuard from a verified token. */
export interface Principal {
  userId: string;
  realm: 'PLATFORM' | 'BUSINESS';
  /** NULL only for PLATFORM. */
  businessId: string | null;
  displayName: string;
  sessionId: string;
  /** Effective permission keys (union of roles); may contain the '*' wildcard. */
  permissions: Set<string>;
  /** Location scope: any-location OR the union of explicitly granted locations. */
  allLocations: boolean;
  locationIds: Set<string>;
}

export interface AuthenticatedRequest extends Request {
  principal?: Principal;
  actor?: ActorContext;
}

/** Marks a route as not requiring authentication (e.g. login, health). */
export const IS_PUBLIC = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);

/**
 * Routes a user with a temporary password may still call (own profile, sign-out and the
 * password change itself). Everything else answers 403 until the password is changed.
 */
export const ALLOW_PASSWORD_CHANGE_PENDING = 'allowPasswordChangePending';
export const AllowWhilePasswordChangePending = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ALLOW_PASSWORD_CHANGE_PENDING, true);

/** Declares the permission (and optional location-scoped param) a route needs. */
export const REQUIRED_PERMISSION = 'requiredPermission';
export interface PermissionRequirement {
  key: string;
  /** Route param name holding a locationId to enforce location scope against. */
  locationParam?: string;
}
export const RequirePermission = (
  key: string,
  opts?: { locationParam?: string },
): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_PERMISSION, { key, locationParam: opts?.locationParam });

/** Injects the resolved Principal; throws if the route was not authenticated. */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Principal => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.principal) throw new UnauthorizedError('No authenticated principal');
    return req.principal;
  },
);

/** True if the principal may operate at a specific location. */
export function canAccessLocation(principal: Principal, locationId: string): boolean {
  return principal.allLocations || principal.locationIds.has(locationId);
}

/** Actor context (for audit) derived from a principal. */
export function actorOf(principal: Principal): ActorContext {
  return {
    type: principal.realm === 'PLATFORM' ? 'INTERNAL_ADMIN' : 'USER',
    id: principal.userId,
    label: principal.displayName,
  };
}

/**
 * Build a TenantScope for a BUSINESS-realm principal — businessId comes from
 * the identity, NEVER the URL, so a business user cannot act on another tenant.
 */
export function scopeFromPrincipal(principal: Principal, locationId?: string): TenantScope {
  if (principal.realm !== 'BUSINESS' || !principal.businessId) {
    throw new UnauthorizedError('Business-scoped route requires a business principal');
  }
  return { businessId: principal.businessId, locationId, actor: actorOf(principal) };
}

/**
 * Build a TenantScope for a PLATFORM principal acting on an explicit business
 * (the /internal cross-business admin surface). businessId is validated by
 * BusinessExistsGuard on those routes.
 */
export function scopeForPlatform(
  principal: Principal,
  businessId: string,
  locationId?: string,
): TenantScope {
  if (principal.realm !== 'PLATFORM') {
    throw new UnauthorizedError('Platform-scoped route requires a platform principal');
  }
  return { businessId, locationId, actor: actorOf(principal) };
}
