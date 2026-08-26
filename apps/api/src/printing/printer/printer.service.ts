import { Injectable } from '@nestjs/common';
import { Prisma, PrintPurpose, type PrinterProfile } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError } from '../../common/errors';
import { TenantScopedRepository } from '../../common/tenant-scoped.repository';
import { AuditService } from '../../core/audit/audit.service';
import type { TenantScope } from '../../common/tenant-scope';
import type { CreatePrinterDto, UpdatePrinterDto } from './printer.dto';

@Injectable()
export class PrinterService extends TenantScopedRepository {
  constructor(
    prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    super(prisma);
  }

  async createPrinter(scope: TenantScope, dto: CreatePrinterDto): Promise<PrinterProfile> {
    await this.assertLocationInScope(scope, dto.locationId);

    if (dto.agentId) {
      await this.assertAgentInScope(scope, dto.agentId);
    }

    return this.prisma.$transaction(async (tx) => {
      const printer = await tx.printerProfile.create({
        data: {
          businessId: scope.businessId,
          locationId: dto.locationId,
          agentId: dto.agentId ?? null,
          name: dto.name,
          purpose: dto.purpose,
          connectionType: dto.connectionType,
          deviceConfig: dto.deviceConfig as Prisma.InputJsonValue,
        },
      });

      await this.audit.append(tx, scope, {
        action: 'printer_profile.created',
        resourceType: 'printer_profile',
        resourceId: printer.id,
        locationId: dto.locationId,
        metadata: { name: dto.name, purpose: dto.purpose, connectionType: dto.connectionType },
      });

      return printer;
    });
  }

  async listPrinters(
    scope: TenantScope,
    filter: { locationId?: string; purpose?: PrintPurpose },
  ): Promise<PrinterProfile[]> {
    return this.prisma.printerProfile.findMany({
      where: this.scoped(scope, {
        ...(filter.locationId ? { locationId: filter.locationId } : {}),
        ...(filter.purpose ? { purpose: filter.purpose } : {}),
      }),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOrThrow(scope: TenantScope, id: string): Promise<PrinterProfile> {
    const row = await this.prisma.printerProfile.findFirst({
      where: this.scoped(scope, { id }),
    });
    if (!row) throw new NotFoundError('Printer profile not found', { id });
    return this.assertOwned(row, scope);
  }

  async updatePrinter(scope: TenantScope, id: string, dto: UpdatePrinterDto): Promise<PrinterProfile> {
    await this.findOrThrow(scope, id);

    if (dto.agentId) {
      await this.assertAgentInScope(scope, dto.agentId);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.printerProfile.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.agentId !== undefined ? { agentId: dto.agentId } : {}),
          ...(dto.purpose !== undefined ? { purpose: dto.purpose } : {}),
          ...(dto.connectionType !== undefined ? { connectionType: dto.connectionType } : {}),
          ...(dto.deviceConfig !== undefined ? { deviceConfig: dto.deviceConfig as Prisma.InputJsonValue } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          version: { increment: 1 },
        },
      });

      await this.audit.append(tx, scope, {
        action: 'printer_profile.updated',
        resourceType: 'printer_profile',
        resourceId: id,
        locationId: updated.locationId,
        metadata: dto,
      });

      return updated;
    });
  }

  async deletePrinter(scope: TenantScope, id: string): Promise<void> {
    const printer = await this.findOrThrow(scope, id);

    await this.prisma.$transaction(async (tx) => {
      await tx.printerProfile.delete({ where: { id } });

      await this.audit.append(tx, scope, {
        action: 'printer_profile.deleted',
        resourceType: 'printer_profile',
        resourceId: id,
        locationId: printer.locationId,
        metadata: { name: printer.name },
      });
    });
  }

  /**
   * Finds the first active printer for a given purpose + location.
   * Used by job routing — returns null if no printer is configured.
   */
  async findDefaultForLocation(
    scope: TenantScope,
    locationId: string,
    purpose: PrintPurpose,
  ): Promise<PrinterProfile | null> {
    return this.prisma.printerProfile.findFirst({
      where: this.scoped(scope, { locationId, purpose, isActive: true }),
      orderBy: { createdAt: 'asc' },
    });
  }

  private async assertAgentInScope(scope: TenantScope, agentId: string): Promise<void> {
    const agent = await this.prisma.printAgent.findFirst({
      where: { id: agentId, businessId: scope.businessId },
      select: { id: true },
    });
    if (!agent) throw new NotFoundError('Print agent not found in this business', { agentId });
  }
}
