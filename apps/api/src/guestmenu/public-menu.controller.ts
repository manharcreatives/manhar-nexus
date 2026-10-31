import { Body, Controller, Get, Headers, HttpCode, Param, PipeTransform, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { NotFoundError, ValidationError } from '../common/errors';
import { ZodValidationPipe, zodBody } from '../common/zod-validation.pipe';
import { Public } from '../iam/principal';
import { HEARTBEAT_SECONDS } from '../realtime/realtime.types';
import { GuestHub, type HubConn } from './guest-hub.service';
import { GuestOrderService } from './guest-order.service';
import { GuestTokenService, cleanDisplayName } from './guest-token.service';
import { WINDOW_MS, caps, lim, mediaPublicBase } from './guestmenu.config';
import {
  createGuestSchema,
  payIntentSchema,
  placeOrderSchema,
  waiterSchema,
  type CreateGuestDto,
  type PlaceOrderDto,
  type WaiterDto,
} from './guestmenu.dto';
import { RateLimitedError, TableClosedError } from './guestmenu.errors';
import { IDEMPOTENCY_KEY_REGEX, etagMatches, sha256Hex } from './guestmenu.tokens';
import type { TableContext } from './guestmenu.types';
import { MenuService } from './menu.service';
import { RateLimiter, clientIp, type RateRule } from './rate-limiter.service';
import { TableContextService } from './table-context.service';

/** Builds the order schema per request so the env-tunable caps apply without a restart. */
class PlaceOrderPipe implements PipeTransform {
  transform(value: unknown): PlaceOrderDto {
    return new ZodValidationPipe(placeOrderSchema()).transform(value);
  }
}

const rule = (key: string, limit: number): RateRule => ({ key, limit, windowMs: WINDOW_MS });
/** Keys never contain a raw secret: only a short hash of it. */
const short = (secret: string): string => sha256Hex(secret).slice(0, 16);

/**
 * PUBLIC customer endpoints of the QR digital menu (ADR-035). No login: the table token in the path is the capability,
 * a per-device guest token (header X-Guest-Token) is the identity for anything that is not read-only.
 *
 *   GET  /public/menu/:t            menu + table + policy (ETag / If-None-Match)
 *   GET  /public/menu/:t/stream     SSE hints (menu.changed, table.updated, order.updated, bill.updated, waiter.ack)
 *   POST /public/menu/:t/guest      issue a guest token for the table's OPEN visit
 *   POST /public/menu/:t/orders     place an order (Idempotency-Key, X-Guest-Token)
 *   GET  /public/menu/:t/state      this table's orders, bill and waiter call (X-Guest-Token)
 *   POST /public/menu/:t/waiter     call the waiter / ask for the bill (X-Guest-Token optional)
 *   POST /public/menu/:t/pay-intent UPI deep link for the amount due (X-Guest-Token)
 */
@Public()
@Controller('public/menu')
export class PublicMenuController {
  constructor(
    private readonly contexts: TableContextService,
    private readonly menu: MenuService,
    private readonly tokens: GuestTokenService,
    private readonly orders: GuestOrderService,
    private readonly limiter: RateLimiter,
    private readonly hub: GuestHub,
  ) {}

  @Get(':tableToken')
  async getMenu(
    @Param('tableToken') tableToken: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ctx = await this.resolve(req, tableToken);
    this.limiter.enforce(res, [rule(`menu:ip:${clientIp(req)}`, lim('MENU_IP')), rule(`menu:tok:${short(tableToken)}`, lim('MENU_TOKEN'))]);
    const open = !!(await this.contexts.openSession(ctx));
    const rel = await this.menu.relativePayload(ctx, open);
    res.setHeader('ETag', rel.etag);
    res.setHeader('Cache-Control', 'private, no-cache');
    if (etagMatches(ifNoneMatch, rel.etag)) {
      res.status(304);
      return;
    }
    return this.menu.publicPayload(ctx, open, mediaPublicBase(req));
  }

  @Post(':tableToken/guest')
  async createGuest(
    @Param('tableToken') tableToken: string,
    @Body(zodBody(createGuestSchema)) dto: CreateGuestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ctx = await this.resolve(req, tableToken);
    this.limiter.enforce(res, [rule(`guest:ip:${clientIp(req)}`, lim('GUEST_CREATE_IP')), rule(`guest:tok:${short(tableToken)}`, lim('GUEST_CREATE_TOKEN'))]);
    const session = await this.contexts.openSession(ctx);
    if (!session) throw new TableClosedError('Ask your waiter to open the table, then order from here.');
    res.setHeader('Cache-Control', 'no-store');
    res.status(201);
    return this.tokens.issue(ctx, session, cleanDisplayName(dto.displayName));
  }

  @Post(':tableToken/orders')
  async placeOrder(
    @Param('tableToken') tableToken: string,
    @Headers('x-guest-token') guestHeader: string | undefined,
    @Headers('idempotency-key') idemKey: string | undefined,
    @Body(new PlaceOrderPipe()) dto: PlaceOrderDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ctx = await this.resolve(req, tableToken);
    this.limiter.enforce(res, [
      rule(`order:guest:${short(guestHeader ?? 'none')}`, lim('ORDER_GUEST')),
      rule(`order:tok:${short(tableToken)}`, lim('ORDER_TOKEN')),
      rule(`order:ip:${clientIp(req)}`, lim('ORDER_IP')),
    ]);
    if (!idemKey || !IDEMPOTENCY_KEY_REGEX.test(idemKey)) {
      throw new ValidationError('Idempotency-Key header is required (8-100 letters, digits, - or _).', { reason: 'IDEMPOTENCY_KEY_REQUIRED' });
    }
    const session = await this.contexts.openSession(ctx);
    if (!session) throw new TableClosedError('Ask your waiter to open the table, then order from here.');
    const guest = await this.tokens.verify(ctx, session, guestHeader);
    const placed = await this.orders.placeOrder(ctx, session, guest, dto, idemKey);
    res.setHeader('Cache-Control', 'no-store');
    if (placed.replayed) res.setHeader('Idempotent-Replay', 'true');
    res.status(placed.replayed ? 200 : 201);
    return { orderId: placed.orderId, status: placed.status, totalMinor: placed.totalMinor };
  }

  @Get(':tableToken/state')
  async state(
    @Param('tableToken') tableToken: string,
    @Headers('x-guest-token') guestHeader: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ctx = await this.resolve(req, tableToken);
    this.limiter.enforce(res, [
      rule(`state:guest:${short(guestHeader ?? 'none')}`, lim('STATE_GUEST')),
      rule(`state:ip:${clientIp(req)}`, lim('STATE_IP')),
    ]);
    res.setHeader('Cache-Control', 'no-store');
    const session = await this.contexts.openSession(ctx);
    if (!session) return { orders: [], bill: null, waiterCall: { open: false } };
    const guest = await this.tokens.verify(ctx, session, guestHeader);
    return this.orders.state(ctx, session, guest);
  }

  @Post(':tableToken/waiter')
  @HttpCode(202)
  async waiter(
    @Param('tableToken') tableToken: string,
    @Headers('x-guest-token') guestHeader: string | undefined,
    @Body(zodBody(waiterSchema)) dto: WaiterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ctx = await this.resolve(req, tableToken);
    this.limiter.enforce(res, [
      rule(`waiter:guest:${short(guestHeader ?? 'none')}`, lim('WAITER_GUEST')),
      rule(`waiter:tok:${short(tableToken)}`, lim('WAITER_TOKEN')),
      rule(`waiter:ip:${clientIp(req)}`, lim('WAITER_IP')),
    ]);
    res.setHeader('Cache-Control', 'no-store');
    const session = await this.contexts.openSession(ctx);
    // Identity is optional here ("please come and open my table" must work), and a stale token is simply ignored.
    const guest = await this.tokens.verifyOptional(ctx, session, guestHeader);
    return this.orders.callWaiter(ctx, session, guest, dto);
  }

  @Post(':tableToken/pay-intent')
  @HttpCode(200)
  async payIntent(
    @Param('tableToken') tableToken: string,
    @Headers('x-guest-token') guestHeader: string | undefined,
    @Body(zodBody(payIntentSchema)) _dto: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ctx = await this.resolve(req, tableToken);
    this.limiter.enforce(res, [rule(`pay:guest:${short(guestHeader ?? 'none')}`, lim('PAY_GUEST')), rule(`pay:ip:${clientIp(req)}`, lim('PAY_IP'))]);
    res.setHeader('Cache-Control', 'no-store');
    const session = await this.contexts.openSession(ctx);
    if (!session) throw new TableClosedError('Ask your waiter to open the table first.');
    await this.tokens.verify(ctx, session, guestHeader);
    return this.orders.payIntent(ctx, session);
  }

  @Get(':tableToken/stream')
  async stream(@Param('tableToken') tableToken: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    const ctx = await this.resolve(req, tableToken);
    const ip = clientIp(req);
    this.limiter.enforce(res, [rule(`streamopen:ip:${ip}`, lim('STREAM_OPEN_IP'))]);
    const relIp = this.limiter.acquire(`stream:ip:${ip}`, lim('STREAM_CONCURRENT_IP'));
    const relTok = relIp ? this.limiter.acquire(`stream:tok:${short(tableToken)}`, lim('STREAM_CONCURRENT_TOKEN')) : null;
    if (!relIp || !relTok) {
      relIp?.();
      res.setHeader('Retry-After', '30');
      throw new RateLimitedError('Too many live connections. The menu will refresh by itself.', 30, { reason: 'STREAMS' });
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    req.socket.setNoDelay(true);
    req.socket.setKeepAlive(true);

    let closed = false;
    const h: { heartbeat?: NodeJS.Timeout; max?: NodeJS.Timeout; unregister?: () => void } = {};
    const cleanup = (): void => {
      if (closed) return;
      closed = true;
      if (h.heartbeat) clearInterval(h.heartbeat);
      if (h.max) clearTimeout(h.max);
      h.unregister?.();
      relIp();
      relTok();
    };
    const raw = (chunk: string): void => {
      try {
        res.write(chunk);
      } catch {
        cleanup();
      }
    };
    const conn: HubConn = {
      id: this.hub.nextId(),
      businessId: ctx.businessId,
      tableId: ctx.tableId,
      token: tableToken,
      write: (event, data) => {
        if (!closed) raw(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      },
      end: () => {
        if (closed) return;
        cleanup();
        res.end();
      },
    };
    req.on('close', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);

    raw(`retry: 4000\n\n`);
    conn.write('hello', { serverTime: new Date().toISOString(), heartbeatSeconds: HEARTBEAT_SECONDS });
    h.unregister = this.hub.register(conn);
    h.heartbeat = setInterval(() => raw(': ping\n\n'), HEARTBEAT_SECONDS * 1000);
    // Recycle long streams: the browser reconnects at once and the token is re-validated on the way in.
    h.max = setTimeout(() => {
      conn.write('bye', { reason: 'refresh' });
      conn.end();
    }, caps.streamMaxSeconds() * 1000);
  }

  /** Resolves the table token; repeated bad tokens from one address are throttled (anti-enumeration). */
  private async resolve(req: Request, tableToken: string): Promise<TableContext> {
    const ip = clientIp(req);
    if (this.limiter.peek(`bad:${ip}`) >= lim('BAD_TOKEN_IP')) {
      throw new RateLimitedError('Too many invalid links. Please scan the QR code on your table again.', 60, { reason: 'BAD_TOKEN' });
    }
    try {
      return await this.contexts.resolve(tableToken);
    } catch (err) {
      if (err instanceof NotFoundError) this.limiter.hit(rule(`bad:${ip}`, lim('BAD_TOKEN_IP')));
      throw err;
    }
  }
}
