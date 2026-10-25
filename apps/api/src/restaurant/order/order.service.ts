import { Injectable } from '@nestjs/common';
import { Prisma, ServiceRequestStatus, ServiceLineStatus, GuestSessionStatus, type ServiceRequest } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError, ValidationError, VersionConflictError } from '../../common/errors';
import { TenantScopedRepository } from '../../common/tenant-scoped.repository';
import { AuditService } from '../../core/audit/audit.service';
import { NumberingService } from '../../core/numbering/numbering.service';
import type { TenantScope } from '../../common/tenant-scope';
import type {
  CreateDraftDto,
  AddLinesDto,
  UpdateLineDto,
  SendToKitchenDto,
  CancelRequestDto,
  CancelLineDto,
} from './order.dto';

const REQUEST_WITH_LINES = {
  lines: {
    include: { modifiers: true },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.ServiceRequestInclude;

type ServiceRequestWithLines = Prisma.ServiceRequestGetPayload<{
  include: typeof REQUEST_WITH_LINES;
}>;

@Injectable()
export class OrderService extends TenantScopedRepository {
  constructor(
    prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
  ) {
    super(prisma);
  }

  async listRequests(
    scope: TenantScope,
    filter: { sessionId?: string; status?: ServiceRequestStatus; locationId?: string },
  ): Promise<ServiceRequestWithLines[]> {
    return this.prisma.serviceRequest.findMany({
      where: this.scoped(scope, {
        ...(filter.sessionId ? { sessionId: filter.sessionId } : {}),
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.locationId ? { locationId: filter.locationId } : {}),
      }),
      include: REQUEST_WITH_LINES,
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async findRequestOrThrow(scope: TenantScope, id: string): Promise<ServiceRequestWithLines> {
    const row = await this.prisma.serviceRequest.findFirst({
      where: this.scoped(scope, { id }),
      include: REQUEST_WITH_LINES,
    });
    if (!row) throw new NotFoundError('Service request not found', { id });
    return this.assertOwned(row, scope) as ServiceRequestWithLines;
  }

  async createDraft(scope: TenantScope, dto: CreateDraftDto): Promise<ServiceRequest> {
    // Validate session exists, belongs to this business, and is OPEN
    const session = await this.prisma.guestSession.findFirst({
      where: this.scoped(scope, { id: dto.sessionId }),
      select: { id: true, locationId: true, status: true, businessId: true },
    });
    if (!session) throw new NotFoundError('Guest session not found', { sessionId: dto.sessionId });
    this.assertOwned(session, scope);
    if (session.status !== GuestSessionStatus.OPEN) {
      throw new ValidationError('Guest session is not OPEN', { sessionId: dto.sessionId, status: session.status });
    }
    if (dto.staffId) await this.assertStaffInScope(scope, dto.staffId);

    // Snapshot catalog data for all lines (validated and in-scope)
    const lineSnapshots = await this.resolveLineSnapshots(scope, dto.lines);

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Compute roundNumber inside tx to avoid race between concurrent createDraft calls
        const roundNumber = (await tx.serviceRequest.count({
          where: { sessionId: dto.sessionId, businessId: scope.businessId },
        })) + 1;

        const request = await tx.serviceRequest.create({
          data: {
            businessId: scope.businessId,
            locationId: session.locationId,
            sessionId: dto.sessionId,
            staffId: dto.staffId ?? null,
            idempotencyKey: dto.idempotencyKey,
            roundNumber,
            notes: dto.notes ?? null,
            lines: {
              create: lineSnapshots.map((snap) => ({
                businessId: scope.businessId,
                catalogItemId: snap.catalogItemId,
                variantId: snap.variantId ?? null,
                itemNameSnapshot: snap.itemNameSnapshot,
                variantNameSnapshot: snap.variantNameSnapshot ?? null,
                unitPriceMinorUnits: snap.unitPriceMinorUnits,
                taxRateSnapshot: snap.taxRateSnapshot,
                taxCategoryNameSnapshot: snap.taxCategoryNameSnapshot ?? null,
                quantity: snap.quantity,
                notes: snap.notes ?? null,
                kitchenNote: snap.kitchenNote ?? null,
                modifiers: {
                  create: snap.modifiers.map((m) => ({
                    businessId: scope.businessId,
                    modifierOptionId: m.modifierOptionId,
                    optionNameSnapshot: m.optionNameSnapshot,
                    priceAdjMinorUnits: m.priceAdjMinorUnits,
                  })),
                },
              })),
            },
          },
          include: REQUEST_WITH_LINES,
        });

        await this.audit.append(tx, scope, {
          action: 'service_request.draft_created',
          resourceType: 'service_request',
          resourceId: request.id,
          locationId: session.locationId,
          metadata: { sessionId: dto.sessionId, roundNumber, lineCount: dto.lines.length },
        });

        return request;
      });
    } catch (e) {
      // Idempotency: duplicate idempotencyKey → return the existing request
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const existing = await this.prisma.serviceRequest.findFirst({
          where: this.scoped(scope, { idempotencyKey: dto.idempotencyKey }),
          include: REQUEST_WITH_LINES,
        });
        if (existing) return existing;
      }
      throw e;
    }
  }

  async addLines(scope: TenantScope, id: string, dto: AddLinesDto): Promise<ServiceRequest> {
    const request = await this.findRequestOrThrow(scope, id);
    this.assertStatus(request, [ServiceRequestStatus.DRAFT], 'add lines to');
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== request.version) {
      throw new VersionConflictError('Service request was modified concurrently', {
        expectedVersion: dto.expectedVersion,
        actualVersion: request.version,
      });
    }

    const lineSnapshots = await this.resolveLineSnapshots(scope, dto.lines);

    return this.prisma.$transaction(async (tx) => {
      for (const snap of lineSnapshots) {
        const line = await tx.serviceRequestLine.create({
          data: {
            serviceRequestId: id,
            businessId: scope.businessId,
            catalogItemId: snap.catalogItemId,
            variantId: snap.variantId ?? null,
            itemNameSnapshot: snap.itemNameSnapshot,
            variantNameSnapshot: snap.variantNameSnapshot ?? null,
            unitPriceMinorUnits: snap.unitPriceMinorUnits,
            taxRateSnapshot: snap.taxRateSnapshot,
            taxCategoryNameSnapshot: snap.taxCategoryNameSnapshot ?? null,
            quantity: snap.quantity,
            notes: snap.notes ?? null,
            kitchenNote: snap.kitchenNote ?? null,
            modifiers: {
              create: snap.modifiers.map((m) => ({
                businessId: scope.businessId,
                modifierOptionId: m.modifierOptionId,
                optionNameSnapshot: m.optionNameSnapshot,
                priceAdjMinorUnits: m.priceAdjMinorUnits,
              })),
            },
          },
        });
        void line; // snapshot only; will be included in final fetch
      }

      const updated = await tx.serviceRequest.update({
        where: { id },
        data: { version: { increment: 1 } },
        include: REQUEST_WITH_LINES,
      });

      await this.audit.append(tx, scope, {
        action: 'service_request.lines_added',
        resourceType: 'service_request',
        resourceId: id,
        locationId: request.locationId,
        metadata: { lineCount: dto.lines.length },
      });

      return updated;
    });
  }

  async updateLine(scope: TenantScope, requestId: string, lineId: string, dto: UpdateLineDto): Promise<ServiceRequest> {
    const request = await this.findRequestOrThrow(scope, requestId);
    this.assertStatus(request, [ServiceRequestStatus.DRAFT], 'update lines on');
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== request.version) {
      throw new VersionConflictError('Service request was modified concurrently', {
        expectedVersion: dto.expectedVersion,
        actualVersion: request.version,
      });
    }

    const line = request.lines.find((l) => l.id === lineId);
    if (!line) throw new NotFoundError('Service request line not found', { lineId });
    if (line.status !== ServiceLineStatus.PENDING) {
      throw new ValidationError('Line can only be updated while PENDING', { lineId, status: line.status });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.serviceRequestLine.update({
        where: { id: lineId },
        data: {
          quantity: dto.quantity,
          notes: dto.notes === undefined ? undefined : dto.notes,
          kitchenNote: dto.kitchenNote === undefined ? undefined : dto.kitchenNote,
          version: { increment: 1 },
        },
      });

      const updated = await tx.serviceRequest.update({
        where: { id: requestId },
        data: { version: { increment: 1 } },
        include: REQUEST_WITH_LINES,
      });

      await this.audit.append(tx, scope, {
        action: 'service_request.line_updated',
        resourceType: 'service_request',
        resourceId: requestId,
        locationId: request.locationId,
        metadata: { lineId },
      });

      return updated;
    });
  }

  async removeLine(scope: TenantScope, requestId: string, lineId: string): Promise<ServiceRequest> {
    const request = await this.findRequestOrThrow(scope, requestId);
    this.assertStatus(request, [ServiceRequestStatus.DRAFT], 'remove lines from');

    const lines = request.lines;
    const line = lines.find((l) => l.id === lineId);
    if (!line) throw new NotFoundError('Service request line not found', { lineId });
    if (line.status !== ServiceLineStatus.PENDING) {
      throw new ValidationError('Only PENDING lines can be removed', { lineId, status: line.status });
    }

    const activeLines = lines.filter((l) => l.status !== ServiceLineStatus.CANCELLED && l.id !== lineId);
    if (activeLines.length === 0) {
      throw new ValidationError('Cannot remove the last active line from a service request', { requestId });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.serviceRequestLine.delete({ where: { id: lineId } });

      const updated = await tx.serviceRequest.update({
        where: { id: requestId },
        data: { version: { increment: 1 } },
        include: REQUEST_WITH_LINES,
      });

      await this.audit.append(tx, scope, {
        action: 'service_request.line_removed',
        resourceType: 'service_request',
        resourceId: requestId,
        locationId: request.locationId,
        metadata: { lineId },
      });

      return updated;
    });
  }

  async sendToKitchen(scope: TenantScope, id: string, dto: SendToKitchenDto): Promise<ServiceRequest> {
    const request = await this.findRequestOrThrow(scope, id);
    this.assertStatus(request, [ServiceRequestStatus.DRAFT], 'send');
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== request.version) {
      throw new VersionConflictError('Service request was modified concurrently', {
        expectedVersion: dto.expectedVersion,
        actualVersion: request.version,
      });
    }

    const activeLines = request.lines.filter(
      (l) => l.status !== ServiceLineStatus.CANCELLED,
    );
    if (!activeLines || activeLines.length === 0) {
      throw new ValidationError('Service request has no active lines to send', { id });
    }

    // Allocate requestNumber OUTSIDE transaction (NumberingService uses advisory lock internally)
    const allocated = await this.numbering.allocate(scope, 'service_request', { locationId: request.locationId });

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.serviceRequest.update({
        where: { id },
        data: {
          status: ServiceRequestStatus.SENT,
          requestNumber: allocated.formatted,
          sentAt: new Date(),
          notes: dto.notes !== undefined ? dto.notes : undefined,
          version: { increment: 1 },
        },
        include: REQUEST_WITH_LINES,
      });

      await this.audit.append(tx, scope, {
        action: 'service_request.sent',
        resourceType: 'service_request',
        resourceId: id,
        locationId: request.locationId,
        metadata: { requestNumber: allocated.formatted, lineCount: activeLines.length },
      });

      return updated;
    });
  }

  async acceptRequest(scope: TenantScope, id: string, lineIds?: string[]): Promise<ServiceRequest> {
    return this.transitionRequest(scope, id, ServiceRequestStatus.SENT, ServiceRequestStatus.ACCEPTED, 'accepted', lineIds);
  }

  async startPreparation(scope: TenantScope, id: string, lineIds?: string[]): Promise<ServiceRequest> {
    return this.transitionRequest(scope, id, ServiceRequestStatus.ACCEPTED, ServiceRequestStatus.PREPARING, 'preparation_started', lineIds);
  }

  async markReady(scope: TenantScope, id: string, lineIds?: string[]): Promise<ServiceRequest> {
    return this.transitionRequest(scope, id, ServiceRequestStatus.PREPARING, ServiceRequestStatus.READY, 'marked_ready', lineIds);
  }

  async markServed(scope: TenantScope, id: string, lineIds?: string[]): Promise<ServiceRequest> {
    return this.transitionRequest(scope, id, ServiceRequestStatus.READY, ServiceRequestStatus.SERVED, 'served', lineIds);
  }

  async cancelRequest(scope: TenantScope, id: string, dto: CancelRequestDto): Promise<ServiceRequest> {
    const request = await this.findRequestOrThrow(scope, id);
    const cancellable: ServiceRequestStatus[] = [
      ServiceRequestStatus.DRAFT,
      ServiceRequestStatus.SENT,
      ServiceRequestStatus.ACCEPTED,
    ];
    this.assertStatus(request, cancellable, 'cancel');
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== request.version) {
      throw new VersionConflictError('Service request was modified concurrently', {
        expectedVersion: dto.expectedVersion,
        actualVersion: request.version,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      // Cancel all non-terminal lines
      await tx.serviceRequestLine.updateMany({
        where: {
          serviceRequestId: id,
          status: { notIn: [ServiceLineStatus.SERVED, ServiceLineStatus.CANCELLED] },
        },
        data: { status: ServiceLineStatus.CANCELLED, cancelReason: dto.reason },
      });

      const updated = await tx.serviceRequest.update({
        where: { id },
        data: {
          status: ServiceRequestStatus.CANCELLED,
          cancelReason: dto.reason,
          version: { increment: 1 },
        },
        include: REQUEST_WITH_LINES,
      });

      await this.audit.append(tx, scope, {
        action: 'service_request.cancelled',
        resourceType: 'service_request',
        resourceId: id,
        locationId: request.locationId,
        metadata: { reason: dto.reason },
      });

      return updated;
    });
  }

  async cancelLine(scope: TenantScope, requestId: string, lineId: string, dto: CancelLineDto): Promise<ServiceRequest> {
    const request = await this.findRequestOrThrow(scope, requestId);
    const allowedRequestStatuses: ServiceRequestStatus[] = [
      ServiceRequestStatus.SENT,
      ServiceRequestStatus.ACCEPTED,
      ServiceRequestStatus.PREPARING,
    ];
    this.assertStatus(request, allowedRequestStatuses, 'cancel a line on');
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== request.version) {
      throw new VersionConflictError('Service request was modified concurrently', {
        expectedVersion: dto.expectedVersion,
        actualVersion: request.version,
      });
    }

    const lines = request.lines;
    const line = lines.find((l) => l.id === lineId);
    if (!line) throw new NotFoundError('Service request line not found', { lineId });

    const terminal: ServiceLineStatus[] = [ServiceLineStatus.SERVED, ServiceLineStatus.CANCELLED];
    if (terminal.includes(line.status)) {
      throw new ValidationError('Line is already in a terminal state', { lineId, status: line.status });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.serviceRequestLine.update({
        where: { id: lineId },
        data: { status: ServiceLineStatus.CANCELLED, cancelReason: dto.reason, version: { increment: 1 } },
      });

      // Re-query inside tx so concurrent cancellations don't race on stale in-memory state
      const stillActive = await tx.serviceRequestLine.count({
        where: {
          serviceRequestId: requestId,
          status: { notIn: [ServiceLineStatus.SERVED, ServiceLineStatus.CANCELLED] },
        },
      });
      let requestData: Prisma.ServiceRequestUpdateInput = { version: { increment: 1 } };
      if (stillActive === 0) {
        requestData = { ...requestData, status: ServiceRequestStatus.CANCELLED, cancelReason: dto.reason };
      }

      const updated = await tx.serviceRequest.update({
        where: { id: requestId },
        data: requestData,
        include: REQUEST_WITH_LINES,
      });

      await this.audit.append(tx, scope, {
        action: 'service_request.line_cancelled',
        resourceType: 'service_request',
        resourceId: requestId,
        locationId: request.locationId,
        metadata: { lineId, reason: dto.reason, autoRequestCancelled: stillActive === 0 },
      });

      return updated;
    });
  }

  // ─── Kitchen-facing list (SENT/ACCEPTED/PREPARING/READY) ────────────────────

  async listKitchenQueue(
    scope: TenantScope,
    filter: { locationId?: string; productionAreaId?: string; statuses?: ServiceRequestStatus[] },
  ): Promise<ServiceRequest[]> {
    const defaultStatuses: ServiceRequestStatus[] = [
      ServiceRequestStatus.SENT,
      ServiceRequestStatus.ACCEPTED,
      ServiceRequestStatus.PREPARING,
      ServiceRequestStatus.READY,
    ];
    return this.prisma.serviceRequest.findMany({
      where: this.scoped(scope, {
        ...(filter.locationId ? { locationId: filter.locationId } : {}),
        status: { in: filter.statuses ?? defaultStatuses },
        ...(filter.productionAreaId
          ? {
              lines: {
                some: {
                  catalogItem: { productionAreaId: filter.productionAreaId },
                  status: { notIn: [ServiceLineStatus.SERVED, ServiceLineStatus.CANCELLED] },
                },
              },
            }
          : {}),
      }),
      include: REQUEST_WITH_LINES,
      orderBy: [{ sentAt: 'asc' }],
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private assertStatus(request: ServiceRequest, allowed: ServiceRequestStatus[], verb: string): void {
    if (!allowed.includes(request.status)) {
      throw new ValidationError(`Cannot ${verb} a request with status ${request.status}`, {
        id: request.id,
        status: request.status,
        allowed,
      });
    }
  }

  private async transitionRequest(
    scope: TenantScope,
    id: string,
    fromStatus: ServiceRequestStatus,
    toStatus: ServiceRequestStatus,
    auditAction: string,
    lineIds?: string[],
  ): Promise<ServiceRequest> {
    const request = await this.findRequestOrThrow(scope, id);
    this.assertStatus(request, [fromStatus], `transition to ${toStatus}`);

    // Validate that all provided lineIds actually belong to this request
    if (lineIds && lineIds.length > 0) {
      const requestLineIds = new Set(request.lines.map((l) => l.id));
      const invalid = lineIds.filter((lid) => !requestLineIds.has(lid));
      if (invalid.length > 0) {
        throw new ValidationError('Line IDs do not belong to this service request', { invalid });
      }
    }

    const lineStatusMap: Record<ServiceRequestStatus, ServiceLineStatus> = {
      [ServiceRequestStatus.ACCEPTED]: ServiceLineStatus.PREPARING,
      [ServiceRequestStatus.PREPARING]: ServiceLineStatus.PREPARING,
      [ServiceRequestStatus.READY]: ServiceLineStatus.READY,
      [ServiceRequestStatus.SERVED]: ServiceLineStatus.SERVED,
      [ServiceRequestStatus.DRAFT]: ServiceLineStatus.PENDING,
      [ServiceRequestStatus.SENT]: ServiceLineStatus.PENDING,
      [ServiceRequestStatus.CLOSED]: ServiceLineStatus.SERVED,
      [ServiceRequestStatus.CANCELLED]: ServiceLineStatus.CANCELLED,
    };

    const targetLineStatus = lineStatusMap[toStatus];

    return this.prisma.$transaction(async (tx) => {
      // Transition matching lines
      await tx.serviceRequestLine.updateMany({
        where: {
          serviceRequestId: id,
          ...(lineIds ? { id: { in: lineIds } } : {}),
          status: { notIn: [ServiceLineStatus.SERVED, ServiceLineStatus.CANCELLED] },
        },
        data: { status: targetLineStatus },
      });

      // Roll up request status: if partial lineIds specified, check if all non-terminal lines match new state
      let finalStatus = toStatus;
      if (lineIds) {
        const remaining = await tx.serviceRequestLine.findMany({
          where: { serviceRequestId: id, status: { notIn: [ServiceLineStatus.CANCELLED] } },
          select: { status: true },
        });
        const allAtTarget = remaining.every((l) => l.status === targetLineStatus || l.status === ServiceLineStatus.SERVED);
        if (!allAtTarget) finalStatus = fromStatus; // partial — keep request at previous status
      }

      const timestampFields: Partial<Prisma.ServiceRequestUpdateInput> = {};
      if (toStatus === ServiceRequestStatus.ACCEPTED) timestampFields.acceptedAt = new Date();
      if (toStatus === ServiceRequestStatus.PREPARING) timestampFields.preparedAt = new Date();
      if (toStatus === ServiceRequestStatus.SERVED) timestampFields.servedAt = new Date();

      const updated = await tx.serviceRequest.update({
        where: { id },
        data: { status: finalStatus, ...timestampFields, version: { increment: 1 } },
        include: REQUEST_WITH_LINES,
      });

      await this.audit.append(tx, scope, {
        action: `service_request.${auditAction}`,
        resourceType: 'service_request',
        resourceId: id,
        locationId: request.locationId,
        metadata: {
          fromStatus,
          toStatus: finalStatus,
          ...(lineIds !== undefined ? { lineIds } : {}),
        },
      });

      return updated;
    });
  }

  private async resolveLineSnapshots(
    scope: TenantScope,
    lines: CreateDraftDto['lines'],
  ): Promise<LineSnapshot[]> {
    const snapshots: LineSnapshot[] = [];

    for (const [lineIndex, line] of lines.entries()) {
      const item = await this.prisma.catalogItem.findFirst({
        where: this.scoped(scope, { id: line.catalogItemId }),
        include: {
          taxCategory: true,
          variants: true,
          modifierGroups: { include: { modifierGroup: { include: { options: true } } } },
        },
      });
      if (!item) throw new NotFoundError('Catalog item not found', { catalogItemId: line.catalogItemId });
      this.assertOwned(item, scope);
      if (!item.isActive) throw new ValidationError('Catalog item is not active', { catalogItemId: line.catalogItemId });

      const fail = (reason: LineConfigReason, message: string, extra: Record<string, unknown> = {}): never => {
        throw new ValidationError(`${LINE_CONFIG_ERROR_PREFIX}: ${message}`, {
          reason,
          lineIndex,
          catalogItemId: item.id,
          ...extra,
        });
      };

      let unitPrice = item.basePriceMinorUnits;
      let variantName: string | undefined;

      // Variant: optional (variants are price deltas over the item base price),
      // but if one is given it must belong to THIS item and be available.
      if (line.variantId) {
        const variant = item.variants.find((v) => v.id === line.variantId && v.businessId === scope.businessId);
        if (!variant) fail('VARIANT_NOT_FOR_ITEM', 'variant does not belong to this item', { variantId: line.variantId });
        else {
          if (!variant.isAvailable) fail('VARIANT_UNAVAILABLE', 'variant is not available', { variantId: variant.id });
          unitPrice += variant.priceAdjMinorUnits;
          variantName = variant.name;
        }
      }

      // Modifiers: only options of ACTIVE groups linked to this item, each at
      // most once, and every linked group's selection bounds must hold.
      const linkedGroups = item.modifierGroups
        .map((link) => link.modifierGroup)
        .filter((g) => g.isActive && g.businessId === scope.businessId);
      const optionIds = (line.modifiers ?? []).map((m) => m.modifierOptionId);
      const seen = new Set<string>();
      for (const id of optionIds) {
        if (seen.has(id)) fail('DUPLICATE_OPTION', 'an option was selected more than once', { modifierOptionId: id });
        seen.add(id);
      }

      const modifierSnapshots: ModifierSnapshot[] = [];
      for (const id of optionIds) {
        const group = linkedGroups.find((g) => g.options.some((o) => o.id === id));
        const option = group?.options.find((o) => o.id === id);
        if (!group || !option) {
          fail('OPTION_NOT_FOR_ITEM', 'option is not offered for this item', { modifierOptionId: id });
        } else {
          if (!option.isAvailable) fail('OPTION_UNAVAILABLE', 'option is not available', { modifierOptionId: id });
          unitPrice += option.priceAdjMinorUnits;
          modifierSnapshots.push({
            modifierOptionId: option.id,
            optionNameSnapshot: option.name,
            priceAdjMinorUnits: option.priceAdjMinorUnits,
          });
        }
      }

      for (const group of linkedGroups) {
        const { min, max } = modifierGroupBounds(group);
        const picked = group.options.filter((o) => seen.has(o.id)).length;
        if (picked < min) {
          fail('GROUP_MIN', `"${group.name}" needs at least ${min} selection(s)`, { modifierGroupId: group.id, min, picked });
        }
        if (picked > max) {
          fail('GROUP_MAX', `"${group.name}" allows at most ${max} selection(s)`, { modifierGroupId: group.id, max, picked });
        }
      }

      snapshots.push({
        catalogItemId: item.id,
        variantId: line.variantId,
        itemNameSnapshot: item.name,
        variantNameSnapshot: variantName,
        unitPriceMinorUnits: unitPrice,
        taxRateSnapshot: item.taxCategory?.rate.toNumber() ?? 0,
        taxCategoryNameSnapshot: item.taxCategory?.name,
        quantity: line.quantity,
        notes: line.notes,
        kitchenNote: line.kitchenNote,
        modifiers: modifierSnapshots,
      });
    }

    return snapshots;
  }

  private async assertStaffInScope(scope: TenantScope, staffId: string): Promise<void> {
    const row = await this.prisma.staffProfile.findFirst({
      where: this.scoped(scope, { id: staffId }),
      select: { id: true },
    });
    if (!row) throw new ValidationError('Staff profile not found in this business', { staffId });
  }
}

/** Stable prefix of every order-line configuration ValidationError message (clients match on it). */
export const LINE_CONFIG_ERROR_PREFIX = 'Invalid item configuration';

/** Machine-readable `details.reason` of a line configuration ValidationError. */
export type LineConfigReason =
  | 'VARIANT_NOT_FOR_ITEM'
  | 'VARIANT_UNAVAILABLE'
  | 'OPTION_NOT_FOR_ITEM'
  | 'OPTION_UNAVAILABLE'
  | 'DUPLICATE_OPTION'
  | 'GROUP_MIN'
  | 'GROUP_MAX';

/**
 * Effective min/max picks for a modifier group — identical to the web
 * builder's `groupBounds` (apps/web/src/restaurant/cart.ts) so the server never
 * rejects a selection the UI allowed: required implies at least one, SINGLE
 * caps at one, and both are clamped to the options currently available (a
 * required group whose options are all sold out does not block the item).
 */
export function modifierGroupBounds(group: {
  selectionType: 'SINGLE' | 'MULTIPLE';
  isRequired: boolean;
  minSelections: number;
  maxSelections: number | null;
  options: { isAvailable: boolean }[];
}): { min: number; max: number } {
  const count = group.options.filter((o) => o.isAvailable).length;
  const min = Math.min(Math.max(group.minSelections, group.isRequired ? 1 : 0), count);
  const cap = group.selectionType === 'SINGLE' ? 1 : (group.maxSelections ?? count);
  const max = Math.max(min, Math.min(cap, count));
  return { min, max };
}

interface LineSnapshot {
  catalogItemId: string;
  variantId?: string;
  itemNameSnapshot: string;
  variantNameSnapshot?: string;
  unitPriceMinorUnits: number;
  taxRateSnapshot: number;
  taxCategoryNameSnapshot?: string;
  quantity: number;
  notes?: string;
  kitchenNote?: string;
  modifiers: ModifierSnapshot[];
}

interface ModifierSnapshot {
  modifierOptionId: string;
  optionNameSnapshot: string;
  priceAdjMinorUnits: number;
}
