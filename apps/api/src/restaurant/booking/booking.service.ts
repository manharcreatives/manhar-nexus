import { Injectable } from '@nestjs/common';
import { type Booking } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError, ValidationError, VersionConflictError } from '../../common/errors';
import { TenantScopedRepository } from '../../common/tenant-scoped.repository';
import { AuditService } from '../../core/audit/audit.service';
import type { TenantScope } from '../../common/tenant-scope';
import type { CreateBookingDto, UpdateBookingDto } from './booking.dto';

@Injectable()
export class BookingService extends TenantScopedRepository {
  constructor(
    prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    super(prisma);
  }

  async list(scope: TenantScope, locationId?: string): Promise<Booking[]> {
    return this.prisma.booking.findMany({
      where: this.scoped(scope, locationId ? { locationId } : undefined),
      orderBy: { scheduledAt: 'asc' },
      include: { guest: true, diningTable: true },
    });
  }

  async findByIdOrThrow(scope: TenantScope, id: string): Promise<Booking> {
    const row = await this.prisma.booking.findFirst({
      where: this.scoped(scope, { id }),
      include: { guest: true, diningTable: true },
    });
    if (!row) throw new NotFoundError('Booking not found', { id });
    return this.assertOwned(row, scope);
  }

  async create(scope: TenantScope, dto: CreateBookingDto): Promise<Booking> {
    await this.assertLocationInScope(scope, dto.locationId);
    if (dto.diningTableId) await this.assertTableInScope(scope, dto.diningTableId, dto.locationId);
    if (dto.guestId) await this.assertGuestInScope(scope, dto.guestId);

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.booking.create({
        data: {
          businessId: scope.businessId,
          locationId: dto.locationId,
          diningTableId: dto.diningTableId ?? null,
          guestId: dto.guestId ?? null,
          partySize: dto.partySize,
          scheduledAt: new Date(dto.scheduledAt),
          notes: dto.notes ?? null,
        },
        include: { guest: true, diningTable: true },
      });
      await this.audit.append(tx, scope, {
        action: 'booking.created',
        resourceType: 'booking',
        resourceId: row.id,
        metadata: { locationId: dto.locationId, scheduledAt: dto.scheduledAt, partySize: dto.partySize },
      });
      return row;
    });
  }

  async update(scope: TenantScope, id: string, dto: UpdateBookingDto): Promise<Booking> {
    const existing = await this.findByIdOrThrow(scope, id);
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== existing.version) {
      throw new VersionConflictError('Booking was modified concurrently', {
        expectedVersion: dto.expectedVersion,
        actualVersion: existing.version,
      });
    }
    if (dto.diningTableId) await this.assertTableInScope(scope, dto.diningTableId, existing.locationId);
    if (dto.guestId) await this.assertGuestInScope(scope, dto.guestId);

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.booking.update({
        where: { id },
        data: {
          status: dto.status,
          diningTableId: dto.diningTableId === undefined ? undefined : dto.diningTableId,
          guestId: dto.guestId === undefined ? undefined : dto.guestId,
          partySize: dto.partySize,
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
          notes: dto.notes === undefined ? undefined : dto.notes,
          version: { increment: 1 },
        },
        include: { guest: true, diningTable: true },
      });
      await this.audit.append(tx, scope, {
        action: 'booking.updated',
        resourceType: 'booking',
        resourceId: id,
        metadata: { id, status: dto.status },
      });
      return row;
    });
  }

  private async assertTableInScope(scope: TenantScope, tableId: string, locationId: string): Promise<void> {
    const row = await this.prisma.diningTable.findFirst({
      where: this.scoped(scope, { id: tableId, locationId }),
      select: { id: true },
    });
    if (!row) throw new ValidationError('Dining table not found in this location and business', { tableId, locationId });
  }

  private async assertGuestInScope(scope: TenantScope, guestId: string): Promise<void> {
    const row = await this.prisma.guest.findFirst({
      where: this.scoped(scope, { id: guestId }),
      select: { id: true },
    });
    if (!row) throw new ValidationError('Guest not found in this business', { guestId });
  }
}
