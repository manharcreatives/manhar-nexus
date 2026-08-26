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
import { UnauthorizedError } from '../common/errors';
import { zodBody } from '../common/zod-validation.pipe';
import { AuthService, type AuthContext } from './auth.service';
import { loginSchema, refreshSchema, type LoginDto, type RefreshDto } from './auth.dto';
import { CurrentPrincipal, Public, type Principal } from './principal';

const REFRESH_COOKIE = 'nexus_refresh';

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
    const result = await this.auth.login(dto.email, dto.password, this.ctx(req));
    // Refresh token is delivered ONLY via the httpOnly cookie for browser clients
    // (XSS cannot exfiltrate a durable credential — ADR-024).
    // The JSON body path in /auth/refresh is intended for non-browser clients
    // (native mobile / CLI) where httpOnly cookies are unavailable. It must
    // never be used in browser contexts. TODO: enforce origin-based routing or
    // a client-type header when native clients are added.
    this.setRefreshCookie(res, result.tokens.refreshToken);
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
    const raw = dto.refreshToken ?? (req.cookies?.[REFRESH_COOKIE] as string | undefined);
    if (!raw) throw new UnauthorizedError('Missing refresh token');
    const tokens = await this.auth.refresh(raw, this.ctx(req));
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentPrincipal() principal: Principal, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(principal.sessionId);
    this.clearRefreshCookie(res);
  }

  @Post('logout-all')
  @HttpCode(204)
  async logoutAll(
    @CurrentPrincipal() principal: Principal,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logoutAll(principal.userId);
    this.clearRefreshCookie(res);
  }

  @Get('me')
  me(@CurrentPrincipal() principal: Principal) {
    return this.auth.me(principal.userId);
  }

  private ctx(req: Request): AuthContext {
    return { ip: req.ip, userAgent: req.header('user-agent') ?? undefined };
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/auth',
      maxAge: this.config.get<number>('REFRESH_TTL_DAYS', 30) * 86_400_000,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
  }
}
