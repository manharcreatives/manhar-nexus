import { Controller, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { BusinessExistsGuard } from '../common/business-exists.guard';
import { CurrentActor } from '../common/current-actor.decorator';
import type { ActorContext } from '../common/tenant-scope';
import { RequirePermission } from '../iam/principal';
import { ClaimService } from './claim.service';

/**
 * Platform staff: a one-time set-password link for a user of a client business ("I forgot my password"). Unlike the
 * registration claim link this also works after the user has signed in. Revokes the user's sessions.
 */
@Controller('internal/businesses/:businessId/users/:userId/reset-link')
@UseGuards(BusinessExistsGuard)
export class BusinessUserResetController {
  constructor(private readonly claims: ClaimService) {}

  @Post()
  @HttpCode(200)
  @RequirePermission('platform.business.configure')
  issue(
    @CurrentActor() actor: ActorContext,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    return this.claims.issueResetForStaff(actor, businessId, userId);
  }
}
