import { Injectable } from '@nestjs/common';
import type { GuestMenuToken } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { caps } from './guestmenu.config';
import { GuestTokenError, RateLimitedError } from './guestmenu.errors';
import { GUEST_TOKEN_REGEX, newGuestToken, sha256Hex } from './guestmenu.tokens';
import type { OpenSession, TableContext } from './guestmenu.types';

/** Optional guest name: trimmed, control characters and markup-ish characters removed, max 40 characters. */
export function cleanDisplayName(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[\p{C}<>]/gu, ' ').replace(/\s+/g, ' ').trim();
  return cleaned ? Array.from(cleaned).slice(0, 40).join('') : null;
}

/**
 * Per-device guest identity. The plaintext token (256 random bits) is returned once and only its sha256 is stored. A token
 * is bound to ONE table visit: it works only while that guest session is the table's OPEN session, so closing the table
 * (or rotating its QR, which also revokes them) ends every guest's access without any extra bookkeeping.
 */
@Injectable()
export class GuestTokenService {
  constructor(private readonly prisma: PrismaService) {}

  async issue(ctx: TableContext, session: OpenSession, displayName: string | null): Promise<{ guestToken: string; expiresAt: string }> {
    const live = await this.prisma.guestMenuToken.count({ where: { sessionId: session.id, revokedAt: null } });
    if (live >= caps.maxGuestsPerSession()) {
      throw new RateLimitedError('Too many devices have joined this table. Ask your waiter for help.', 300, { reason: 'GUESTS_PER_SESSION' });
    }
    const token = newGuestToken();
    const expiresAt = new Date(Date.now() + caps.guestTokenTtlHours() * 3600_000);
    await this.prisma.guestMenuToken.create({
      data: {
        businessId: ctx.businessId,
        diningTableId: ctx.tableId,
        sessionId: session.id,
        tokenHash: sha256Hex(token),
        displayName,
        expiresAt,
      },
    });
    return { guestToken: token, expiresAt: expiresAt.toISOString() };
  }

  /** The token row when it is valid for this table's open session; otherwise GuestTokenError (401: the client re-issues). */
  async verify(ctx: TableContext, session: OpenSession | null, raw: string | undefined): Promise<GuestMenuToken> {
    const token = await this.find(ctx, session, raw);
    if (!token) throw new GuestTokenError('Your table session has ended. Please reopen the menu.');
    this.touch(token);
    return token;
  }

  /** Like verify but returns null instead of throwing (optional-identity endpoints). */
  async verifyOptional(ctx: TableContext, session: OpenSession | null, raw: string | undefined): Promise<GuestMenuToken | null> {
    return raw ? this.find(ctx, session, raw) : null;
  }

  async revokeForTable(businessId: string, tableId: string): Promise<number> {
    const r = await this.prisma.guestMenuToken.updateMany({
      where: { businessId, diningTableId: tableId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return r.count;
  }

  private async find(ctx: TableContext, session: OpenSession | null, raw: string | undefined): Promise<GuestMenuToken | null> {
    if (!raw || !session || !GUEST_TOKEN_REGEX.test(raw)) return null;
    const row = await this.prisma.guestMenuToken.findUnique({ where: { tokenHash: sha256Hex(raw) } });
    if (!row) return null;
    if (row.businessId !== ctx.businessId || row.diningTableId !== ctx.tableId || row.sessionId !== session.id) return null;
    if (row.revokedAt || row.expiresAt.getTime() <= Date.now()) return null;
    return row;
  }

  /** Best effort, at most once a minute per token; never blocks or fails the request. */
  private touch(token: GuestMenuToken): void {
    const stale = !token.lastSeenAt || Date.now() - token.lastSeenAt.getTime() > 60_000;
    if (!stale) return;
    void this.prisma.guestMenuToken
      .updateMany({ where: { id: token.id, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: new Date(Date.now() - 60_000) } }] }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }
}
