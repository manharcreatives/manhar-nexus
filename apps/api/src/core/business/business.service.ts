import { Injectable } from '@nestjs/common';
import { Prisma, type Business } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictError, NotFoundError, ValidationError } from '../../common/errors';
import type { ActorContext } from '../../common/tenant-scope';
import { AuditService } from '../audit/audit.service';
import type { CreateBusinessDto, UpdateBusinessDto } from './business.dto';

/**
 * Business Workspace (tenant root) management — the Manhar internal-admin realm.
 *
 * Business is keyed by its own id, so it is NOT tenant-scoped by businessId;
 * however every mutation is recorded in that business's own audit chain, with
 * the new/changed record as the audited resource.
 */
@Injectable()
export class BusinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(actor: ActorContext, dto: CreateBusinessDto): Promise<Business> {
    const businessType = await this.prisma.businessType.findUnique({
      where: { key: dto.businessTypeKey },
    });
    if (!businessType || !businessType.isActive) {
      throw new ValidationError('Unknown or inactive business type', {
        businessTypeKey: dto.businessTypeKey,
      });
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const business = await tx.business.create({
          data: {
            name: dto.name,
            legalName: dto.legalName ?? null,
            businessTypeId: businessType.id,
            currencyCode: dto.currencyCode ?? 'INR',
            timezone: dto.timezone ?? 'Asia/Kolkata',
            slug: dto.slug ?? null,
            accentColor: dto.accentColor ?? null,
            logoUrl: dto.logoUrl ?? null,
            invoiceName: dto.invoiceName ?? null,
            invoiceAddress: dto.invoiceAddress ?? null,
            taxId: dto.taxId ?? null,
          },
        });
        await this.audit.append(tx, { businessId: business.id, actor }, {
          action: 'business.created',
          resourceType: 'business',
          resourceId: business.id,
          metadata: {
            name: business.name,
            businessTypeKey: dto.businessTypeKey,
            currencyCode: business.currencyCode,
            timezone: business.timezone,
          },
        });
        return business;
      });
    } catch (err) {
      throw this.mapSlugConflict(err, dto.slug);
    }
  }

  async findByIdOrThrow(id: string): Promise<Business> {
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) throw new NotFoundError('Business not found', { id });
    return business;
  }

  async list(opts: { skip?: number; take?: number } = {}): Promise<Business[]> {
    return this.prisma.business.findMany({
      orderBy: { createdAt: 'desc' },
      skip: opts.skip ?? 0,
      take: Math.min(opts.take ?? 50, 200),
    });
  }

  async update(actor: ActorContext, id: string, dto: UpdateBusinessDto): Promise<Business> {
    const existing = await this.findByIdOrThrow(id);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const business = await tx.business.update({
          where: { id },
          data: {
            name: dto.name ?? undefined,
            legalName: dto.legalName === undefined ? undefined : dto.legalName,
            status: dto.status ?? undefined,
            slug: dto.slug === undefined ? undefined : dto.slug,
            accentColor: dto.accentColor === undefined ? undefined : dto.accentColor,
            logoUrl: dto.logoUrl === undefined ? undefined : dto.logoUrl,
            invoiceName: dto.invoiceName === undefined ? undefined : dto.invoiceName,
            invoiceAddress: dto.invoiceAddress === undefined ? undefined : dto.invoiceAddress,
            taxId: dto.taxId === undefined ? undefined : dto.taxId,
          },
        });
        await this.audit.append(tx, { businessId: id, actor }, {
          action: 'business.updated',
          resourceType: 'business',
          resourceId: id,
          metadata: this.diff(existing, business),
        });
        return business;
      });
    } catch (err) {
      throw this.mapSlugConflict(err, dto.slug);
    }
  }

  /** Records only the fields that actually changed, for a compact audit trail. */
  private diff(before: Business, after: Business): Record<string, unknown> {
    const changed: Record<string, unknown> = {};
    const fields = [
      'name', 'legalName', 'status', 'slug', 'accentColor',
      'logoUrl', 'invoiceName', 'invoiceAddress', 'taxId',
    ] as const;
    for (const key of fields) {
      if (before[key] !== after[key]) {
        changed[key] = { from: before[key], to: after[key] };
      }
    }
    return changed;
  }

  private mapSlugConflict(err: unknown, slug?: string | null): unknown {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return new ConflictError('Business slug already taken', { slug });
    }
    return err;
  }
}
