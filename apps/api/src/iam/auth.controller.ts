import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { UnauthorizedError, ValidationError } from '../common/errors';
import { zodBody } from '../common/zod-validation.pipe';
import { AuthService, type AuthContext } from './auth.service';
import {
  changePasswordSchema,
  loginSchema,
  refreshSchema,
  type ChangePasswordDto,
  type LoginDto,
  type RefreshDto,
} from './auth.dto';
import { AllowWhilePasswordChangePending, CurrentPrincipal, Public, type Principal } from './principal';
import {
  DEVICE_REFRESH_COOKIE,
  SLOT_HEADER,
  isValidSlot,
  slotCookieName,
  slotFromCookieName,
} from './session-cookie';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(zodBody(loginSchema)) dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const slot = this.slotOf(req);
    const result = await this.auth.login(dto.email, dto.password, this.ctx(req));
    // Refresh token is delivered ONLY via the httpOnly cookie for browser clients
    // (XSS cannot exfiltrate a durable credential — ADR-024).
    // The JSON body path in /auth/refresh is intended for non-browser clients
    // (native mobile / CLI) where httpOnly cookies are unavailable. It must
    // never be used in browser contexts. TODO: enforce origin-based routing or
    // a client-type header when native clients are added.
    // ADR-034: with an X-Nexus-Slot header the cookie is the per-tab `nexus_rt_<slot>`; without it, the
    // device-wide `nexus_refresh`. The two never overwrite each other, so tabs keep their own users.
    this.setRefreshCookie(res, result.tokens.refreshToken, slot);
    if (slot) await this.pruneSlotCookies(req, res, slotCookieName(slot));
    return {
      accessToken: result.tokens.accessToken,
      expiresIn: result.tokens.expiresIn,
      user: result.user,
    };
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Body(zodBody(refreshSchema)) dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const slot = this.slotOf(req);
    // A slot header selects ONLY that slot's cookie: if it is missing we answer 401 rather than falling back to
    // the device cookie, because falling back would silently turn this tab into another user (ADR-034).
    const raw = dto.refreshToken ?? (req.cookies?.[this.cookieName(slot)] as string | undefined);
    if (!raw) throw new UnauthorizedError('Missing refresh token');
    const tokens = await this.auth.refresh(raw, this.ctx(req));
    this.setRefreshCookie(res, tokens.refreshToken, slot);
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  @AllowWhilePasswordChangePending()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @CurrentPrincipal() principal: Principal,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Revokes only THIS session (the access token's sid). Other tabs' sessions, even the same user's, stay valid.
    await this.auth.logout(principal.sessionId);
    this.clearRefreshCookie(res, this.slotOf(req));
  }

  @AllowWhilePasswordChangePending()
  @Post('logout-all')
  @HttpCode(204)
  async logoutAll(
    @CurrentPrincipal() principal: Principal,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // "Sign out everywhere": every session of this user on every device and tab (other tabs find out on their
    // next request or refresh; their dead cookies are pruned at the next login).
    await this.auth.logoutAll(principal.userId);
    this.clearRefreshCookie(res, this.slotOf(req));
  }

  /**
   * Self-service password change. Every session of the user (this one included)
   * is revoked, so the client signs in again with the new password.
   */
  @AllowWhilePasswordChangePending()
  @UseGuards(ThrottlerGuard)
  @Post('change-password')
  @HttpCode(204)
  async changePassword(
    @CurrentPrincipal() principal: Principal,
    @Body(zodBody(changePasswordSchema)) dto: ChangePasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.changePassword(principal.userId, dto.currentPassword, dto.newPassword);
    this.clearRefreshCookie(res, this.slotOf(req));
  }

  @AllowWhilePasswordChangePending()
  @Get('me')
  me(@CurrentPrincipal() principal: Principal) {
    return this.auth.me(principal.userId);
  }

  private ctx(req: Request): AuthContext {
    return { ip: req.ip, userAgent: req.header('user-agent') ?? undefined };
  }

  /** The tab-session slot named by the request, or null for the device session. A malformed slot is a 400. */
  private slotOf(req: Request): string | null {
    const raw = req.header(SLOT_HEADER);
    if (raw === undefined || raw === '') return null;
    if (!isValidSlot(raw)) throw new ValidationError('Invalid session slot');
    return raw;
  }

  private cookieName(slot: string | null): string {
    return slot ? slotCookieName(slot) : DEVICE_REFRESH_COOKIE;
  }

  private setRefreshCookie(res: Response, token: string, slot: string | null): void {
    res.cookie(this.cookieName(slot), token, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/auth',
      // Device session: persistent (survives closing the browser, the "remember this device" behaviour).
      // Tab session: a SESSION cookie (no Max-Age), so it dies with the browser session like the tab's
      // sessionStorage slot does, and abandoned tabs do not leave 30-day credentials behind (ADR-034).
      ...(slot ? {} : { maxAge: this.config.get<number>('REFRESH_TTL_DAYS', 30) * 86_400_000 }),
    });
  }

  private clearRefreshCookie(res: Response, slot: string | null): void {
    res.clearCookie(this.cookieName(slot), { path: '/auth' });
  }

  /** Expire tab-session cookies that are dead or beyond the per-browser cap; never touches `keep` or the device cookie. */
  private async pruneSlotCookies(req: Request, res: Response, keep: string): Promise<void> {
    const sent = (req.cookies ?? {}) as Record<string, unknown>;
    const candidates: Record<string, string> = {};
    for (const [name, value] of Object.entries(sent)) {
      if (name === keep || typeof value !== 'string' || slotFromCookieName(name) === null) continue;
      candidates[name] = value;
    }
    for (const name of await this.auth.deadSlotCookies(candidates)) {
      res.clearCookie(name, { path: '/auth' });
    }
  }
}
