import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictError, NotFoundError } from '../common/errors';
import type { CreateOfferingDto, UpdateOfferingDto } from './commercial.dto';

@Injectable()
export class OfferingService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOfferingDto) {
    const existing = await this.prisma.offering.findUnique({ where: { key: dto.key } });
    if (existing) throw new ConflictError(`Offering key '${dto.key}' already exists`);
    return this.prisma.offering.create({ data: dto });
  }

  list() {
    return this.prisma.offering.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  async findByIdOrThrow(id: string) {
    const offering = await this.prisma.offering.findUnique({ where: { id } });
    if (!offering) throw new NotFoundError('Offering not found', { id });
    return offering;
  }

  async update(id: string, dto: UpdateOfferingDto) {
    await this.findByIdOrThrow(id);
    return this.prisma.offering.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findByIdOrThrow(id);
    const inUse = await this.prisma.priceBookEntry.findFirst({ where: { offeringId: id } });
    if (inUse) throw new ConflictError('Offering is referenced by a price book entry');
    const inBundle = await this.prisma.bundleItem.findFirst({ where: { offeringId: id } });
    if (inBundle) throw new ConflictError('Offering is referenced by a bundle');
    await this.prisma.offering.delete({ where: { id } });
  }
}
