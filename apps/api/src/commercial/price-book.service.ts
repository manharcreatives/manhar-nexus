import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConflictError, NotFoundError, ValidationError } from '../common/errors';
import type {
  CreatePriceBookDto,
  UpdatePriceBookDto,
  CreatePriceBookEntryDto,
  UpdatePriceBookEntryDto,
} from './commercial.dto';

@Injectable()
export class PriceBookService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePriceBookDto) {
    if (dto.isDefault) await this.clearDefault();
    return this.prisma.priceBook.create({
      data: {
        ...dto,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validTo: dto.validTo ? new Date(dto.validTo) : undefined,
      },
      include: { entries: true },
    });
  }

  list() {
    return this.prisma.priceBook.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: { entries: { include: { offering: { select: { id: true, key: true, name: true } } } } },
    });
  }

  async findByIdOrThrow(id: string) {
    const book = await this.prisma.priceBook.findUnique({
      where: { id },
      include: { entries: { include: { offering: { select: { id: true, key: true, name: true, type: true } } } } },
    });
    if (!book) throw new NotFoundError('Price book not found', { id });
    return book;
  }

  async update(id: string, dto: UpdatePriceBookDto) {
    await this.findByIdOrThrow(id);
    if (dto.isDefault) await this.clearDefault();
    return this.prisma.priceBook.update({
      where: { id },
      data: {
        ...dto,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validTo: dto.validTo ? new Date(dto.validTo) : undefined,
      },
      include: { entries: true },
    });
  }

  async remove(id: string) {
    await this.findByIdOrThrow(id);
    await this.prisma.priceBook.delete({ where: { id } });
  }

  async addEntry(priceBookId: string, dto: CreatePriceBookEntryDto) {
    await this.findByIdOrThrow(priceBookId);
    const offering = await this.prisma.offering.findUnique({ where: { id: dto.offeringId } });
    if (!offering) throw new NotFoundError('Offering not found', { id: dto.offeringId });
    const existing = await this.prisma.priceBookEntry.findUnique({
      where: { priceBookId_offeringId: { priceBookId, offeringId: dto.offeringId } },
    });
    if (existing) throw new ConflictError('Entry for this offering already exists in the price book');
    return this.prisma.priceBookEntry.create({
      data: { priceBookId, offeringId: dto.offeringId, amountMinorUnits: dto.amountMinorUnits, billingPeriodDays: dto.billingPeriodDays },
    });
  }

  async updateEntry(priceBookId: string, entryId: string, dto: UpdatePriceBookEntryDto) {
    await this.findByIdOrThrow(priceBookId);
    const entry = await this.prisma.priceBookEntry.findFirst({ where: { id: entryId, priceBookId } });
    if (!entry) throw new NotFoundError('Price book entry not found', { id: entryId });
    if (dto.amountMinorUnits === undefined && dto.billingPeriodDays === undefined)
      throw new ValidationError('No fields to update');
    return this.prisma.priceBookEntry.update({ where: { id: entryId }, data: dto });
  }

  async removeEntry(priceBookId: string, entryId: string) {
    await this.findByIdOrThrow(priceBookId);
    const entry = await this.prisma.priceBookEntry.findFirst({ where: { id: entryId, priceBookId } });
    if (!entry) throw new NotFoundError('Price book entry not found', { id: entryId });
    await this.prisma.priceBookEntry.delete({ where: { id: entryId } });
  }

  private async clearDefault() {
    await this.prisma.priceBook.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  }
}
