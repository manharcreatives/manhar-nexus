import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedError } from '../common/errors';

/** Claims carried by the short-lived access token. NO permissions here — they
 * are resolved per-request so revocation/permission-changes take effect ≤60s. */
export interface AccessClaims {
  sub: string; // userId
  bid: string | null; // businessId (null for platform)
  realm: 'PLATFORM' | 'BUSINESS';
  sid: string; // sessionId
  sv: number; // sessionVersion
  tv: number; // user.tokenVersion
  typ: 'access';
}

const ALG = 'HS256' as const;

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private get secret(): string {
    return this.config.get<string>('JWT_ACCESS_SECRET')!;
  }

  get accessTtlSeconds(): number {
    return this.config.get<number>('JWT_ACCESS_TTL_SECONDS', 300);
  }

  signAccess(claims: Omit<AccessClaims, 'typ'>): string {
    return this.jwt.sign(
      { ...claims, typ: 'access' },
      { algorithm: ALG, secret: this.secret, expiresIn: this.accessTtlSeconds },
    );
  }

  /** Verify with a pinned algorithm (rejects `alg:none`/alg-confusion). */
  verifyAccess(token: string): AccessClaims {
    try {
      const decoded = this.jwt.verify<AccessClaims>(token, {
        algorithms: [ALG],
        secret: this.secret,
      });
      if (decoded.typ !== 'access') throw new Error('wrong token type');
      return decoded;
    } catch {
      throw new UnauthorizedError('Invalid or expired access token');
    }
  }

  /** New opaque refresh token; only its hash is persisted. */
  generateRefresh(): { token: string; hash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: hashRefresh(token) };
  }
}

/** sha256 of a refresh token — the DB lookup key (raw token never stored). */
export function hashRefresh(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
