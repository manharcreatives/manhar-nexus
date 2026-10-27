import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { Subscription } from 'rxjs';
import { ForbiddenError, NotFoundError, ValidationError } from '../common/errors';
import { CurrentPrincipal, canAccessLocation, type AuthenticatedRequest, type Principal } from '../iam/principal';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeBus } from './realtime.bus';
import { RealtimeStreams } from './realtime.streams';
import {
  HEARTBEAT_SECONDS,
  type RealtimeChangePayload,
  type RealtimeEvent,
  type RealtimeHelloPayload,
} from './realtime.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Server-Sent Events stream (ADR-032). A raw @Res() handler is used (instead of
 * @Sse) so headers can be set exactly, heartbeats written as comment lines and
 * the stream ended with a terminal `expired` / `replaced` event.
 *
 * Authentication is the normal global JwtAuthGuard (bearer header, so the client
 * uses fetch-streaming, not EventSource). Any authenticated BUSINESS user may
 * subscribe; PLATFORM principals get 403 (they have no tenant).
 */
@Controller('admin/realtime')
export class RealtimeController {
  constructor(
    private readonly bus: RealtimeBus,
    private readonly streams: RealtimeStreams,
    private readonly prisma: PrismaService,
  ) {}

  @Get('stream')
  async stream(
    @CurrentPrincipal() p: Principal,
    @Query('locationId') locationId: string | undefined,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ): Promise<void> {
    if (p.realm !== 'BUSINESS' || !p.businessId) {
      throw new ForbiddenError('Realtime streams are available to business users only');
    }
    const businessId = p.businessId;

    if (locationId !== undefined) {
      if (!UUID.test(locationId)) throw new ValidationError('locationId must be a UUID');
      if (!canAccessLocation(p, locationId)) throw new ForbiddenError('Location not accessible');
      const loc = await this.prisma.location.findFirst({
        where: { id: locationId, businessId },
        select: { id: true },
      });
      if (!loc) throw new NotFoundError('Location not found', { id: locationId });
    }

    // Token expiry: the guard already verified the JWT; read its `exp` claim.
    const expMs = tokenExpiryMs(req.header('authorization'));

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    req.socket.setNoDelay(true);
    req.socket.setKeepAlive(true);

    let closed = false;
    const h: { sub?: Subscription; heartbeat?: NodeJS.Timeout; expiry?: NodeJS.Timeout; unregister?: () => void } = {};

    const cleanup = (): void => {
      if (closed) return;
      closed = true;
      if (h.heartbeat) clearInterval(h.heartbeat);
      if (h.expiry) clearTimeout(h.expiry);
      h.sub?.unsubscribe();
      h.unregister?.();
    };
    const safeWrite = (chunk: string): void => {
      try {
        res.write(chunk);
      } catch {
        cleanup();
      }
    };
    const finish = (finalEvent?: string): void => {
      if (closed) return;
      if (finalEvent) safeWrite(`event: ${finalEvent}\ndata: {}\n\n`);
      cleanup();
      res.end();
    };

    req.on('close', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);

    const hello: RealtimeHelloPayload = { serverTime: new Date().toISOString(), heartbeatSeconds: HEARTBEAT_SECONDS };
    safeWrite(`event: hello\ndata: ${JSON.stringify(hello)}\n\n`);

    h.sub = this.bus.subscribe(businessId).subscribe((ev) => {
      if (closed || !visible(p, locationId, ev)) return;
      const out: RealtimeChangePayload = { topic: ev.topic, locationId: ev.locationId, at: ev.at };
      safeWrite(`event: change\ndata: ${JSON.stringify(out)}\n\n`);
    });
    h.heartbeat = setInterval(() => safeWrite(': ping\n\n'), HEARTBEAT_SECONDS * 1000);
    if (expMs !== null) {
      h.expiry = setTimeout(() => finish('expired'), Math.max(0, expMs - Date.now()));
    }
    h.unregister = this.streams.register(p.userId, { close: (reason) => finish(reason) });
  }
}

/** Location scoping rules from the contract. */
function visible(p: Principal, requested: string | undefined, ev: RealtimeEvent): boolean {
  if (ev.locationId === null) return true;
  if (requested !== undefined && ev.locationId !== requested) return false;
  return canAccessLocation(p, ev.locationId);
}

/** `exp` (ms epoch) from an already-verified bearer JWT, or null if unreadable. */
export function tokenExpiryMs(authorization: string | undefined): number | null {
  try {
    const token = (authorization ?? '').split(' ')[1] ?? '';
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as {
      exp?: number;
    };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}
