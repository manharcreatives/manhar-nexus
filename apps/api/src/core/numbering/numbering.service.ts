import { Injectable } from '@nestjs/common';
import { type NumberingSeries } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictError } from '../../common/errors';
import { lockBusiness } from '../../common/locks';
import { TenantScopedRepository } from '../../common/tenant-scoped.repository';
import type { TenantScope } from '../../common/tenant-scope';
import { AuditService } from '../audit/audit.service';

export interface AllocatedNumber {
  key: string;
  locationId: string | null;
  value: string;
  formatted: string;
}

/**
 * Gapless number allocation (invoice/checkout/service-request numbers).
 *
 * Allocation increments under the per-business advisory lock so no two callers
 * ever receive the same number, and consumed numbers are never reused
 * (supports ADR-016: voided numbers stay consumed forever). Allocation itself
 * is high-volume and not audited; series configuration changes are.
 */
@Injectable()
export class NumberingService extends TenantScopedRepository {
  constructor(
    prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    super(prisma);
  }

  async list(scope: TenantScope): Promise<NumberingSeries[]> {
    return this.prisma.numberingSeries.findMany({
      where: this.scoped(scope),
      orderBy: [{ key: 'asc' }],
    });
  }

  /** Allocate the next number in a series, creating the series on first use. */
  async allocate(
    scope: TenantScope,
    key: string,
    opts: { locationId?: string } = {},
  ): Promise<AllocatedNumber> {
    if (opts.locationId) await this.assertLocationInScope(scope, opts.locationId);
    const locationId = opts.locationId ?? null;

    return this.prisma.$transaction(async (tx) => {
      await lockBusiness(tx, scope.businessId);

      const series =
        (await tx.numberingSeries.findFirst({
          where: { businessId: scope.businessId, locationId, key },
        })) ??
        (await tx.numberingSeries.create({
          data: { businessId: scope.businessId, locationId, key },
        }));

      const value = series.nextValue;
      await tx.numberingSeries.update({
        where: { id: series.id },
        data: { nextValue: value + 1n },
      });

      return {
        key,
        locationId,
        value: value.toString(),
        formatted: format(series.prefix, series.padding, value),
      };
    });
  }

  /** Configure a series' prefix/padding (and optional start), audited. */
  async configure(
    scope: TenantScope,
    key: string,
    cfg: { prefix?: string | null; padding?: number; startAt?: number; locationId?: string },
  ): Promise<NumberingSeries> {
    if (cfg.locationId) await this.assertLocationInScope(scope, cfg.locationId);
    const locationId = cfg.locationId ?? null;

    return this.prisma.$transaction(async (tx) => {
      await lockBusiness(tx, scope.businessId);

      const existing = await tx.numberingSeries.findFirst({
        where: { businessId: scope.businessId, locationId, key },
      });

      // A gapless counter must never rewind: reject startAt once anything has
      // been allocated, rather than silently ignoring the caller's intent.
      if (cfg.startAt !== undefined && existing && existing.nextValue !== 1n) {
        throw new ConflictError('Series already allocated; cannot change start value', {
          key,
          nextValue: existing.nextValue.toString(),
        });
      }

      const series = existing
        ? await tx.numberingSeries.update({
            where: { id: existing.id },
            data: {
              prefix: cfg.prefix === undefined ? undefined : cfg.prefix,
              padding: cfg.padding ?? undefined,
              nextValue: cfg.startAt !== undefined ? BigInt(cfg.startAt) : undefined,
              version: existing.version + 1,
            },
          })
        : await tx.numberingSeries.create({
            data: {
              businessId: scope.businessId,
              locationId,
              key,
              prefix: cfg.prefix ?? null,
              padding: cfg.padding ?? 0,
              nextValue: cfg.startAt !== undefined ? BigInt(cfg.startAt) : 1n,
            },
          });

      await this.audit.append(tx, { ...scope, locationId: cfg.locationId }, {
        action: 'numbering.configured',
        resourceType: 'numbering_series',
        resourceId: series.id,
        locationId: cfg.locationId,
        metadata: { key, prefix: series.prefix, padding: series.padding },
      });

      return series;
    });
  }
}

/** `${prefix}${zero-padded value}` — e.g. ("INV-", 5, 42n) => "INV-00042". */
function format(prefix: string | null, padding: number, value: bigint): string {
  return `${prefix ?? ''}${value.toString().padStart(padding, '0')}`;
}
