import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import type { PrintAgent } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictError, NotFoundError } from '../../common/errors';
import { TenantScopedRepository } from '../../common/tenant-scoped.repository';
import { AuditService } from '../../core/audit/audit.service';
import type { TenantScope } from '../../common/tenant-scope';
import type { CreateAgentDto, UpdateAgentDto } from './agent.dto';

/** secretHash is a server-side secret and must never leave the API. */
export type AgentPublic = Omit<PrintAgent, 'secretHash'>;

/** Returned once on create/rotate — the plaintext secret is never stored. */
export interface AgentWithSecret extends AgentPublic {
  secret: string;
}

function generateSecret(): { secret: string; secretHash: string } {
  const secret = randomBytes(32).toString('hex');
  const secretHash = createHash('sha256').update(secret).digest('hex');
  return { secret, secretHash };
}

@Injectable()
export class AgentService extends TenantScopedRepository {
  constructor(
    prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    super(prisma);
  }

  async createAgent(scope: TenantScope, dto: CreateAgentDto): Promise<AgentWithSecret> {
    await this.assertLocationInScope(scope, dto.locationId);
    const { secret, secretHash } = generateSecret();

    const agent = await this.prisma.$transaction(async (tx) => {
      const created = await tx.printAgent.create({
        data: {
          businessId: scope.businessId,
          locationId: dto.locationId,
          name: dto.name,
          secretHash,
        },
      });

      await this.audit.append(tx, scope, {
        action: 'print_agent.registered',
        resourceType: 'print_agent',
        resourceId: created.id,
        locationId: dto.locationId,
        metadata: { name: dto.name },
      });

      return created;
    });

    return { ...this.redact(agent), secret };
  }

  async rotateSecret(scope: TenantScope, id: string): Promise<AgentWithSecret> {
    const agent = await this.findOrThrow(scope, id);
    const { secret, secretHash } = generateSecret();

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.printAgent.update({
        where: { id },
        data: { secretHash, version: { increment: 1 } },
      });

      await this.audit.append(tx, scope, {
        action: 'print_agent.secret_rotated',
        resourceType: 'print_agent',
        resourceId: id,
        locationId: agent.locationId,
        metadata: {},
      });

      return row;
    });

    return { ...this.redact(updated), secret };
  }

  async listAgents(scope: TenantScope, locationId?: string): Promise<AgentPublic[]> {
    const rows = await this.prisma.printAgent.findMany({
      where: this.scoped(scope, locationId ? { locationId } : {}),
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.redact(r));
  }

  async findOrThrow(scope: TenantScope, id: string): Promise<AgentPublic> {
    const row = await this.prisma.printAgent.findFirst({
      where: this.scoped(scope, { id }),
    });
    if (!row) throw new NotFoundError('Print agent not found', { id });
    return this.redact(this.assertOwned(row, scope));
  }

  async updateAgent(scope: TenantScope, id: string, dto: UpdateAgentDto): Promise<AgentPublic> {
    await this.prisma.printAgent.findFirst({ where: this.scoped(scope, { id }) }).then((row) => {
      if (!row) throw new NotFoundError('Print agent not found', { id });
      this.assertOwned(row, scope);
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.printAgent.update({
        where: { id },
        data: { ...dto, version: { increment: 1 } },
      });

      await this.audit.append(tx, scope, {
        action: 'print_agent.updated',
        resourceType: 'print_agent',
        resourceId: id,
        locationId: row.locationId,
        metadata: dto,
      });

      return row;
    });

    return this.redact(updated);
  }

  async deleteAgent(scope: TenantScope, id: string): Promise<void> {
    const row = await this.prisma.printAgent.findFirst({ where: this.scoped(scope, { id }) });
    if (!row) throw new NotFoundError('Print agent not found', { id });
    const agent = this.assertOwned(row, scope);

    const printerCount = await this.prisma.printerProfile.count({
      where: { agentId: id, businessId: scope.businessId },
    });
    if (printerCount > 0) {
      throw new ConflictError(
        'Cannot delete agent with active printer profiles — reassign or delete printers first',
        { id, printerCount },
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.printAgent.delete({ where: { id } });

      await this.audit.append(tx, scope, {
        action: 'print_agent.deleted',
        resourceType: 'print_agent',
        resourceId: id,
        locationId: agent.locationId,
        metadata: { name: agent.name },
      });
    });
  }

  /** Validates agent secret and returns the full agent row. Used internally by AgentAuthGuard only. */
  async validateSecret(secretHash: string): Promise<PrintAgent | null> {
    return this.prisma.printAgent.findFirst({
      where: { secretHash, isActive: true },
    });
  }

  /** Updates lastSeenAt — called on every agent heartbeat. */
  async heartbeat(agentId: string): Promise<void> {
    await this.prisma.printAgent.update({
      where: { id: agentId },
      data: { lastSeenAt: new Date() },
    });
  }

  /** Strip secretHash before returning to API clients. */
  private redact(agent: PrintAgent): AgentPublic {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { secretHash, ...rest } = agent;
    return rest;
  }
}
