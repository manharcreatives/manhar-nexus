import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UnauthorizedError } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from './authorization.service';
import { IS_PUBLIC, type AuthenticatedRequest, type Principal, actorOf } from './principal';
import { TokenService } from './token.service';

/**
 * Global authentication guard. Verifies the access JWT, then performs the
 * per-request validity checks that deliver ≤access-TTL revocation (ADR-004):
 *   - session exists, not revoked, not expired
 *   - sessionVersion matches (groundwork for per-session bump; always 0 today —
 *     no code path increments it yet, so this check never rejects in practice)
 *   - user exists, ACTIVE, tokenVersion matches (bumped on logout-all / suspend)
 * On success attaches `req.principal` (with freshly-resolved permissions +
 * location scope) and `req.actor` (for audit).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.bearer(req);
    if (!token) throw new UnauthorizedError('Missing bearer token');

    const claims = this.tokens.verifyAccess(token);

    // One round-trip for session + its user (the per-request revocation check).
    const session = await this.prisma.session.findUnique({
      where: { id: claims.sid },
      include: { user: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now() ||
      session.sessionVersion !== claims.sv
    ) {
      throw new UnauthorizedError('Session expired or revoked');
    }

    const user = session.user;
    if (!user || user.id !== claims.sub || user.status !== 'ACTIVE' || user.tokenVersion !== claims.tv) {
      throw new UnauthorizedError('Account is not active');
    }

    const authz = await this.authz.resolve(user.id);
    const principal: Principal = {
      userId: user.id,
      realm: user.realm,
      businessId: user.businessId,
      displayName: user.displayName,
      sessionId: session.id,
      permissions: authz.permissions,
      allLocations: authz.allLocations,
      locationIds: authz.locationIds,
    };
    req.principal = principal;
    req.actor = actorOf(principal);
    return true;
  }

  private bearer(req: AuthenticatedRequest): string | null {
    const header = req.header('authorization') ?? '';
    const [scheme, value] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && value ? value : null;
  }
}
