import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentPrincipal, RequirePermission, scopeFromPrincipal } from '../../iam/principal';
import type { Principal } from '../../iam/principal';
import { zodBody } from '../../common/zod-validation.pipe';
import { AuditService } from './audit.service';

const auditFilterSchema = z
  .object({
    action: z.string().max(200).optional(),
    resourceType: z.string().max(100).optional(),
    resourceId: z.string().uuid().optional(),
    locationId: z.string().uuid().optional(),
    actorId: z.string().uuid().optional(),
    from: z
      .string()
      .optional()
      .transform((v) => (v ? new Date(v) : undefined))
      .pipe(z.date().optional()),
    to: z
      .string()
      .optional()
      .transform((v) => (v ? new Date(v) : undefined))
      .pipe(z.date().optional()),
    skip: z.coerce.number().int().min(0).optional(),
    take: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

type AuditFilterQuery = z.infer<typeof auditFilterSchema>;

/**
 * Phase 11 — Business-realm audit viewer.
 * Exposes the hash-chained activity history to business-realm users with
 * the `core.audit.view` permission. Tenant isolation is strict: only the
 * authenticated principal's own businessId is queryable.
 *
 * Sensitive data (passwords, tokens, secrets) must never appear in audit
 * metadata — this is enforced at write time in AuditService.append().
 */
@Controller('admin/audit')
export class AdminAuditController {
  constructor(private readonly audit: AuditService) {}

  /**
   * Paginated, filtered activity history for the authenticated business.
   * Returns events plus a total count for pagination.
   */
  @Get()
  @RequirePermission('core.audit.view')
  list(
    @CurrentPrincipal() principal: Principal,
    @Query(zodBody(auditFilterSchema)) q: AuditFilterQuery,
  ) {
    const scope = scopeFromPrincipal(principal);
    return this.audit.listFiltered(scope, q);
  }

  /**
   * Chain integrity verification for the authenticated business.
   * Returns { valid, count, brokenAtSequence?, reason? }.
   */
  @Get('verify')
  @RequirePermission('core.audit.view')
  verify(@CurrentPrincipal() principal: Principal) {
    const scope = scopeFromPrincipal(principal);
    return this.audit.verifyChain(scope);
  }
}
