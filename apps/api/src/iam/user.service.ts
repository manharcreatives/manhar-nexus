import { Injectable } from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../common/errors';
import { TenantScopedRepository } from '../common/tenant-scoped.repository';
import type { TenantScope } from '../common/tenant-scope';
import { AuditService } from '../core/audit/audit.service';
import { PasswordService } from './password.service';
import { PermissionRegistry, WILDCARD } from './permission.registry';
import { assertCanGrantLocations, assertCanGrantPermissions } from './grant-policy';
import type { Principal } from './principal';

export interface CreateUserInput {
  email: string;
  password: string;
  displayName: string;
  roleKeys?: string[];
}
export interface UpdateUserInput {
  displayName?: string;
  status?: 'ACTIVE' | 'SUSPENDED';
}
export interface AssignRoleInput {
  roleId: string;
  allLocations?: boolean;
  locationIds?: string[];
}

export interface UserDirectoryInput {
  q?: string;
  status?: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
  roleId?: string;
  skip?: number;
  take?: number;
}

/** One role assignment as the Team screen shows it (names, never just ids). */
export interface DirectoryRoleView {
  roleId: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  allLocations: boolean;
  locations: { id: string; name: string }[];
}
export interface DirectoryUserView {
  id: string;
  email: string;
  displayName: string;
  status: User['status'];
  createdAt: Date;
  lastLoginAt: Date | null;
  /** Only set while a lockout is in force (past lockouts are reported as null). */
  lockedUntil: Date | null;
  roles: DirectoryRoleView[];
}
/** What the caller may do on the Team screen, derived from their own permissions. */
export interface DirectoryViewerCapabilities {
  canCreate: boolean;
  canEdit: boolean;
  canAssignRoles: boolean;
  canViewRoles: boolean;
}
export interface UserDirectoryView {
  items: DirectoryUserView[];
  total: number;
  viewer: DirectoryViewerCapabilities;
}

const DIRECTORY_DEFAULT_TAKE = 25;
const DIRECTORY_MAX_TAKE = 100;

/** Public projection — never leaks passwordHash/tokenVersion/totp. */
export type UserView = Pick<
  User,
  'id' | 'email' | 'displayName' | 'realm' | 'businessId' | 'status' | 'createdAt'
>;
const view = (u: User): UserView => ({
  id: u.id,
  email: u.email,
  displayName: u.displayName,
  realm: u.realm,
  businessId: u.businessId,
  status: u.status,
  createdAt: u.createdAt,
});

/** Business-realm user management, tenant-scoped (ADR-002). */
@Injectable()
export class UserService extends TenantScopedRepository {
  constructor(
    prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
    private readonly registry: PermissionRegistry,
  ) {
    super(prisma);
  }

