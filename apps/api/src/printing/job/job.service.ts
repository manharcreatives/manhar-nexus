import { Injectable } from '@nestjs/common';
import {
  Prisma,
  PrintJobStatus,
  PrintJobSourceType,
  PrintPurpose,
  type PrintJob,
  type PrintAgent,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictError, NotFoundError, ValidationError } from '../../common/errors';
import { TenantScopedRepository } from '../../common/tenant-scoped.repository';
import { AuditService } from '../../core/audit/audit.service';
import { PrinterService } from '../printer/printer.service';
import { TemplateService } from '../template/template.service';
import type { TenantScope } from '../../common/tenant-scope';
import type {
  EnqueueJobDto,
  ReprintJobDto,
  CancelJobDto,
  ListJobsFilter,
  AgentStatusFailedDto,
  AgentStatusOfflineDto,
} from './job.dto';

const JOB_WITH_PRINTER = {
  printer: true,
} satisfies Prisma.PrintJobInclude;

@Injectable()
export class JobService extends TenantScopedRepository {
  constructor(
    prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly printers: PrinterService,
    private readonly templates: TemplateService,
  ) {
    super(prisma);
  }

  async enqueue(scope: TenantScope, dto: EnqueueJobDto, actor?: { id: string; label: string }): Promise<PrintJob> {
    // Idempotency: if this key already exists for the business, return it.
    const existing = await this.prisma.printJob.findFirst({
      where: this.scoped(scope, { idempotencyKey: dto.idempotencyKey }),
      include: JOB_WITH_PRINTER,
    });
    if (existing) return existing;

    // Derive locationId and build payload based on sourceType.
    const { locationId, payload } = await this.resolveSourceAndPayload(scope, dto);

    // Route to printer.
    let printerId: string | null = dto.printerId ?? null;
    if (!printerId) {
      const printer = await this.printers.findDefaultForLocation(scope, locationId, dto.purpose);
      printerId = printer?.id ?? null;
    } else {
      // Validate the caller-supplied printer belongs to this business + location.
      const printer = await this.printers.findOrThrow(scope, printerId);
      if (printer.locationId !== locationId) {
        throw new ValidationError('Printer does not serve the job location', {
          printerId,
          printerLocationId: printer.locationId,
          jobLocationId: locationId,
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const job = await tx.printJob.create({
        data: {
          businessId: scope.businessId,
          locationId,
          printerId,
          idempotencyKey: dto.idempotencyKey,
          purpose: dto.purpose,
          sourceType: dto.sourceType,
          sourceId: dto.sourceId,
          payload: payload as Prisma.InputJsonValue,
          maxRetries: dto.maxRetries,
          ...(actor ? { requestedById: actor.id, requestedByLabel: actor.label } : {}),
        },
        include: JOB_WITH_PRINTER,
      });

      await this.audit.append(tx, scope, {
        action: 'print_job.enqueued',
        resourceType: 'print_job',
        resourceId: job.id,
        locationId,
        metadata: {
          purpose: dto.purpose,
          sourceType: dto.sourceType,
          sourceId: dto.sourceId,
          printerId,
        },
      });

      return job;
    });
  }

  async listJobs(scope: TenantScope, filter: ListJobsFilter): Promise<PrintJob[]> {
    return this.prisma.printJob.findMany({
      where: this.scoped(scope, {
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.purpose ? { purpose: filter.purpose } : {}),
        ...(filter.locationId ? { locationId: filter.locationId } : {}),
        ...(filter.printerId ? { printerId: filter.printerId } : {}),
      }),
      include: JOB_WITH_PRINTER,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOrThrow(scope: TenantScope, id: string): Promise<PrintJob> {
    const row = await this.prisma.printJob.findFirst({
      where: this.scoped(scope, { id }),
      include: JOB_WITH_PRINTER,
    });
    if (!row) throw new NotFoundError('Print job not found', { id });
    return this.assertOwned(row, scope);
  }

  async reprint(scope: TenantScope, id: string, dto: ReprintJobDto, actor: { id: string; label: string }): Promise<PrintJob> {
    const original = await this.findOrThrow(scope, id);

    // Check idempotency on the reprint key.
    const existingReprint = await this.prisma.printJob.findFirst({
      where: this.scoped(scope, { idempotencyKey: dto.idempotencyKey }),
      include: JOB_WITH_PRINTER,
    });
    if (existingReprint) return existingReprint;

    // Route: use supplied printerId or default for original's location+purpose.
    let printerId: string | null = dto.printerId ?? null;
    if (!printerId) {
      const printer = await this.printers.findDefaultForLocation(scope, original.locationId, original.purpose);
      printerId = printer?.id ?? null;
    }

    return this.prisma.$transaction(async (tx) => {
      const reprint = await tx.printJob.create({
        data: {
          businessId: scope.businessId,
          locationId: original.locationId,
          printerId,
          idempotencyKey: dto.idempotencyKey,
          purpose: original.purpose,
          sourceType: original.sourceType,
          sourceId: original.sourceId,
          payload: original.payload as Prisma.InputJsonValue,
          maxRetries: original.maxRetries,
          parentJobId: id,
          requestedById: actor.id,
          requestedByLabel: actor.label,
        },
        include: JOB_WITH_PRINTER,
      });

      await this.audit.append(tx, scope, {
        action: 'print_job.reprinted',
        resourceType: 'print_job',
        resourceId: reprint.id,
        locationId: original.locationId,
        metadata: {
          originalJobId: id,
          reason: dto.reason,
          requestedBy: actor.label,
        },
      });

      return reprint;
    });
  }

  async cancelJob(scope: TenantScope, id: string, dto: CancelJobDto): Promise<PrintJob> {
    const job = await this.findOrThrow(scope, id);
    if (job.status !== PrintJobStatus.QUEUED) {
      throw new ConflictError('Only QUEUED jobs can be cancelled', { id, status: job.status });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.printJob.update({
        where: { id },
        data: {
          status: PrintJobStatus.CANCELLED,
          cancelledAt: new Date(),
          failureReason: dto.reason ?? null,
          version: { increment: 1 },
        },
        include: JOB_WITH_PRINTER,
      });

      await this.audit.append(tx, scope, {
        action: 'print_job.cancelled',
        resourceType: 'print_job',
        resourceId: id,
        locationId: job.locationId,
        metadata: { reason: dto.reason },
      });

      return updated;
    });
  }

  // ─── Agent-facing state transitions ──────────────────────────────────────────

  /**
   * Atomically claims QUEUED jobs for all printers managed by the agent.
   * Transitions them to SENT so another agent poll won't claim them again.
   */
  async agentClaimJobs(agent: PrintAgent): Promise<PrintJob[]> {
    const printerIds = await this.prisma.printerProfile
      .findMany({
        where: { agentId: agent.id, businessId: agent.businessId, isActive: true },
        select: { id: true },
      })
      .then((rows) => rows.map((r) => r.id));

    if (printerIds.length === 0) return [];

    const now = new Date();

    // Fetch all QUEUED jobs for these printers.
    const queued = await this.prisma.printJob.findMany({
      where: {
        printerId: { in: printerIds },
        businessId: agent.businessId,
        status: PrintJobStatus.QUEUED,
      },
      include: JOB_WITH_PRINTER,
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    if (queued.length === 0) return [];

    // Atomically transition each to SENT. Use individual updates so a concurrent
    // race where another agent already claimed a job results in a no-op (the
    // status check WHERE clause prevents double-claiming).
    const claimed: PrintJob[] = [];
    for (const job of queued) {
      const result = await this.prisma.printJob.updateMany({
        where: { id: job.id, status: PrintJobStatus.QUEUED },
        data: { status: PrintJobStatus.SENT, sentAt: now, version: { increment: 1 } },
      });
      if (result.count > 0) {
        claimed.push({ ...job, status: PrintJobStatus.SENT, sentAt: now });
      }
    }

    await this.agents_updateLastSeen(agent.id);
    return claimed;
  }

  async agentMarkPrinted(agent: PrintAgent, jobId: string): Promise<PrintJob> {
    const job = await this.assertAgentJobOwnership(agent, jobId);
    if (job.status !== PrintJobStatus.SENT) {
      throw new ValidationError('Only SENT jobs can be marked PRINTED', { jobId, status: job.status });
    }

    const updated = await this.prisma.printJob.update({
      where: { id: jobId },
      data: { status: PrintJobStatus.PRINTED, printedAt: new Date(), version: { increment: 1 } },
      include: JOB_WITH_PRINTER,
    });

    await this.agents_updateLastSeen(agent.id);
    return updated;
  }

  async agentMarkFailed(agent: PrintAgent, jobId: string, dto: AgentStatusFailedDto): Promise<PrintJob> {
    const job = await this.assertAgentJobOwnership(agent, jobId);
    if (job.status !== PrintJobStatus.SENT) {
      throw new ValidationError('Only SENT jobs can be marked FAILED', { jobId, status: job.status });
    }

    const newRetryCount = job.retryCount + 1;
    const hasMoreRetries = newRetryCount < job.maxRetries;

    const updated = await this.prisma.printJob.update({
      where: { id: jobId },
      data: {
        // If retries remain, reset to QUEUED so the agent picks it up again.
        status: hasMoreRetries ? PrintJobStatus.QUEUED : PrintJobStatus.FAILED,
        retryCount: newRetryCount,
        failureReason: dto.reason ?? null,
        ...(hasMoreRetries ? { sentAt: null } : { failedAt: new Date() }),
        version: { increment: 1 },
      },
      include: JOB_WITH_PRINTER,
    });

    await this.agents_updateLastSeen(agent.id);
    return updated;
  }

  async agentMarkOffline(agent: PrintAgent, jobId: string, dto: AgentStatusOfflineDto): Promise<PrintJob> {
    const job = await this.assertAgentJobOwnership(agent, jobId);
    if (job.status !== PrintJobStatus.SENT) {
      throw new ValidationError('Only SENT jobs can be marked OFFLINE', { jobId, status: job.status });
    }

    // OFFLINE = printer is unreachable; reset to QUEUED so it retries on reconnect.
    const updated = await this.prisma.printJob.update({
      where: { id: jobId },
      data: {
        status: PrintJobStatus.OFFLINE,
        failureReason: dto.reason ?? 'Printer offline',
        sentAt: null,
        version: { increment: 1 },
      },
      include: JOB_WITH_PRINTER,
    });

    await this.agents_updateLastSeen(agent.id);
    return updated;
  }

  async agentHeartbeat(agent: PrintAgent): Promise<{ agentId: string; lastSeenAt: Date }> {
    const now = new Date();
    await this.prisma.printAgent.update({
      where: { id: agent.id },
      data: { lastSeenAt: now },
    });
    return { agentId: agent.id, lastSeenAt: now };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async assertAgentJobOwnership(agent: PrintAgent, jobId: string): Promise<PrintJob> {
    const job = await this.prisma.printJob.findFirst({
      where: { id: jobId, businessId: agent.businessId },
      include: JOB_WITH_PRINTER,
    });
    if (!job) throw new NotFoundError('Print job not found', { jobId });

    // Verify the job's printer belongs to this agent (prevents cross-agent manipulation).
    if (job.printerId) {
      const printer = await this.prisma.printerProfile.findFirst({
        where: { id: job.printerId, agentId: agent.id },
        select: { id: true },
      });
      if (!printer) {
        throw new ValidationError('Job does not belong to this agent', { jobId, agentId: agent.id });
      }
    }

    return job;
  }

  private async agents_updateLastSeen(agentId: string): Promise<void> {
    await this.prisma.printAgent.update({
      where: { id: agentId },
      data: { lastSeenAt: new Date() },
    });
  }

  private async resolveSourceAndPayload(
    scope: TenantScope,
    dto: EnqueueJobDto,
  ): Promise<{ locationId: string; payload: Record<string, unknown> }> {
    if (dto.sourceType === PrintJobSourceType.MANUAL) {
      if (!dto.locationId) {
        throw new ValidationError('locationId is required when sourceType is MANUAL', {});
      }
      await this.assertLocationInScope(scope, dto.locationId);
      const payload = dto.payload ?? {};
      return { locationId: dto.locationId, payload: { ...payload, purpose: dto.purpose } };
    }

    if (dto.sourceType === PrintJobSourceType.INVOICE) {
      return this.buildReceiptPayload(scope, dto.sourceId, dto.purpose);
    }

    if (dto.sourceType === PrintJobSourceType.SERVICE_REQUEST) {
      return this.buildKotPayload(scope, dto.sourceId, dto.purpose);
    }

    throw new ValidationError('Unknown sourceType', { sourceType: dto.sourceType });
  }

  private async buildReceiptPayload(
    scope: TenantScope,
    invoiceId: string,
    purpose: PrintPurpose,
  ): Promise<{ locationId: string; payload: Record<string, unknown> }> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, businessId: scope.businessId },
      include: {
        lines: { orderBy: { itemNameSnapshot: 'asc' } },
        payments: { where: { status: 'CAPTURED' }, orderBy: { createdAt: 'desc' }, take: 1 },
        business: { select: { name: true, invoiceName: true, invoiceAddress: true, taxId: true } },
      },
    });
    if (!invoice) throw new NotFoundError('Invoice not found', { invoiceId });

    const templateConfig = await this.templates.resolveConfig(scope, invoice.locationId, purpose);
    const capturedPayment = invoice.payments[0];

    const payload: Record<string, unknown> = {
      purpose,
      template: templateConfig,
      businessName: invoice.business.invoiceName ?? invoice.business.name,
      businessAddress: invoice.business.invoiceAddress ?? null,
      taxId: invoice.business.taxId ?? null,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.finalisedAt?.toISOString() ?? invoice.createdAt.toISOString(),
      items: invoice.lines.map((l) => ({
        name: l.itemNameSnapshot,
        variantName: l.variantNameSnapshot ?? null,
        modifiers: l.modifiersSummary ?? null,
        qty: l.quantity,
        unitPriceMinorUnits: l.unitPriceMinorUnits,
        lineTotalMinorUnits: l.lineTotalMinorUnits,
      })),
      subtotalMinorUnits: invoice.subtotalMinorUnits,
      taxBreakdown: invoice.taxBreakdown,
      totalMinorUnits: invoice.grandTotalMinorUnits,
      paymentMethod: capturedPayment?.method ?? null,
      cashReceivedMinorUnits: capturedPayment?.cashReceivedMinorUnits ?? null,
      changeMinorUnits: capturedPayment?.changeMinorUnits ?? null,
    };

    return { locationId: invoice.locationId, payload };
  }

  private async buildKotPayload(
    scope: TenantScope,
    serviceRequestId: string,
    purpose: PrintPurpose,
  ): Promise<{ locationId: string; payload: Record<string, unknown> }> {
    const request = await this.prisma.serviceRequest.findFirst({
      where: { id: serviceRequestId, businessId: scope.businessId },
      include: {
        lines: {
          include: { modifiers: true },
          where: { status: { not: 'CANCELLED' } },
          orderBy: { createdAt: 'asc' },
        },
        session: { select: { diningTableId: true } },
      },
    });
    if (!request) throw new NotFoundError('Service request not found', { serviceRequestId });

    const table = request.session?.diningTableId
      ? await this.prisma.diningTable.findUnique({
          where: { id: request.session.diningTableId },
          select: { code: true },
        })
      : null;

    const templateConfig = await this.templates.resolveConfig(scope, request.locationId, purpose);

    const payload: Record<string, unknown> = {
      purpose,
      template: templateConfig,
      tableCode: table?.code ?? null,
      requestNumber: request.requestNumber ?? null,
      roundNumber: request.roundNumber,
      items: request.lines.map((l) => ({
        name: l.itemNameSnapshot,
        variantName: l.variantNameSnapshot ?? null,
        qty: l.quantity,
        kitchenNote: l.kitchenNote ?? null,
        modifiers: l.modifiers.map((m) => m.optionNameSnapshot),
      })),
    };

    return { locationId: request.locationId, payload };
  }
}
