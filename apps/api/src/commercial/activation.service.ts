import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError, ValidationError } from '../common/errors';
import type { Principal } from '../iam/principal';
import {
  VALID_TRANSITIONS,
  type CreateActivationRequestDto,
  type TransitionActivationDto,
  type CreateChecklistDto,
  type UpdateChecklistItemDto,
} from './commercial.dto';

@Injectable()
export class ActivationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(businessId: string, dto: CreateActivationRequestDto, principal: Principal) {
    const biz = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!biz) throw new NotFoundError('Client not found', { businessId });
    if (dto.bundleId) {
      const bundle = await this.prisma.bundle.findUnique({ where: { id: dto.bundleId } });
      if (!bundle) throw new NotFoundError('Bundle not found', { id: dto.bundleId });
    }
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.activationRequest.create({
        data: {
          businessId,
          bundleId: dto.bundleId,
          moduleKeys: dto.moduleKeys,
          requestedBy: dto.requestedBy,
          notes: dto.notes,
        },
        include: { bundle: { select: { id: true, key: true, name: true } } },
      });
      await tx.activationRequestEvent.create({
        data: {
          activationRequestId: request.id,
          fromStatus: null,
          toStatus: 'REQUESTED',
          note: dto.notes,
          actorId: principal.userId,
          actorLabel: principal.displayName,
        },
      });
      return request;
    });
  }

  list(businessId: string, opts: { skip?: number; take?: number; status?: string }) {
    return this.prisma.activationRequest.findMany({
      where: {
        businessId,
        ...(opts.status ? { status: opts.status as never } : {}),
      },
      skip: opts.skip ?? 0,
      take: opts.take ?? 50,
      orderBy: { createdAt: 'desc' },
      include: {
        bundle: { select: { id: true, key: true, name: true } },
        _count: { select: { events: true } },
      },
    });
  }

  async findByIdOrThrow(businessId: string, requestId: string) {
    const req = await this.prisma.activationRequest.findFirst({
      where: { id: requestId, businessId },
      include: {
        bundle: { select: { id: true, key: true, name: true } },
        events: { orderBy: { createdAt: 'asc' } },
        checklist: { include: { items: { orderBy: { sortOrder: 'asc' } } } },
      },
    });
    if (!req) throw new NotFoundError('Activation request not found', { requestId });
    return req;
  }

  async transition(
    businessId: string,
    requestId: string,
    dto: TransitionActivationDto,
    principal: Principal,
  ) {
    const req = await this.findByIdOrThrow(businessId, requestId);
    const allowed = VALID_TRANSITIONS[req.status] ?? [];
    if (!allowed.includes(dto.toStatus)) {
      throw new ValidationError(
        `Cannot transition from ${req.status} to ${dto.toStatus}`,
        { currentStatus: req.status, requestedStatus: dto.toStatus, allowed },
      );
    }
    const now = new Date();
    const statusTimes: Record<string, Record<string, Date | null>> = {
      QUOTED: { quotedAt: now },
      APPROVED: { approvedAt: now },
      PENDING_SETUP: { setupAt: now },
      ACTIVE: { goLiveAt: now },
      REMOVED: { removedAt: now },
    };
    const timeUpdates = statusTimes[dto.toStatus] ?? {};
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.activationRequest.update({
        where: { id: requestId },
        data: {
          status: dto.toStatus,
          ...timeUpdates,
          ...(dto.quotedAmount !== undefined ? { quotedAmount: dto.quotedAmount } : {}),
          ...(dto.currencyCode !== undefined ? { currencyCode: dto.currencyCode } : {}),
        },
        include: {
          bundle: { select: { id: true, key: true, name: true } },
          events: { orderBy: { createdAt: 'asc' } },
          checklist: { include: { items: { orderBy: { sortOrder: 'asc' } } } },
        },
      });
      await tx.activationRequestEvent.create({
        data: {
          activationRequestId: requestId,
          fromStatus: req.status,
          toStatus: dto.toStatus,
          note: dto.note,
          actorId: principal.userId,
          actorLabel: principal.displayName,
        },
      });
      return updated;
    });
  }

  async createChecklist(businessId: string, requestId: string, dto: CreateChecklistDto) {
    const req = await this.findByIdOrThrow(businessId, requestId);
    if (req.checklist) throw new ValidationError('A checklist already exists for this activation request');
    return this.prisma.$transaction(async (tx) => {
      const checklist = await tx.deploymentChecklist.create({
        data: { activationRequestId: requestId, businessId },
      });
      await tx.deploymentChecklistItem.createMany({
        data: dto.items.map((item) => ({ checklistId: checklist.id, ...item })),
      });
      return tx.deploymentChecklist.findUnique({
        where: { id: checklist.id },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      });
    });
  }

  async getChecklist(businessId: string, requestId: string) {
    const req = await this.findByIdOrThrow(businessId, requestId);
    if (!req.checklist) throw new NotFoundError('No checklist for this activation request');
    return req.checklist;
  }

  async updateChecklistItem(
    businessId: string,
    requestId: string,
    itemId: string,
    dto: UpdateChecklistItemDto,
  ) {
    const req = await this.findByIdOrThrow(businessId, requestId);
    if (!req.checklist) throw new NotFoundError('No checklist for this activation request');
    const item = await this.prisma.deploymentChecklistItem.findFirst({
      where: { id: itemId, checklistId: req.checklist.id },
    });
    if (!item) throw new NotFoundError('Checklist item not found', { itemId });
    const updated = await this.prisma.deploymentChecklistItem.update({
      where: { id: itemId },
      data: { completed: dto.completed, completedAt: dto.completed ? new Date() : null },
    });
    // Mark the whole checklist done if all items are complete.
    const remaining = await this.prisma.deploymentChecklistItem.count({
      where: { checklistId: req.checklist.id, completed: false },
    });
    if (remaining === 0) {
      await this.prisma.deploymentChecklist.update({
        where: { id: req.checklist.id },
        data: { completedAt: new Date() },
      });
    } else {
      await this.prisma.deploymentChecklist.update({
        where: { id: req.checklist.id },
        data: { completedAt: null },
      });
    }
    return updated;
  }
}