  async create(scope: TenantScope, principal: Principal, dto: CreateUserInput): Promise<UserView> {
    const email = dto.email.trim().toLowerCase();
    const passwordHash = await this.passwords.hash(dto.password);
    const roleIds = await this.resolveRoleIds(scope, dto.roleKeys ?? []);
    // Assigning roles at creation is a grant — enforce the escalation firewall
    // for every role's permissions, and (all-locations) location scope.
    for (const roleId of roleIds) await this.assertCanAssignRole(principal, roleId);
    assertCanGrantLocations(principal, true, []);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            realm: 'BUSINESS',
            businessId: scope.businessId,
            email,
            passwordHash,
            displayName: dto.displayName,
          },
        });
        for (const roleId of roleIds) {
          await tx.userRole.create({
            data: { userId: user.id, roleId, businessId: scope.businessId, allLocations: true },
          });
        }
        await this.audit.append(tx, scope, {
          action: 'user.created',
          resourceType: 'user',
          resourceId: user.id,
          metadata: { email, displayName: dto.displayName, roles: dto.roleKeys ?? [] },
        });
        return user;
      });
      return view(created);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('Email already in use', { email });
      }
      throw err;
    }
  }

  async list(scope: TenantScope, opts: { skip?: number; take?: number } = {}): Promise<UserView[]> {
    const users = await this.prisma.user.findMany({
      where: this.scoped(scope),
      orderBy: { createdAt: 'asc' },
      skip: opts.skip ?? 0,
      take: Math.min(opts.take ?? 50, 200),
    });
    return users.map(view);
  }

  /**
   * Team directory: tenant-scoped, searchable (name/email), filterable by status
   * and role, bounded pagination with a full total. Each row carries its role
   * assignments with human names and location names so the UI never has to
   * show raw ids, plus the caller's own capabilities for the screen.
   */
  async directory(
    scope: TenantScope,
    principal: Principal,
    q: UserDirectoryInput = {},
  ): Promise<UserDirectoryView> {
    const term = q.q?.trim();
    const where: Prisma.UserWhereInput = this.scoped(scope, {
      ...(q.status ? { status: q.status } : {}),
      ...(q.roleId ? { userRoles: { some: { roleId: q.roleId } } } : {}),
      ...(term
        ? {
            OR: [
              { displayName: { contains: term, mode: Prisma.QueryMode.insensitive } },
              { email: { contains: term.toLowerCase(), mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : {}),
    });
    const take = Math.min(q.take ?? DIRECTORY_DEFAULT_TAKE, DIRECTORY_MAX_TAKE);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: {
          userRoles: {
            include: {
              role: true,
              locations: { include: { location: { select: { id: true, name: true } } } },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
        skip: q.skip ?? 0,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);
    const now = Date.now();
    const items: DirectoryUserView[] = rows.map((u) => ({
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      status: u.status,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      lockedUntil: u.lockedUntil && u.lockedUntil.getTime() > now ? u.lockedUntil : null,
      roles: u.userRoles.map((ur) => ({
        roleId: ur.roleId,
        key: ur.role.key,
        name: ur.role.name,
        description: ur.role.description,
        isSystem: ur.role.isSystem,
        allLocations: ur.allLocations,
        locations: ur.allLocations
          ? []
          : ur.locations
              .map((l) => ({ id: l.location.id, name: l.location.name }))
              .sort((a, b) => a.name.localeCompare(b.name)),
      })),
    }));
    const holds = (key: string) =>
      principal.permissions.has(WILDCARD) || principal.permissions.has(key);
    return {
      items,
      total,
      viewer: {
        canCreate: holds('core.user.create'),
        canEdit: holds('core.user.edit'),
        canAssignRoles: holds('core.role.assign'),
        canViewRoles: holds('core.role.view'),
      },
    };
  }

  /**
   * An administrator sets a new password for someone else (there is no
   * self-service reset flow yet). Clears any lockout and ends every live
   * session of that user. Escalation firewall: you may only reset the password
   * of a user whose permissions and location scope are within your own —
   * otherwise resetting would let you sign in as someone more powerful.
   */
  async resetPassword(
    scope: TenantScope,
    principal: Principal,
    userId: string,
    password: string,
  ): Promise<void> {
    if (userId === principal.userId) {
      throw new ForbiddenError('You cannot reset your own password here');
    }
    await this.load(scope, userId);
    const assignments = await this.prisma.userRole.findMany({
      where: { userId },
      include: { locations: true, role: { include: { permissions: true } } },
    });
    const perms = new Set<string>();
    for (const a of assignments) for (const rp of a.role.permissions) perms.add(rp.permissionKey);
    assertCanGrantPermissions(principal, this.registry, [...perms]);
    for (const a of assignments) {
      assertCanGrantLocations(
        principal,
        a.allLocations,
        a.locations.map((l) => l.locationId),
      );
    }

    const passwordHash = await this.passwords.hash(password);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          failedAttempts: 0,
          lockedUntil: null,
          tokenVersion: { increment: 1 },
        },
      });
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'password_reset' },
      });
      await this.audit.append(tx, scope, {
        action: 'user.password_reset',
        resourceType: 'user',
        resourceId: userId,
        metadata: {},
      });
    });
  }

  async findByIdOrThrow(scope: TenantScope, id: string): Promise<UserView> {
    return view(await this.load(scope, id));
  }

  async update(scope: TenantScope, id: string, dto: UpdateUserInput): Promise<UserView> {
    const existing = await this.load(scope, id);
    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: existing.id },
        data: { displayName: dto.displayName ?? undefined, status: dto.status ?? undefined },
      });
      // Suspending a user must kill their live sessions (≤60s).
      if (dto.status === 'SUSPENDED' && existing.status !== 'SUSPENDED') {
        await tx.user.update({ where: { id }, data: { tokenVersion: { increment: 1 } } });
        await tx.session.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: 'suspended' },
        });
      }
      await this.audit.append(tx, scope, {
        action: 'user.updated',
        resourceType: 'user',
        resourceId: id,
        metadata: { displayName: dto.displayName, status: dto.status },
      });
      return user;
    });
    return view(updated);
  }

  async assignRole(
    scope: TenantScope,
    principal: Principal,
    userId: string,
    dto: AssignRoleInput,
  ): Promise<void> {
    // Separation of duty: you cannot change your own role assignments.
    if (userId === principal.userId) {
      throw new ForbiddenError('You cannot change your own role assignments');
    }
    await this.load(scope, userId);
    const role = await this.assertAssignableRole(scope, dto.roleId);
    const locationIds = await this.validateLocations(scope, dto.locationIds ?? []);
    const allLocations = dto.allLocations ?? locationIds.length === 0;
    // Escalation firewall: you can only assign a role whose permissions you
    // already hold, and you cannot widen location scope beyond your own.
    await this.assertCanAssignRole(principal, role.id);
    assertCanGrantLocations(principal, allLocations, locationIds);

    await this.prisma.$transaction(async (tx) => {
      const userRole = await tx.userRole.upsert({
        where: { userId_roleId: { userId, roleId: role.id } },
        create: {
          userId,
          roleId: role.id,
          businessId: scope.businessId,
          allLocations,
        },
        update: { allLocations },
      });
      await tx.userRoleLocation.deleteMany({ where: { userRoleId: userRole.id } });
      if (!allLocations) {
        for (const locationId of locationIds) {
          await tx.userRoleLocation.create({ data: { userRoleId: userRole.id, locationId } });
        }
      }
      await this.audit.append(tx, scope, {
        action: 'user.role_assigned',
        resourceType: 'user',
        resourceId: userId,
        metadata: { roleKey: role.key, allLocations, locationIds },
      });
    });
    // No token-version bump needed: permissions are resolved per-request by
    // JwtAuthGuard, so the change is effective on the user's very next request.
  }

  async removeRole(
    scope: TenantScope,
    principal: Principal,
    userId: string,
    roleId: string,
  ): Promise<void> {
    if (userId === principal.userId) {
      throw new ForbiddenError('You cannot change your own role assignments');
    }
    await this.load(scope, userId);
    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.userRole.deleteMany({ where: { userId, roleId } });
      if (deleted.count === 0) throw new NotFoundError('Role assignment not found', { roleId });
      await this.audit.append(tx, scope, {
        action: 'user.role_removed',
        resourceType: 'user',
        resourceId: userId,
        metadata: { roleId },
      });
    });
  }

  // ── internals ──

  private async load(scope: TenantScope, id: string): Promise<User> {
    const user = await this.prisma.user.findFirst({ where: this.scoped(scope, { id }) });
    if (!user) throw new NotFoundError('User not found', { id });
    return this.assertOwned(user as User & { businessId: string }, scope);
  }

  /**
   * A role is assignable only if the assigning principal already holds every
   * permission the role confers (prevents assigning the pre-existing `owner`
   * wildcard role, or any role, to escalate beyond yourself).
   */
  private async assertCanAssignRole(principal: Principal, roleId: string): Promise<void> {
    const perms = await this.prisma.rolePermission.findMany({
      where: { roleId },
      select: { permissionKey: true },
    });
    assertCanGrantPermissions(
      principal,
      this.registry,
      perms.map((p) => p.permissionKey),
    );
  }

  /** System roles (businessId null) + this business's custom roles are assignable. */
  private async assertAssignableRole(scope: TenantScope, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, OR: [{ businessId: null }, { businessId: scope.businessId }] },
    });
    if (!role) throw new NotFoundError('Role not found', { roleId });
    // Platform roles are never assignable through the business realm.
    if (role.key === 'platform-admin') {
      throw new ValidationError('Cannot assign a platform role', { roleId });
    }
    return role;
  }

  private async resolveRoleIds(scope: TenantScope, roleKeys: string[]): Promise<string[]> {
    const ids: string[] = [];
    for (const key of roleKeys) {
      const role = await this.prisma.role.findFirst({
        where: { key, OR: [{ businessId: null }, { businessId: scope.businessId }] },
      });
      if (!role || role.key === 'platform-admin') {
        throw new ValidationError('Unknown or non-assignable role', { key });
      }
      ids.push(role.id);
    }
    return ids;
  }

  private async validateLocations(scope: TenantScope, locationIds: string[]): Promise<string[]> {
    for (const id of locationIds) await this.assertLocationInScope(scope, id);
    return locationIds;
  }
}
