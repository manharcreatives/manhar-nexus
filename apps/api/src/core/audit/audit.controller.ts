import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { BusinessExistsGuard } from '../../common/business-exists.guard';
import { CurrentActor, scopeFor } from '../../common/current-actor.decorator';
import { RequirePermission } from '../../iam/principal';
import { paginationQuerySchema, type PaginationQuery } from '../../common/pagination';
import { zodBody } from '../../common/zod-validation.pipe';
import type { ActorContext } from '../../common/tenant-scope';
import { AuditService } from './audit.service';

@Controller('internal/businesses/:businessId/audit')
@RequirePermission('platform.audit.view')
@UseGuards(BusinessExistsGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /** Activity history (newest first). */
  @Get()
  list(
    @CurrentActor() actor: ActorContext,
    @Param('businessId') businessId: string,
    @Query(zodBody(paginationQuerySchema)) q: PaginationQuery,
  ) {
    return this.audit.list(scopeFor(actor, businessId), q);
  }

  /** Integrity check: re-hash the chain and report the first break, if any. */
  @Get('verify')
  verify(@CurrentActor() actor: ActorContext, @Param('businessId') businessId: string) {
    return this.audit.verifyChain(scopeFor(actor, businessId));
  }
}
