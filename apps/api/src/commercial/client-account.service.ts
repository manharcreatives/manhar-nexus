import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError } from '../common/errors';
import type {
  UpdateClientAccountDto,
  CreateClientPriceOverrideDto,
  UpdateClientPriceOverrideDto,
} from './commercial.dto';

@Injectable()
export class ClientAccountService {
  constructor(private readonly prisma: PrismaService) {}

  async list(opts: { skip?: number; take?: number; commercialStatus?: string }) {
    const where = opts.commercialStatus ? { commercialStatus: opts.commercialStatus as never } : {};
    return this.prisma.business.findMany({
      where,
      skip: opts.skip ?? 0,
      take: opts.take ?? 50,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        commercialStatus: true,
        assignedTo: true,
        createdAt: true,
        businessType: { select: { key: true, name: true } },
        _count: { select: { activationRequests: true, locations: true } },
      },
    });
  }

  async findByIdOrThrow(businessId: string) {
    const biz = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        slug: true,
        legalName: true,
        taxId: true,
        commercialStatus: true,
        accountNotes: true,
        assignedTo: true,
        createdAt: true,
        businessType: { select: { key: true, name: true } },
        locations: { select: { id: true, name: true, status: true } },
        activationRequests: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true, moduleKeys: true, createdAt: true, goLiveAt: true },
        },
      },
    });
    if (!biz) throw new NotFoundError('Client not found', { businessId });
    return biz;
  }

  async update(businessId: string, dto: UpdateClientAccountDto) {
    await this.findByIdOrThrow(businessId);
    return this.prisma.business.update({
      where: { id: businessId },
      data: dto,
      select: {
        id: true,
        name: true,
        commercialStatus: true,
        accountNotes: true,
        assignedTo: true,
        updatedAt: true,
      },
    });
  }

  async getUsage(businessId: string) {
    await this.findByIdOrThrow(businessId);
    const [moduleActivations, locationCount, userCount, sessionCount] = await Promise.all([
      this.prisma.moduleActivation.findMany({
        where: { businessId },
        select: { moduleKey: true, status: true, activatedAt: true },
      }),
      this.prisma.location.count({ where: { businessId } }),
      this.prisma.user.count({ where: { businessId } }),
      this.prisma.guestSession.count({ where: { businessId } }),
    ]);
    return { businessId, moduleActivations, locationCount, userCount, sessionCount };
  }

  async listPriceOverrides(businessId: string) {
    await this.findByIdOrThrow(businessId);
    return this.prisma.clientPriceOverride.findMany({
      where: { businessId },
      orderBy: { effectiveFrom: 'desc' },
      include: { offering: { select: { id: true, key: true, name: true, type: true } } },
    });
  }

  async createPriceOverride(businessId: string, dto: CreateClientPriceOverrideDto) {
    await this.findByIdOrThrow(businessId);
    const offering = await this.prisma.offering.findUnique({ where: { id: dto.offeringId } });
    if (!offering) throw new NotFoundError('Offering not found', { id: dto.offeringId });
    return this.prisma.clientPriceOverride.create({
      data: {
        businessId,
        offeringId: dto.offeringId,
        amountMinorUnits: dto.amountMinorUnits,
        currencyCode: dto.currencyCode,
        effectiveFrom: new Date(dto.effectiveFrom),
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
        reason: dto.reason,
      },
      include: { offering: { select: { id: true, key: true, name: true } } },
    });
  }

  async updatePriceOverride(businessId: string, overrideId: string, dto: UpdateClientPriceOverrideDto) {
    await this.findByIdOrThrow(businessId);
    const override = await this.prisma.clientPriceOverride.findFirst({
      where: { id: overrideId, businessId },
    });
    if (!override) throw new NotFoundError('Price override not found', { id: overrideId });
    return this.prisma.clientPriceOverride.update({
      where: { id: overrideId },
      data: {
        ...dto,
        effectiveTo: dto.effectiveTo !== undefined
          ? dto.effectiveTo === null ? null : new Date(dto.effectiveTo)
          : undefined,
      },
    });
  }

  async removePriceOverride(businessId: string, overrideId: string) {
    await this.findByIdOrThrow(businessId);
    const override = await this.prisma.clientPriceOverride.findFirst({
      where: { id: overrideId, businessId },
    });
    if (!override) throw new NotFoundError('Price override not found', { id: overrideId });
    await this.prisma.clientPriceOverride.delete({ where: { id: overrideId } });
  }
}
