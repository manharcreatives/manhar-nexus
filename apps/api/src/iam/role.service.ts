import { Injectable } from '@nestjs/common';
import { Prisma, type Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictError, ForbiddenError, NotFoundError } from '../common/errors';
import { TenantScopedRepository } from '../common/tenant-scoped.repository';
import type { TenantScope } from '../common/tenant-scope';
import { AuditService } from '../core/audit/audit.service';
import { PermissionRegistry } from './permission.registry';
import { assertCanGrantPermissions } from './grant-policy';
import type { Principal } from './principal';

export interface RoleView {
  id: string;
  businessId: string | null;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
}
export interface CreateRoleInput {
  key: string;
  name: string;
  description?: string;
  permissions: string[];
}
export interface UpdateRoleInput {
  name?: string;
  description?: string | null;
  permissions?: string[];
}

/** Role management. System roles are read-only templates; businesses manage
 *  their own custom roles, bounded by the granting user's own permissions. */
@Injectable()
export class RoleService extends TenantScopedRepository {
  constructor(
    prisma: PrismaService,
    private readonly registry: PermissionRegistry,
    private readonly audit: AuditService,
  ) {
    super(prisma);
  }

  /** System roles + this business's custom roles. */
  async list(scope: TenantScope, opts: { skip?: number; take?: number } = {}): Promise<RoleView[]> {
    const roles = await this.prisma.role.findMany({
      where: { OR: [{ businessId: null }, { businessId: scope.businessId }] },
      include: { permissions: true },
      orderBy: [{ isSystem: 'desc' }, { key: 'asc' }],
      skip: opts.skip ?? 0,
      take: Math.min(opts.take ?? 100, 200),
    });
    return roles.map(toView);
  }

  async create(scope: TenantScope, principal: Principal, dto: CreateRoleInput): Promise<RoleView> {
    this.assertCanGrant(principal, dto.permissions);
    try {
      const role = await this.prisma.$transaction(async (tx) => {
        const created = await tx.role.create({
          data: {
            businessId: scope.businessId,
            key: dto.key,
            name: dto.name,
            description: dto.description ?? null,
            isSystem: false,
          },
        });
        await this.writePermissions(tx, created.id, dto.permissions);
        await this.audit.append(tx, scope, {
          action: 'role.created',
          resourceType: 'role',
          resourceId: created.id,
          metadata: { key: dto.key, permissions: dto.permissions },
        });
        return created;
      });
      return this.loadView(scope, role.id);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('Role key already exists in this business', { key: dto.key });
      }
      throw err;
    }
  }

  async update(
    scope: TenantScope,
    principal: Principal,
    id: string,
    dto: UpdateRoleInput,
  ): Promise<RoleView> {
    const role = await this.loadCustom(scope, id);
    if (dto.permissions) this.assertCanGrant(principal, dto.permissions);

    await this.prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id: role.id },
        data: {
          name: dto.name ?? undefined,
          description: dto.description === undefined ? undefined : dto.description,
        },
      });
      if (dto.permissions) {
        await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
        await this.writePermissions(tx, role.id, dto.permissions);
      }
      await this.audit.append(tx, scope, {
        action: 'role.updated',
        resourceType: 'role',
        resourceId: role.id,
        metadata: { name: dto.name, permissions: dto.permissions },
      });
    });
    return this.loadView(scope, role.id);
  }

  async remove(scope: TenantScope, id: string): Promise<void> {
    const role = await this.loadCustom(scope, id);
    const inUse = await this.prisma.userRole.count({ where: { roleId: role.id } });
    if (inUse > 0) {
      throw new ConflictError('Role is assigned to users; unassign before deleting', { id });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.role.delete({ where: { id: role.id } });
      await this.audit.append(tx, scope, {
        action: 'role.deleted',
        resourceType: 'role',
        resourceId: role.id,
        metadata: { key: role.key },
      });
    });
  }

  // ── internals ──

  /** Delegates to the shared escalation firewall (see grant-policy.ts). */
  private assertCanGrant(principal: Principal, permissions: string[]): void {
    assertCanGrantPermissions(principal, this.registry, permissions);
  }

  private async writePermissions(
    tx: Prisma.TransactionClient,
    roleId: string,
    permissions: string[],
  ): Promise<void> {
    const unique = [...new Set(permissions)];
    for (const permissionKey of unique) {
      await tx.rolePermission.create({ data: { roleId, permissionKey } });
    }
  }

  private async loadCustom(scope: TenantScope, id: string): Promise<Role> {
    const role = await this.prisma.role.findFirst({ where: { id, businessId: scope.businessId } });
    if (!role) throw new NotFoundError('Custom role not found', { id });
    if (role.isSystem) throw new ForbiddenError('System roles are read-only');
    return role;
  }

  private async loadView(scope: TenantScope, id: string): Promise<RoleView> {
    const role = await this.prisma.role.findFirst({
      where: { id, OR: [{ businessId: null }, { businessId: scope.businessId }] },
      include: { permissions: true },
    });
    if (!role) throw new NotFoundError('Role not found', { id });
    return toView(role);
  }
}

function toView(role: Role & { permissions: { permissionKey: string }[] }): RoleView {
  return {
    id: role.id,
    businessId: role.businessId,
    key: role.key,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissions: role.permissions.map((p) => p.permissionKey),
  };
}
