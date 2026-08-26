import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError, ValidationError } from './errors';

const uuid = z.string().uuid();

/**
 * For nested `/internal/businesses/:businessId/*` routes: validates the id shape
 * and 404s if the business does not exist, so scoped handlers can assume a real
 * tenant root (and never leak raw FK/query errors for a bad path param).
 */
@Injectable()
export class BusinessExistsGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const businessId = req.params.businessId;

    const parsed = uuid.safeParse(businessId);
    if (!parsed.success) {
      throw new ValidationError('Invalid business id', { businessId });
    }

    const exists = await this.prisma.business.findUnique({
      where: { id: parsed.data },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundError('Business not found', { businessId: parsed.data });
    }
    return true;
  }
}
