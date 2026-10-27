import { Injectable } from '@nestjs/common';
import { DiningTableStatus, GuestSessionStatus, type GuestSession, BookingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictError, NotFoundError, ValidationError, VersionConflictError } from '../../common/errors';
import { TenantScopedRepository } from '../../common/tenant-scoped.repository';
import { AuditService } from '../../core/audit/audit.service';
import { RealtimeBus } from '../../realtime/realtime.bus';
import type { TenantScope } from '../../common/tenant-scope';
import type { OpenSessionDto, UpdateSessionDto, CloseSessionDto, VoidSessionDto, SeatBookingDto } from './session.dto';

@Injectable()
export class SessionService extends TenantScopedRepository {
  constructor(
    prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeBus,
  ) {
    super(prisma);
  }

  async listSessions(
    scope: TenantScope,
    filter: { locationId?: string; tableId?: string; status?: GuestSessionStatus },
  ): Promise<GuestSession[]> {
    return this.prisma.guestSession.findMany({
      where: this.scoped(scope, {
        ...(filter.locationId ? { locationId: filter.locationId } : {}),
        ...(filter.tableId ? { diningTableId: filter.tableId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      }),
      include: { serviceRequests: { orderBy: { roundNumber: 'asc' }, select: { id: true, roundNumber: true, status: true, requestNumber: true } } },
      orderBy: { openedAt: 'desc' },
    });
  }

  async findSessionOrThrow(scope: TenantScope, id: string): Promise<GuestSession> {
    const row = await this.prisma.guestSession.findFirst({
      where: this.scoped(scope, { id }),
      include: { serviceRequests: { orderBy: { roundNumber: 'asc' } } },
    });
    if (!row) throw new NotFoundError('Guest session not found', { id });
    return this.assertOwned(row, scope);
  }

  async openSession(scope: TenantScope, dto: OpenSessionDto): Promise<GuestSession> {
    await this.assertLocationInScope(scope, dto.locationId);

    // Table must exist, be in this business/location, and be AVAILABLE
    const table = await this.prisma.diningTable.findFirst({
      where: this.scoped(scope, { id: dto.diningTableId, locationId: dto.locationId }),
    });
    if (!table) throw new NotFoundError('Dining table not found in this location', { diningTableId: dto.diningTableId });
    if (!table.isActive) throw new ValidationError('Dining table is not active', { diningTableId: dto.diningTableId });
    if (table.status !== DiningTableStatus.AVAILABLE) {
      throw new ConflictError('Dining table is not available', { diningTableId: dto.diningTableId, currentStatus: table.status });
    }

    // Optional FK cross-reference validation
    if (dto.bookingId) await this.assertBookingInScope(scope, dto.bookingId, dto.locationId);
    if (dto.guestId) await this.assertGuestInScope(scope, dto.guestId);
    if (dto.assignedStaffId) await this.assertStaffInScope(scope, dto.assignedStaffId);

    return this.prisma.$transaction(async (tx) => {
      // Atomically check table still AVAILABLE and set OCCUPIED
      const updated = await tx.diningTable.updateMany({
        where: { id: dto.diningTableId, businessId: scope.businessId, status: DiningTableStatus.AVAILABLE },
        data: { status: DiningTableStatus.OCCUPIED, version: { increment: 1 } },
      });
      if (updated.count === 0) {
        throw new ConflictError('Dining table is no longer available (concurrent request)', { diningTableId: dto.diningTableId });
      }

      const session = await tx.guestSession.create({
        data: {
          businessId: scope.businessId,
          locationId: dto.locationId,
          diningTableId: dto.diningTableId,
          bookingId: dto.bookingId ?? null,
          guestId: dto.guestId ?? null,
          assignedStaffId: dto.assignedStaffId ?? null,
          partySize: dto.partySize,
          notes: dto.notes ?? null,
        },
        include: { serviceRequests: true },
      });

      // If opened from a booking, mark it SEATED
      if (dto.bookingId) {
        await tx.booking.update({
          where: { id: dto.bookingId },
          data: { status: BookingStatus.SEATED },
        });
      }

      await this.audit.append(tx, scope, {
        action: 'guest_session.opened',
        resourceType: 'guest_session',
        resourceId: session.id,
        locationId: dto.locationId,
        metadata: { diningTableId: dto.diningTableId, partySize: dto.partySize },
      });

      return session;
    });
  }

  async updateSession(scope: TenantScope, id: string, dto: UpdateSessionDto): Promise<GuestSession> {
    const existing = await this.findSessionOrThrow(scope, id);
    if (existing.status !== GuestSessionStatus.OPEN) {
      throw new ValidationError('Cannot update a session that is not OPEN', { status: existing.status });
    }
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== existing.version) {
      throw new VersionConflictError('Session was modified concurrently', {
        expectedVersion: dto.expectedVersion,
        actualVersion: existing.version,
      });
    }
    if (dto.guestId) await this.assertGuestInScope(scope, dto.guestId);
    if (dto.assignedStaffId) await this.assertStaffInScope(scope, dto.assignedStaffId);

    return this.prisma.$transaction(async (tx) => {
      const session = await tx.guestSession.update({
        where: { id },
        data: {
          partySize: dto.partySize,
          guestId: dto.guestId === undefined ? undefined : dto.guestId,
          assignedStaffId: dto.assignedStaffId === undefined ? undefined : dto.assignedStaffId,
          notes: dto.notes === undefined ? undefined : dto.notes,
          version: { increment: 1 },
        },
        include: { serviceRequests: true },
      });
      await this.audit.append(tx, scope, {
        action: 'guest_session.updated',
        resourceType: 'guest_session',
        resourceId: id,
        locationId: existing.locationId,
        metadata: { id },
      });
      return session;
    });
  }

  async closeSession(scope: TenantScope, id: string, dto: CloseSessionDto): Promise<GuestSession> {
    const existing = await this.findSessionOrThrow(scope, id);
    if (existing.status !== GuestSessionStatus.OPEN) {
      throw new ValidationError('Session is not OPEN', { status: existing.status });
    }
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== existing.version) {
      throw new VersionConflictError('Session was modified concurrently', {
        expectedVersion: dto.expectedVersion,
        actualVersion: existing.version,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const session = await tx.guestSession.update({
        where: { id },
        data: { status: GuestSessionStatus.CLOSED, closedAt: new Date(), notes: dto.notes ?? existing.notes, version: { increment: 1 } },
        include: { serviceRequests: true },
      });
      // Table → CLEANING (ready for reset)
      await tx.diningTable.update({
        where: { id: existing.diningTableId },
        data: { status: DiningTableStatus.CLEANING, version: { increment: 1 } },
      });
      await this.audit.append(tx, scope, {
        action: 'guest_session.closed',
        resourceType: 'guest_session',
        resourceId: id,
        locationId: existing.locationId,
        metadata: { diningTableId: existing.diningTableId },
      });
      return session;
    });
  }

  async voidSession(scope: TenantScope, id: string, dto: VoidSessionDto): Promise<GuestSession> {
    const existing = await this.findSessionOrThrow(scope, id);
    if (existing.status !== GuestSessionStatus.OPEN) {
      throw new ValidationError('Session is not OPEN', { status: existing.status });
    }
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== existing.version) {
      throw new VersionConflictError('Session was modified concurrently', {
        expectedVersion: dto.expectedVersion,
        actualVersion: existing.version,
      });
    }
    // Prevent void if any non-DRAFT/CANCELLED request exists (re-query to avoid stale include)
    const confirmedCount = await this.prisma.serviceRequest.count({
      where: { sessionId: id, businessId: scope.businessId, status: { notIn: ['DRAFT', 'CANCELLED'] } },
    });
    if (confirmedCount > 0) {
      throw new ConflictError('Cannot void a session with confirmed service requests', { id });
    }

    return this.prisma.$transaction(async (tx) => {
      const session = await tx.guestSession.update({
        where: { id },
        data: { status: GuestSessionStatus.VOID, closedAt: new Date(), version: { increment: 1 } },
        include: { serviceRequests: true },
      });
      // Table → AVAILABLE (void = no service happened)
      await tx.diningTable.update({
        where: { id: existing.diningTableId },
        data: { status: DiningTableStatus.AVAILABLE, version: { increment: 1 } },
      });
      await this.audit.append(tx, scope, {
        action: 'guest_session.voided',
        resourceType: 'guest_session',
        resourceId: id,
        locationId: existing.locationId,
        metadata: { reason: dto.reason, diningTableId: existing.diningTableId },
      });
      return session;
    });
  }

