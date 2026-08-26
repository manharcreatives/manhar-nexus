import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictError, NotFoundError } from '../common/errors';
import type { CreateBundleDto, UpdateBundleDto } from './commercial.dto';

@Injectable()
export class BundleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBundleDto) {
    const existing = await this.prisma.bundle.findUnique({ where: { key: dto.key } });
    if (existing) throw new ConflictError(`Bundle key '${dto.key}' already exists`);
    return this.prisma.bundle.create({ data: dto, include: { items: { include: { offering: true } } } });
  }

  list() {
    return this.prisma.bundle.findMany({
      orderBy: { name: 'asc' },
      include: { items: { include: { offering: { select: { id: true, key: true, name: true, type: true } } } } },
    });
  }

  async findByIdOrThrow(id: string) {
    const bundle = await this.prisma.bundle.findUnique({
      where: { id },
      include: { items: { include: { offering: true } } },
    });
    if (!bundle) throw new NotFoundError('Bundle not found', { id });
    return bundle;
  }

  async update(id: string, dto: UpdateBundleDto) {
    await this.findByIdOrThrow(id);
    return this.prisma.bundle.update({
      where: { id },
      data: dto,
      include: { items: { include: { offering: { select: { id: true, key: true, name: true } } } } },
    });
  }

  async remove(id: string) {
    await this.findByIdOrThrow(id);
    const inUse = await this.prisma.activationRequest.findFirst({ where: { bundleId: id } });
    if (inUse) throw new ConflictError('Bundle is referenced by an activation request');
    await this.prisma.bundle.delete({ where: { id } });
  }

  async addItem(bundleId: string, offeringId: string) {
    await this.findByIdOrThrow(bundleId);
    const offering = await this.prisma.offering.findUnique({ where: { id: offeringId } });
    if (!offering) throw new NotFoundError('Offering not found', { id: offeringId });
    const exists = await this.prisma.bundleItem.findUnique({
      where: { bundleId_offeringId: { bundleId, offeringId } },
    });
    if (exists) throw new ConflictError('Offering already in bundle');
    await this.prisma.bundleItem.create({ data: { bundleId, offeringId } });
    return this.findByIdOrThrow(bundleId);
  }

  async removeItem(bundleId: string, offeringId: string) {
    await this.findByIdOrThrow(bundleId);
    const item = await this.prisma.bundleItem.findUnique({
      where: { bundleId_offeringId: { bundleId, offeringId } },
    });
    if (!item) throw new NotFoundError('Offering not in bundle', { bundleId, offeringId });
    await this.prisma.bundleItem.delete({ where: { bundleId_offeringId: { bundleId, offeringId } } });
    return this.findByIdOrThrow(bundleId);
  }
}
