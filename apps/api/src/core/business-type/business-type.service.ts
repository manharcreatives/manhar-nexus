import { Injectable } from '@nestjs/common';
import { type BusinessType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Read access to the global BusinessType catalog (verticals Manhar offers). */
@Injectable()
export class BusinessTypeService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(): Promise<BusinessType[]> {
    return this.prisma.businessType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
