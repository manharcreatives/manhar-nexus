import { Injectable } from '@nestjs/common';
import { Prisma, type DiningArea, type DiningTable } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictError, NotFoundError, VersionConflictError } from '../../common/errors';
import { TenantScopedRepository } from '../../common/tenant-scoped.repository';
import { AuditService } from '../../core/audit/audit.service';
import type { TenantScope } from '../../common/tenant-scope';
import type { CreateDiningAreaDto, UpdateDiningAreaDto, CreateDiningTableDto, UpdateDiningTableDto } from './dining.dto';

@Injectable()
export class DiningService extends TenantScopedRepository {
  constructor(
    prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    super(prisma);
  }

  // ── Dining Areas ───────────────────────────────────────────────────────────────

  async listAreas(scope: TenantScope, locationId?: string): Promise<DiningArea[]> {
    return this.prisma.diningArea.findMany({
      where: this.scoped(scope, locationId ? { locationId } : undefined),
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { tables: { orderBy: { code: 'asc' } } },
    });
  }

  async findAreaOrThrow(scope: TenantScope, id: string): Promise<DiningArea> {
    const row = await this.prisma.diningArea.findFirst({
      where: this.scoped(scope, { id }),
      include: { tables: { orderBy: { code: 'asc' } } },
    });
    if (!row) throw new NotFoundError('Dining area not found', { id });
    return this.assertOwned(row, scope);
  }

  async createArea(scope: TenantScope, dto: CreateDiningAreaDto): Promise<DiningArea> {
    await this.assertLocationInScope(scope, dto.locationId);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.diningArea.create({
        data: {
          businessId: scope.businessId,
          locationId: dto.locationId,
          name: dto.name,
          isActive: dto.isActive,
          sortOrder: dto.sortOrder,
        },
        include: { tables: true },
      });
      await this.audit.append(tx, scope, {
        action: 'dining_area.created',
        resourceType: 'dining_area',
        resourceId: row.id,
        metadata: { name: row.name, locationId: dto.locationId },
      });
      return row;
    });
  }

  async updateArea(scope: TenantScope, id: string, dto: UpdateDiningAreaDto): Promise<DiningArea> {
    const existing = await this.findAreaOrThrow(scope, id);
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== existing.version) {
      throw new VersionConflictError('Dining area was modified concurrently', {
        expectedVersion: dto.expectedVersion,
        actualVersion: existing.version,
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.diningArea.update({
        where: { id },
        data: {
          name: dto.name,
          isActive: dto.isActive,
          sortOrder: dto.sortOrder,
          version: { increment: 1 },
        },
        include: { tables: { orderBy: { code: 'asc' } } },
      });
      await this.audit.append(tx, scope, {
        action: 'dining_area.updated',
        resourceType: 'dining_area',
        resourceId: id,
        metadata: { id },
      });
      return row;
    });
  }

  async deleteArea(scope: TenantScope, id: string): Promise<void> {
    const existing = await this.findAreaOrThrow(scope, id);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.diningArea.delete({ where: { id: existing.id } });
        await this.audit.append(tx, scope, {
          action: 'dining_area.deleted',
          resourceType: 'dining_area',
          resourceId: id,
          metadata: { name: existing.name },
        });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictError('Dining area has tables and cannot be deleted', { id });
      }
      throw e;
    }
  }

  // ── Dining Tables ──────────────────────────────────────────────────────────────

  async listTables(scope: TenantScope, areaId?: string): Promise<DiningTable[]> {
    return this.prisma.diningTable.findMany({
      where: this.scoped(scope, areaId ? { diningAreaId: areaId } : undefined),
      orderBy: { code: 'asc' },
    });
  }

  async findTableOrThrow(scope: TenantScope, id: string): Promise<DiningTable> {
    const row = await this.prisma.diningTable.findFirst({ where: this.scoped(scope, { id }) });
    if (!row) throw new NotFoundError('Dining table not found', { id });
    return this.assertOwned(row, scope);
  }

  async createTable(scope: TenantScope, dto: CreateDiningTableDto): Promise<DiningTable> {
    await this.assertAreaInScope(scope, dto.diningAreaId, dto.locationId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.diningTable.create({
          data: {
            diningAreaId: dto.diningAreaId,
            businessId: scope.businessId,
            locationId: dto.locationId,
            code: dto.code,
            capacity: dto.capacity,
            isActive: dto.isActive,
          },
        });
        await this.audit.append(tx, scope, {
          action: 'dining_table.created',
          resourceType: 'dining_table',
          resourceId: row.id,
          metadata: { code: row.code, diningAreaId: dto.diningAreaId },
        });
        return row;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictError('Table code already exists in this dining area', { code: dto.code, diningAreaId: dto.diningAreaId });
      }
      throw e;
    }
  }

  async updateTable(scope: TenantScope, id: string, dto: UpdateDiningTableDto): Promise<DiningTable> {
    const existing = await this.findTableOrThrow(scope, id);
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== existing.version) {
      throw new VersionConflictError('Dining table was modified concurrently', {
        expectedVersion: dto.expectedVersion,
        actualVersion: existing.version,
      });
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.diningTable.update({
          where: { id },
          data: {
            code: dto.code,
            capacity: dto.capacity,
            status: dto.status,
            isActive: dto.isActive,
            version: { increment: 1 },
          },
        });
        await this.audit.append(tx, scope, {
          action: 'dining_table.updated',
          resourceType: 'dining_table',
          resourceId: id,
          metadata: { id },
        });
        return row;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictError('Table code already exists in this dining area', { code: dto.code });
      }
      throw e;
    }
  }

  async deleteTable(scope: TenantScope, id: string): Promise<void> {
    const existing = await this.findTableOrThrow(scope, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.diningTable.delete({ where: { id: existing.id } });
      await this.audit.append(tx, scope, {
        action: 'dining_table.deleted',
        resourceType: 'dining_table',
        resourceId: id,
        metadata: { code: existing.code },
      });
    });
  }

  private async assertAreaInScope(scope: TenantScope, areaId: string, locationId: string): Promise<void> {
    const row = await this.prisma.diningArea.findFirst({
      where: this.scoped(scope, { id: areaId, locationId }),
      select: { id: true },
    });
    if (!row) throw new NotFoundError('Dining area not found for this location in this business', { areaId, locationId });
  }
}
