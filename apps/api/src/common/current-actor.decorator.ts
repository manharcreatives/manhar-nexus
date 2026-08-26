import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { UnauthorizedError } from './errors';
import type { ActorContext, TenantScope } from './tenant-scope';

/** Request carrying the actor stamped by JwtAuthGuard. */
type ActorRequest = Request & { actor?: ActorContext };

/** Injects the actor resolved by the guard. Throws if the route is unguarded. */
export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ActorContext => {
    const req = ctx.switchToHttp().getRequest<ActorRequest>();
    if (!req.actor) {
      throw new UnauthorizedError('No authenticated actor on request');
    }
    return req.actor;
  },
);

/**
 * Builds a TenantScope from a resolved actor and a validated businessId.
 * Controllers use this to hand services an explicit isolation boundary.
 */
export function scopeFor(
  actor: ActorContext,
  businessId: string,
  locationId?: string,
): TenantScope {
  return { businessId, locationId, actor };
}
