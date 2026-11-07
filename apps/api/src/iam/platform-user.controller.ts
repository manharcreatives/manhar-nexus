import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { BusinessExistsGuard } from '../common/business-exists.guard';
import { zodBody } from '../common/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from './user.service';
import { createUserSchema, type CreateUserBody } from './iam.dto';
import {
  CurrentPrincipal,
  RequirePermission,
  scopeForPlatform,
  type Principal,
} from './principal';

/**
 * Platform-realm endpoint to provision a business's users (e.g. its first
 * Owner) right after the business is created via /internal. businessId comes
 * from the validated path param because platform admins act cross-business.
 */
@Controller('internal/businesses/:businessId/users')
@UseGuards(BusinessExistsGuard)
export class PlatformUserController {
  constructor(
    private readonly users: UserService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @RequirePermission('platform.business.configure')
  create(
    @CurrentPrincipal() p: Principal,
    @Param('businessId') businessId: string,
    @Body(zodBody(createUserSchema)) dto: CreateUserBody,
  ) {
    return this.users.create(scopeForPlatform(p, businessId), p, {
      ...dto,
      roleKeys: dto.roleKeys ?? ['owner'],
    });
  }

  /**
   * Support view of a client's people: who they are, whether they ever signed in, their roles and any sign-in lock.
   * Never includes a password hash or token data.
   */
  @Get()
  @RequirePermission('platform.business.view')
  async list(@Param('businessId') businessId: string): Promise<PlatformUserRow[]> {
    const rows = await this.prisma.user.findMany({
      where: { businessId, realm: 'BUSINESS' },
      orderBy: { createdAt: 'asc' },
      take: 200,
      include: { userRoles: { include: { role: { select: { name: true } } } } },
    });
    const now = Date.now();
    return rows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.displayName,
      status: u.status,
      lastLoginAt: u.lastLoginAt,
      roles: [...new Set(u.userRoles.map((r) => r.role.name))],
      failedLoginCount: u.failedAttempts,
      lockedUntil: u.lockedUntil && u.lockedUntil.getTime() > now ? u.lockedUntil.toISOString() : null,
    }));
  }
}

/** One person of a client business, as platform support sees them. */
export interface PlatformUserRow {
  id: string;
  email: string;
  name: string;
  status: string;
  lastLoginAt: Date | null;
  roles: string[];
  failedLoginCount: number;
  lockedUntil: string | null;
}
