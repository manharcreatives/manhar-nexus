import { Injectable } from '@nestjs/common';
import { Prisma, type Location, type LocationHours, type LocationServiceMode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictError, NotFoundError } from '../../common/errors';
import { TenantScopedRepository } from '../../common/tenant-scoped.repository';
import type { TenantScope } from '../../common/tenant-scope';
import { AuditService } from '../audit/audit.service';
import type {
  CreateLocationDto,
  UpdateLocationDto,
  UpsertLocationHoursDto,
  UpsertServiceModesDto,
} from './location.dto';

/** Location management, always scoped to the caller's business (ADR-002). */
@Injectable()
export class LocationService extends TenantScopedRepository {
  constructor(
    prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    super(prisma);
  }

  async create(scope: TenantScope, dto: CreateLocationDto): Promise<Location> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const location = await tx.location.create({
          data: {
            businessId: scope.businessId,
            name: dto.name,
            code: dto.code ?? null,
            timezone: dto.timezone ?? null,
          },
        });
        await this.audit.append(tx, { ...scope, locationId: location.id }, {
          action: 'location.created',
          resourceType: 'location',
          resourceId: location.id,
          metadata: { name: location.name, code: location.code },
        });
        return location;
      });
    } catch (err) {
      throw this.mapCodeConflict(err, dto.code);
    }
  }

  async list(scope: TenantScope): Promise<Location[]> {
    return this.prisma.location.findMany({
      where: this.scoped(scope),
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByIdOrThrow(scope: TenantScope, id: string): Promise<Location> {
    const location = await this.prisma.location.findFirst({ where: this.scoped(scope, { id }) });
    if (!location) throw new NotFoundError('Location not found', { id });
    return this.assertOwned(location, scope);
  }

  async update(scope: TenantScope, id: string, dto: UpdateLocationDto): Promise<Location> {
    const existing = await this.findByIdOrThrow(scope, id);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const location = await tx.location.update({
          where: { id: existing.id },
          data: {
            name: dto.name ?? undefined,
            code: dto.code === undefined ? undefined : dto.code,
            timezone: dto.timezone === undefined ? undefined : dto.timezone,
            status: dto.status ?? undefined,
          },
        });
        await this.audit.append(tx, { ...scope, locationId: id }, {
          action: 'location.updated',
          resourceType: 'location',
          resourceId: id,
          metadata: this.diff(existing, location),
        });
        return location;
      });
    } catch (err) {
      throw this.mapCodeConflict(err, dto.code ?? undefined);
    }
  }

  // ── Location Hours ─────────────────────────────────────────────────────────

  async getHours(scope: TenantScope, locationId: string): Promise<LocationHours[]> {
    await this.findByIdOrThrow(scope, locationId);
    return this.prisma.locationHours.findMany({
      where: { locationId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async upsertHours(
    scope: TenantScope,
    locationId: string,
    dto: UpsertLocationHoursDto,
  ): Promise<LocationHours[]> {
    await this.findByIdOrThrow(scope, locationId);
    return this.prisma.$transaction(async (tx) => {
      for (const day of dto.hours) {
        await tx.locationHours.upsert({
          where: { locationId_dayOfWeek: { locationId, dayOfWeek: day.dayOfWeek } },
          create: {
            locationId,
            businessId: scope.businessId,
            dayOfWeek: day.dayOfWeek,
            isClosed: day.isClosed,
            openTime: day.isClosed ? null : (day.openTime ?? null),
            closeTime: day.isClosed ? null : (day.closeTime ?? null),
          },
          update: {
            isClosed: day.isClosed,
            openTime: day.isClosed ? null : (day.openTime ?? null),
            closeTime: day.isClosed ? null : (day.closeTime ?? null),
            version: { increment: 1 },
          },
        });
      }
      await this.audit.append(tx, { ...scope, locationId }, {
        action: 'location.hours.updated',
        resourceType: 'location_hours',
        resourceId: locationId,
        metadata: { days: dto.hours.map((h) => h.dayOfWeek) },
      });
      return tx.locationHours.findMany({
        where: { locationId },
        orderBy: { dayOfWeek: 'asc' },
      });
    });
  }

  // ── Service Modes ──────────────────────────────────────────────────────────

  async getServiceModes(scope: TenantScope, locationId: string): Promise<LocationServiceMode[]> {
    await this.findByIdOrThrow(scope, locationId);
    return this.prisma.locationServiceMode.findMany({
      where: { locationId },
      orderBy: { mode: 'asc' },
    });
  }

  async upsertServiceModes(
    scope: TenantScope,
    locationId: string,
    dto: UpsertServiceModesDto,
  ): Promise<LocationServiceMode[]> {
    await this.findByIdOrThrow(scope, locationId);
    return this.prisma.$transaction(async (tx) => {
      for (const entry of dto.modes) {
        await tx.locationServiceMode.upsert({
          where: { locationId_mode: { locationId, mode: entry.mode } },
          create: { locationId, businessId: scope.businessId, mode: entry.mode, isEnabled: entry.isEnabled },
          update: { isEnabled: entry.isEnabled },
        });
      }
      await this.audit.append(tx, { ...scope, locationId }, {
        action: 'location.service_modes.updated',
        resourceType: 'location_service_mode',
        resourceId: locationId,
        metadata: { modes: dto.modes },
      });
      return tx.locationServiceMode.findMany({
        where: { locationId },
        orderBy: { mode: 'asc' },
      });
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private diff(before: Location, after: Location): Record<string, unknown> {
    const changed: Record<string, unknown> = {};
    for (const key of ['name', 'code', 'timezone', 'status'] as const) {
      if (before[key] !== after[key]) changed[key] = { from: before[key], to: after[key] };
    }
    return changed;
  }

  /** Maps the (businessId, code) unique violation to a typed conflict. */
  private mapCodeConflict(err: unknown, code?: string | null): unknown {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return new ConflictError('Location code already exists in this business', { code });
    }
    return err;
  }
}
