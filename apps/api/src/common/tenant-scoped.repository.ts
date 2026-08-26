import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenError, NotFoundError } from './errors';
import type { TenantScope } from './tenant-scope';

/**
 * Base class for tenant-scoped data access (ADR-002).
 *
 * Every read/write for a tenant-scoped table MUST go through `scoped()` so the
 * mandatory `businessId` filter can never be forgotten, and `assertOwned()`
 * provides defense-in-depth that a fetched row truly belongs to the caller's
 * business (guards against a query that accidentally omits the filter).
 *
 * The tenant root (`business`, keyed by its own id) and the global
 * `business_type` catalog are intentionally NOT scoped by this base.
 */
export abstract class TenantScopedRepository {
  constructor(protected readonly prisma: PrismaService) {}

  /** Injects the mandatory businessId into a Prisma `where` clause. */
  protected scoped<W extends object>(
    scope: TenantScope,
    where?: W,
  ): W & { businessId: string } {
    return { ...(where ?? ({} as W)), businessId: scope.businessId };
  }

  /** Fails closed if a row does not belong to the scope's business. */
  protected assertOwned<R extends { businessId: string }>(row: R, scope: TenantScope): R {
    if (row.businessId !== scope.businessId) {
      throw new ForbiddenError('Cross-tenant access denied');
    }
    return row;
  }

  /**
   * Verify a location id belongs to the scope's business before it is used to
   * scope a write/read. Rejects a location from another business with 404
   * (isolation) rather than leaking its existence. Shared by every service that
   * accepts a location override.
   */
  protected async assertLocationInScope(scope: TenantScope, locationId: string): Promise<void> {
    const location = await this.prisma.location.findFirst({
      where: this.scoped(scope, { id: locationId }),
      select: { id: true },
    });
    if (!location) throw new NotFoundError('Location not found in this business', { locationId });
  }
}
