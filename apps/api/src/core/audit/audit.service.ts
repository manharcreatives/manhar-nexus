import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, type AuditEvent } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { lockBusiness } from '../../common/locks';
import type { TenantScope } from '../../common/tenant-scope';

/** Optional filters for audit event queries. */
export interface AuditFilters {
  action?: string;
  resourceType?: string;
  resourceId?: string;
  locationId?: string;
  actorId?: string;
  from?: Date;
  to?: Date;
  skip?: number;
  take?: number;
}

/** Fields a caller supplies to record an audited action. */
export interface AuditInput {
  action: string;
  resourceType: string;
  resourceId?: string;
  locationId?: string;
  metadata?: Record<string, unknown>;
}

/** Result of walking and re-hashing a business's audit chain. */
export interface ChainVerification {
  valid: boolean;
  count: number;
  /** 1-based sequence where the chain first breaks, if invalid. */
  brokenAtSequence?: number;
  reason?: string;
}

/** Deterministic JSON: object keys sorted recursively so hashing is stable. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`);
  return `{${entries.join(',')}}`;
}

/** The exact, ordered payload that gets hashed for one audit event. */
export interface HashablePayload {
  businessId: string;
  sequence: string;
  actorType: string;
  actorId: string | null;
  actorLabel: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  locationId: string | null;
  metadata: Record<string, unknown>;
  prevHash: string | null;
  createdAt: string;
}

/** sha256 over the canonical payload, chaining in the previous hash. */
export function computeAuditHash(payload: HashablePayload): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

/**
 * Append-only, hash-chained activity history (ADR-016).
 *
 * Each event embeds the previous event's hash, so silent edits/deletes break
 * the chain and are detectable. Appends are serialized per business with a
 * transaction-scoped Postgres advisory lock, guaranteeing a gapless sequence
 * and a single well-defined predecessor even under concurrent writers.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Append an event within an existing transaction so it commits atomically
   * with the change it records. Callers MUST already be inside `$transaction`.
   */
  async append(
    tx: Prisma.TransactionClient,
    scope: TenantScope,
    input: AuditInput,
  ): Promise<AuditEvent> {
    // Serialize appends for this business; auto-released at transaction end.
    await lockBusiness(tx, scope.businessId);

    const last = await tx.auditEvent.findFirst({
      where: { businessId: scope.businessId },
      orderBy: { sequence: 'desc' },
      select: { sequence: true, hash: true },
    });

    const sequence = (last?.sequence ?? 0n) + 1n;
    const prevHash = last?.hash ?? null;
    // App-generated (millisecond precision) so the value that is hashed and the
    // value persisted round-trip identically through Timestamptz on verify.
    // Audit rows must ALWAYS be written via this path — never a DB default.
    const createdAt = new Date();
    const metadata = input.metadata ?? {};

    const hash = computeAuditHash({
      businessId: scope.businessId,
      sequence: sequence.toString(),
      actorType: scope.actor.type,
      actorId: scope.actor.id ?? null,
      actorLabel: scope.actor.label ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      locationId: input.locationId ?? scope.locationId ?? null,
      metadata,
      prevHash,
      createdAt: createdAt.toISOString(),
    });

    return tx.auditEvent.create({
      data: {
        businessId: scope.businessId,
        sequence,
        actorType: scope.actor.type,
        actorId: scope.actor.id ?? null,
        actorLabel: scope.actor.label,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        locationId: input.locationId ?? scope.locationId ?? null,
        metadata: metadata as Prisma.InputJsonValue,
        prevHash,
        hash,
        createdAt,
      },
    });
  }

  /** Open a transaction just to record one event (for callers with no own tx). */
  async record(scope: TenantScope, input: AuditInput): Promise<AuditEvent> {
    return this.prisma.$transaction((tx) => this.append(tx, scope, input));
  }

  /** Paginated activity history for a business (newest first). */
  async list(
    scope: TenantScope,
    opts: { skip?: number; take?: number } = {},
  ): Promise<AuditEvent[]> {
    return this.prisma.auditEvent.findMany({
      where: { businessId: scope.businessId },
      orderBy: { sequence: 'desc' },
      skip: opts.skip ?? 0,
      take: Math.min(opts.take ?? 50, 200),
    });
  }

  /**
   * Filtered audit event query with total count (Phase 11 — admin audit viewer).
   * Supports text match on action, resourceType, resourceId, locationId, actorId,
   * and date range. All filters are optional; businessId is always enforced.
   */
  async listFiltered(
    scope: TenantScope,
    filters: AuditFilters,
  ): Promise<{ events: AuditEvent[]; total: number }> {
    const where: Prisma.AuditEventWhereInput = {
      businessId: scope.businessId,
      ...(filters.action && { action: { contains: filters.action, mode: 'insensitive' } }),
      ...(filters.resourceType && { resourceType: { equals: filters.resourceType, mode: 'insensitive' } }),
      ...(filters.resourceId && { resourceId: filters.resourceId }),
      ...(filters.locationId && { locationId: filters.locationId }),
      ...(filters.actorId && { actorId: filters.actorId }),
      ...((filters.from ?? filters.to) && {
        createdAt: {
          ...(filters.from && { gte: filters.from }),
          ...(filters.to && { lte: filters.to }),
        },
      }),
    };

    const [events, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { sequence: 'desc' },
        skip: filters.skip ?? 0,
        take: Math.min(filters.take ?? 50, 200),
      }),
      this.prisma.auditEvent.count({ where }),
    ]);

    return { events, total };
  }

  /** Re-hash the whole chain and confirm sequence + linkage integrity. */
  async verifyChain(scope: TenantScope): Promise<ChainVerification> {
    const events = await this.prisma.auditEvent.findMany({
      where: { businessId: scope.businessId },
      orderBy: { sequence: 'asc' },
    });

    let prevHash: string | null = null;
    let expectedSequence = 1n;

    for (const e of events) {
      if (e.sequence !== expectedSequence) {
        return {
          valid: false,
          count: events.length,
          brokenAtSequence: Number(e.sequence),
          reason: `sequence gap: expected ${expectedSequence}, found ${e.sequence}`,
        };
      }
      if (e.prevHash !== prevHash) {
        return {
          valid: false,
          count: events.length,
          brokenAtSequence: Number(e.sequence),
          reason: 'prevHash does not match preceding event',
        };
      }
      const recomputed = computeAuditHash({
        businessId: e.businessId,
        sequence: e.sequence.toString(),
        actorType: e.actorType,
        actorId: e.actorId,
        actorLabel: e.actorLabel,
        action: e.action,
        resourceType: e.resourceType,
        resourceId: e.resourceId,
        locationId: e.locationId,
        metadata: (e.metadata ?? {}) as Record<string, unknown>,
        prevHash: e.prevHash,
        createdAt: e.createdAt.toISOString(),
      });
      if (recomputed !== e.hash) {
        return {
          valid: false,
          count: events.length,
          brokenAtSequence: Number(e.sequence),
          reason: 'stored hash does not match recomputed hash (tampering)',
        };
      }
      prevHash = e.hash;
      expectedSequence += 1n;
    }

    return { valid: true, count: events.length };
  }
}
