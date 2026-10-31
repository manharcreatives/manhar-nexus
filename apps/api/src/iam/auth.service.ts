import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenError, UnauthorizedError, ValidationError } from '../common/errors';
import { PasswordService } from './password.service';
import { TokenService, hashRefresh } from './token.service';
import { selectSlotCookiesToDrop } from './session-cookie';

export interface AuthContext {
  ip?: string;
  userAgent?: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResult {
  user: Pick<User, 'id' | 'email' | 'displayName' | 'realm' | 'businessId' | 'status'>;
  tokens: IssuedTokens;
}

const GENERIC_LOGIN_ERROR = 'Invalid email or password';

/**
 * Authentication flows (ADR-004/022/023): password login with per-account
 * lockout and enumeration-safe timing; rotating refresh tokens with family
 * reuse detection; session-based revocation. All auth attempts are recorded to
 * the LoginEvent telemetry stream (successes and failures alike).
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async login(emailRaw: string, password: string, ctx: AuthContext): Promise<LoginResult> {
    const email = emailRaw.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({ where: { email } });

    // Unknown user: run a dummy verify (constant timing) then fail generically.
    if (!user) {
      await this.passwords.verifyOrDummy(null, password);
      await this.record(null, email, 'unknown_user', ctx);
      throw new UnauthorizedError(GENERIC_LOGIN_ERROR);
    }

    const valid = await this.passwords.verifyOrDummy(user.passwordHash, password);
    if (!valid) {
      await this.registerFailure(user);
      await this.record(user.businessId, email, 'bad_credentials', ctx, user.id);
      throw new UnauthorizedError(GENERIC_LOGIN_ERROR);
    }

    // Correct password — now safe to disclose account-state reasons.
    if (user.status === 'SUSPENDED') {
      await this.record(user.businessId, email, 'suspended', ctx, user.id);
      throw new ForbiddenError('Account is suspended');
    }
    if (user.status === 'PENDING') {
      await this.record(user.businessId, email, 'pending', ctx, user.id);
      throw new ForbiddenError('Account is not activated');
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      await this.record(user.businessId, email, 'locked', ctx, user.id);
      throw new UnauthorizedError('Account is temporarily locked. Try again later.');
    }

    const tokens = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
      });
      return this.mintSession(tx, user, ctx);
    });

    await this.record(user.businessId, email, 'success', ctx, user.id);
    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        realm: user.realm,
        businessId: user.businessId,
        status: user.status,
      },
      tokens,
    };
  }

  async refresh(rawToken: string, ctx: AuthContext): Promise<IssuedTokens> {
    const tokenHash = hashRefresh(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!existing) throw new UnauthorizedError('Invalid refresh token');

    // Reuse of an already-rotated token ⇒ theft: revoke the whole family.
    if (existing.revokedAt) {
      if (existing.rotatedTo) {
        const session = await this.prisma.session.findUnique({
          where: { id: existing.sessionId },
          select: { businessId: true, userId: true },
        });
        await this.revokeFamily(existing.familyId, 'reuse_detected');
        await this.record(session?.businessId ?? null, null, 'reuse_detected', ctx, session?.userId);
      }
      throw new UnauthorizedError('Invalid refresh token');
    }
    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedError('Refresh token expired');
    }

    return this.prisma.$transaction(async (tx) => {
      // Atomically consume the presented token. If it was already consumed
      // (concurrent rotation race, or reuse), exactly one caller wins here.
      const consumed = await tx.refreshToken.updateMany({
        where: { id: existing.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (consumed.count === 0) throw new UnauthorizedError('Invalid refresh token');

      // Re-validate session + user inside the transaction (guards against a
      // session revoked between the initial read and now).
      const session = await tx.session.findUnique({ where: { id: existing.sessionId } });
      if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
        throw new UnauthorizedError('Session expired or revoked');
      }
      const user = await tx.user.findUnique({ where: { id: session.userId } });
      if (!user || user.status !== 'ACTIVE') throw new UnauthorizedError('Account is not active');

      const next = this.tokens.generateRefresh();
      const created = await tx.refreshToken.create({
        data: {
          sessionId: session.id,
          familyId: existing.familyId,
          tokenHash: next.hash,
          expiresAt: this.refreshExpiry(session.expiresAt),
        },
      });
      await tx.refreshToken.update({ where: { id: existing.id }, data: { rotatedTo: created.id } });
      await tx.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });

      const accessToken = this.tokens.signAccess({
        sub: user.id,
        bid: user.businessId,
        realm: user.realm,
        sid: session.id,
        sv: session.sessionVersion,
        tv: user.tokenVersion,
      });
      return { accessToken, refreshToken: next.token, expiresIn: this.tokens.accessTtlSeconds };
    });
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.session.updateMany({
        where: { id: sessionId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'logout' },
      });
      await tx.refreshToken.updateMany({
        where: { sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  /**
   * Housekeeping for tab-session cookies (ADR-034): given the `nexus_rt_*` cookies the browser sent, return the
   * names to expire - cookies whose token is unknown or whose session is revoked/expired, plus the least recently
   * used live ones beyond the per-browser cap. Never throws for unknown input: a bad cookie is simply dead.
   * `cookies` maps cookie name -> raw refresh token (already filtered to well-formed slot names by the caller).
   */
  async deadSlotCookies(cookies: Record<string, string>): Promise<string[]> {
    const names = Object.keys(cookies);
    if (names.length === 0) return [];
    const byHash = new Map(names.map((n) => [hashRefresh(cookies[n]), n]));
    const rows = await this.prisma.refreshToken.findMany({
      where: { tokenHash: { in: [...byHash.keys()] } },
      select: { tokenHash: true, revokedAt: true, expiresAt: true, session: { select: { revokedAt: true, expiresAt: true, lastSeenAt: true } } },
    });
    const now = Date.now();
    const state = new Map(
      rows.map((r) => [
        r.tokenHash,
        {
          alive: !r.revokedAt && r.expiresAt.getTime() > now && !r.session.revokedAt && r.session.expiresAt.getTime() > now,
          lastSeenMs: r.session.lastSeenAt.getTime(),
        },
      ]),
    );
    return selectSlotCookiesToDrop(
      [...byHash.entries()].map(([hash, name]) => ({ name, alive: state.get(hash)?.alive ?? false, lastSeenMs: state.get(hash)?.lastSeenMs ?? 0 })),
    );
  }