  async resetTable(scope: TenantScope, tableId: string): Promise<void> {
    const table = await this.prisma.diningTable.findFirst({
      where: this.scoped(scope, { id: tableId }),
    });
    if (!table) throw new NotFoundError('Dining table not found', { tableId });
    if (table.status !== DiningTableStatus.CLEANING) {
      throw new ValidationError('Table must be in CLEANING state to reset to AVAILABLE', { status: table.status });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.diningTable.update({
        where: { id: tableId },
        data: { status: DiningTableStatus.AVAILABLE, version: { increment: 1 } },
      });
      await this.audit.append(tx, scope, {
        action: 'dining_table.reset',
        resourceType: 'dining_table',
        resourceId: tableId,
        metadata: { tableId },
      });
    });
    // Not covered by the route table: the 204 response carries no locationId.
    this.realtime.emit(scope.businessId, 'tables', table.locationId);
  }

  async seatBooking(scope: TenantScope, bookingId: string, dto: SeatBookingDto): Promise<GuestSession> {
    const booking = await this.prisma.booking.findFirst({
      where: this.scoped(scope, { id: bookingId }),
    });
    if (!booking) throw new NotFoundError('Booking not found', { bookingId });
    this.assertOwned(booking, scope);
    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      throw new ValidationError('Booking must be PENDING or CONFIRMED to seat', { status: booking.status });
    }
    return this.openSession(scope, {
      locationId: booking.locationId,
      diningTableId: dto.diningTableId,
      partySize: booking.partySize,
      bookingId: booking.id,
      guestId: booking.guestId ?? undefined,
      assignedStaffId: dto.assignedStaffId,
      notes: dto.notes,
    });
  }

  // ─── Cross-reference helpers ─────────────────────────────────────────────────

  private async assertBookingInScope(scope: TenantScope, bookingId: string, locationId: string): Promise<void> {
    const row = await this.prisma.booking.findFirst({
      where: this.scoped(scope, { id: bookingId, locationId }),
      select: { id: true },
    });
    if (!row) throw new ValidationError('Booking not found in this location', { bookingId });
  }

  private async assertGuestInScope(scope: TenantScope, guestId: string): Promise<void> {
    const row = await this.prisma.guest.findFirst({
      where: this.scoped(scope, { id: guestId }),
      select: { id: true },
    });
    if (!row) throw new ValidationError('Guest not found in this business', { guestId });
  }

  private async assertStaffInScope(scope: TenantScope, staffId: string): Promise<void> {
    const row = await this.prisma.staffProfile.findFirst({
      where: this.scoped(scope, { id: staffId }),
      select: { id: true },
    });
    if (!row) throw new ValidationError('Staff profile not found in this business', { staffId });
  }
}
