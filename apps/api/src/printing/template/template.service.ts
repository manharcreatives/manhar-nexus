import { Injectable } from '@nestjs/common';
import { Prisma, PrintPurpose, type PrintTemplate } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError } from '../../common/errors';
import { TenantScopedRepository } from '../../common/tenant-scoped.repository';
import { AuditService } from '../../core/audit/audit.service';
import type { TenantScope } from '../../common/tenant-scope';
import type { CreateTemplateDto, UpdateTemplateDto } from './template.dto';
import { DEFAULT_RECEIPT_CONFIG, DEFAULT_KOT_CONFIG } from './template.dto';

@Injectable()
export class TemplateService extends TenantScopedRepository {
  constructor(
    prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    super(prisma);
  }

  async createTemplate(scope: TenantScope, dto: CreateTemplateDto): Promise<PrintTemplate> {
    if (dto.locationId) {
      await this.assertLocationInScope(scope, dto.locationId);
    }

    return this.prisma.$transaction(async (tx) => {
      // If setting this as default, unset any existing default for this scope+purpose.
      if (dto.isDefault) {
        await tx.printTemplate.updateMany({
          where: this.scoped(scope, {
            purpose: dto.purpose,
            isDefault: true,
            locationId: dto.locationId ?? null,
          }),
          data: { isDefault: false, version: { increment: 1 } },
        });
      }

      const template = await tx.printTemplate.create({
        data: {
          businessId: scope.businessId,
          locationId: dto.locationId ?? null,
          purpose: dto.purpose,
          name: dto.name,
          config: dto.config as Prisma.InputJsonValue,
          isDefault: dto.isDefault,
        },
      });

      await this.audit.append(tx, scope, {
        action: 'print_template.created',
        resourceType: 'print_template',
        resourceId: template.id,
        locationId: dto.locationId ?? undefined,
        metadata: { name: dto.name, purpose: dto.purpose, isDefault: dto.isDefault },
      });

      return template;
    });
  }

  async listTemplates(
    scope: TenantScope,
    filter: { locationId?: string; purpose?: PrintPurpose },
  ): Promise<PrintTemplate[]> {
    return this.prisma.printTemplate.findMany({
      where: this.scoped(scope, {
        ...(filter.locationId !== undefined ? { locationId: filter.locationId } : {}),
        ...(filter.purpose ? { purpose: filter.purpose } : {}),
      }),
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOrThrow(scope: TenantScope, id: string): Promise<PrintTemplate> {
    const row = await this.prisma.printTemplate.findFirst({
      where: this.scoped(scope, { id }),
    });
    if (!row) throw new NotFoundError('Print template not found', { id });
    return this.assertOwned(row, scope);
  }

  async updateTemplate(scope: TenantScope, id: string, dto: UpdateTemplateDto): Promise<PrintTemplate> {
    const existing = await this.findOrThrow(scope, id);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.printTemplate.updateMany({
          where: this.scoped(scope, {
            purpose: existing.purpose,
            isDefault: true,
            locationId: existing.locationId,
            NOT: { id },
          }),
          data: { isDefault: false, version: { increment: 1 } },
        });
      }

      const updated = await tx.printTemplate.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.config !== undefined ? { config: dto.config as Prisma.InputJsonValue } : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
          version: { increment: 1 },
        },
      });

      await this.audit.append(tx, scope, {
        action: 'print_template.updated',
        resourceType: 'print_template',
        resourceId: id,
        locationId: existing.locationId ?? undefined,
        metadata: dto,
      });

      return updated;
    });
  }

  async deleteTemplate(scope: TenantScope, id: string): Promise<void> {
    const template = await this.findOrThrow(scope, id);

    await this.prisma.$transaction(async (tx) => {
      await tx.printTemplate.delete({ where: { id } });

      await this.audit.append(tx, scope, {
        action: 'print_template.deleted',
        resourceType: 'print_template',
        resourceId: id,
        locationId: template.locationId ?? undefined,
        metadata: { name: template.name },
      });
    });
  }

  /**
   * Finds the effective template config for a purpose at a location.
   * Location-level template takes precedence over business-level.
   * If none found, returns hardcoded defaults.
   */
  async resolveConfig(
    scope: TenantScope,
    locationId: string,
    purpose: PrintPurpose,
  ): Promise<Record<string, unknown>> {
    // Try location-scoped default first, then business-scoped default.
    const template = await this.prisma.printTemplate.findFirst({
      where: {
        businessId: scope.businessId,
        purpose,
        isDefault: true,
        locationId: { in: [locationId, null as unknown as string] },
      },
      orderBy: [
        // Prefer location-scoped (locationId IS NOT NULL) over business-scoped.
        { locationId: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    if (template) return template.config as Record<string, unknown>;
    return purpose === PrintPurpose.RECEIPT ? DEFAULT_RECEIPT_CONFIG : DEFAULT_KOT_CONFIG;
  }
}
