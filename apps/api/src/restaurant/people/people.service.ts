import { Injectable } from '@nestjs/common';
import { type StaffProfile, type Guest } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError, VersionConflictError } from '../../common/errors';
import { TenantScopedRepository } from '../../common/tenant-scoped.repository';
import { AuditService } from '../../core/audit/audit.service';
import type { TenantScope } from '../../common/tenant-scope';
import type { CreateStaffProfileDto, UpdateStaffProfileDto, CreateGuestDto, UpdateGuestDto } from './people.dto';

@Injectable()
export class PeopleService extends TenantScopedRepository {
  constructor(
    prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    super(prisma);
  }

  // ── Staff Profiles ─────────────────────────────────────────────────────────────

  async listStaff(scope: TenantScope): Promise<StaffProfile[]> {
    return this.prisma.staffProfile.findMany({
      where: this.scoped(scope),
      orderBy: { displayName: 'asc' },
    });
  }

  async findStaffOrThrow(scope: TenantScope, id: string): Promise<StaffProfile> {
    const row = await this.prisma.staffProfile.findFirst({ where: this.scoped(scope, { id }) });
    if (!row) throw new NotFoundError('Staff profile not found', { id });
    return this.assertOwned(row, scope);
  }

  async createStaff(scope: TenantScope, dto: CreateStaffProfileDto): Promise<StaffProfile> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.staffProfile.create({
        data: {
          businessId: scope.businessId,
          displayName: dto.displayName,
          roleTag: dto.roleTag,
          isActive: dto.isActive,
        },
      });
      await this.audit.append(tx, scope, {
        action: 'staff_profile.created',
        resourceType: 'staff_profile',
        resourceId: row.id,
        metadata: { displayName: row.displayName, roleTag: row.roleTag },
      });
      return row;
    });
  }

  async updateStaff(scope: TenantScope, id: string, dto: UpdateStaffProfileDto): Promise<StaffProfile> {
    const existing = await this.findStaffOrThrow(scope, id);
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== existing.version) {
      throw new VersionConflictError('Staff profile was modified concurrently', {
        expectedVersion: dto.expectedVersion,
        actualVersion: existing.version,
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.staffProfile.update({
        where: { id },
        data: {
          displayName: dto.displayName,
          roleTag: dto.roleTag,
          isActive: dto.isActive,
          version: { increment: 1 },
        },
      });
      await this.audit.append(tx, scope, {
        action: 'staff_profile.updated',
        resourceType: 'staff_profile',
        resourceId: id,
        metadata: { id },
      });
      return row;
    });
  }

  async deleteStaff(scope: TenantScope, id: string): Promise<void> {
    const existing = await this.findStaffOrThrow(scope, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.staffProfile.delete({ where: { id: existing.id } });
      await this.audit.append(tx, scope, {
        action: 'staff_profile.deleted',
        resourceType: 'staff_profile',
        resourceId: id,
        metadata: { displayName: existing.displayName },
      });
    });
  }

  // ── Guests ─────────────────────────────────────────────────────────────────────

  async listGuests(scope: TenantScope): Promise<Guest[]> {
    return this.prisma.guest.findMany({
      where: this.scoped(scope),
      orderBy: { displayName: 'asc' },
    });
  }

  async findGuestOrThrow(scope: TenantScope, id: string): Promise<Guest> {
    const row = await this.prisma.guest.findFirst({ where: this.scoped(scope, { id }) });
    if (!row) throw new NotFoundError('Guest not found', { id });
    return this.assertOwned(row, scope);
  }

  async createGuest(scope: TenantScope, dto: CreateGuestDto): Promise<Guest> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.guest.create({
        data: {
          businessId: scope.businessId,
          displayName: dto.displayName,
          phone: dto.phone ?? null,
          notes: dto.notes ?? null,
          tags: dto.tags,
        },
      });
      await this.audit.append(tx, scope, {
        action: 'guest.created',
        resourceType: 'guest',
        resourceId: row.id,
        metadata: { displayName: row.displayName },
      });
      return row;
    });
  }

  async updateGuest(scope: TenantScope, id: string, dto: UpdateGuestDto): Promise<Guest> {
    const existing = await this.findGuestOrThrow(scope, id);
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== existing.version) {
      throw new VersionConflictError('Guest was modified concurrently', {
        expectedVersion: dto.expectedVersion,
        actualVersion: existing.version,
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.guest.update({
        where: { id },
        data: {
          displayName: dto.displayName,
          phone: dto.phone === undefined ? undefined : dto.phone,
          notes: dto.notes === undefined ? undefined : dto.notes,
          tags: dto.tags !== undefined ? dto.tags : undefined,
          version: { increment: 1 },
        },
      });
      await this.audit.append(tx, scope, {
        action: 'guest.updated',
        resourceType: 'guest',
        resourceId: id,
        metadata: { id },
      });
      return row;
    });
  }

  async deleteGuest(scope: TenantScope, id: string): Promise<void> {
    const existing = await this.findGuestOrThrow(scope, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.guest.delete({ where: { id: existing.id } });
      await this.audit.append(tx, scope, {
        action: 'guest.deleted',
        resourceType: 'guest',
        resourceId: id,
        metadata: { displayName: existing.displayName },
      });
    });
  }
}