  /** Profile + effective access for the authenticated user (`/auth/me`). */
  async me(userId: string): Promise<{
    id: string;
    email: string;
    displayName: string;
    realm: string;
    businessId: string | null;
    status: string;
    mustChangePassword: boolean;
    /** Own workspace name and accent colour (no permission needed: every staff member sees their restaurant's brand). */
    business: { name: string; accentColor: string | null } | null;
    roles: { key: string; name: string }[];
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user) throw new UnauthorizedError('Account not found');
    const biz = user.businessId
      ? await this.prisma.business.findUnique({ where: { id: user.businessId }, select: { name: true, accentColor: true } })
      : null;
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      realm: user.realm,
      businessId: user.businessId,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      business: biz ? { name: biz.name, accentColor: biz.accentColor } : null,
      roles: user.userRoles.map((ur) => ({ key: ur.role.key, name: ur.role.name })),
    };
  }

  /** Kill every session for a user (permission change / logout-all). */
  async logoutAll(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      });
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'logout_all' },
      });
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedError('Account not found');
    const valid = await this.passwords.verifyOrDummy(user.passwordHash, currentPassword);
    if (!valid) throw new ValidationError('Current password is incorrect', { field: 'currentPassword' });
    const passwordHash = await this.passwords.hash(newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash, mustChangePassword: false, failedAttempts: 0, lockedUntil: null, tokenVersion: { increment: 1 } },
      });
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'password_changed' },
      });
    });
  }

  // ── internals ──

  private async mintSession(
    tx: Prisma.TransactionClient,
    user: User,
    ctx: AuthContext,
  ): Promise<IssuedTokens> {
    const absoluteExpiry = new Date(
      Date.now() + this.config.get<number>('REFRESH_ABSOLUTE_TTL_DAYS', 90) * 86_400_000,
    );
    const session = await tx.session.create({
      data: {
        userId: user.id,
        businessId: user.businessId,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
        expiresAt: absoluteExpiry,
      },
    });
    const refresh = this.tokens.generateRefresh();
    await tx.refreshToken.create({
      data: {
        sessionId: session.id,
        familyId: randomUUID(),
        tokenHash: refresh.hash,
        expiresAt: this.refreshExpiry(absoluteExpiry),
      },
    });
    const accessToken = this.tokens.signAccess({
      sub: user.id,
      bid: user.businessId,
      realm: user.realm,
      sid: session.id,
      sv: session.sessionVersion,
      tv: user.tokenVersion,
    });
    return { accessToken, refreshToken: refresh.token, expiresIn: this.tokens.accessTtlSeconds };
  }

  private refreshExpiry(sessionAbsoluteExpiry: Date): Date {
    const sliding = new Date(
      Date.now() + this.config.get<number>('REFRESH_TTL_DAYS', 30) * 86_400_000,
    );
    return sliding < sessionAbsoluteExpiry ? sliding : sessionAbsoluteExpiry;
  }

  private async registerFailure(user: User): Promise<void> {
    const max = this.config.get<number>('AUTH_MAX_FAILED_ATTEMPTS', 5);
    const lockMinutes = this.config.get<number>('AUTH_LOCKOUT_MINUTES', 15);
    // Atomic increment (no lost updates under concurrent failures), then lock
    // based on the authoritative post-increment count.
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: { increment: 1 } },
      select: { failedAttempts: true },
    });
    if (updated.failedAttempts >= max) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedAttempts: 0, lockedUntil: new Date(Date.now() + lockMinutes * 60_000) },
      });
    }
  }

  private async revokeFamily(familyId: string, reason: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const tokens = await tx.refreshToken.findMany({
        where: { familyId },
        select: { sessionId: true },
      });
      const sessionIds = [...new Set(tokens.map((t) => t.sessionId))];
      await tx.refreshToken.updateMany({
        where: { familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.session.updateMany({
        where: { id: { in: sessionIds }, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: reason },
      });
    });
  }

  private async record(
    businessId: string | null,
    email: string | null,
    outcome: string,
    ctx: AuthContext,
    userId?: string,
  ): Promise<void> {
    await this.prisma.loginEvent.create({
      data: {
        businessId,
        userId: userId ?? null,
        emailTried: email,
        outcome,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
      },
    });
  }
}
