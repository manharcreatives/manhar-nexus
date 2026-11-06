import { Body, Controller, HttpCode, Ip, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentActor } from '../common/current-actor.decorator';
import type { ActorContext } from '../common/tenant-scope';
import { zodBody } from '../common/zod-validation.pipe';
import { Public, RequirePermission } from '../iam/principal';
import {
  ClaimService,
  claimIssueSchema,
  claimRedeemSchema,
  type ClaimIssueAnswer,
  type ClaimIssueDto,
  type ClaimRedeemDto,
} from './claim.service';

/**
 * The owner of a freshly created account sets their own password with a one-time link. Unauthenticated by design, so
 * every call is rate limited and every failure looks the same. Tokens travel in POST bodies, never in a query string.
 */
@Controller('public/claim')
@Public()
@UseGuards(ThrottlerGuard)
export class ClaimPublicController {
  constructor(private readonly claims: ClaimService) {}

  /** The payer's browser asks for the link: reference code + last 4 digits of the registered mobile + the secret from "Pay now". */
  // The thank-you page polls this while the account is built (about 20 calls), and owners share Wi-Fi/NAT addresses.
  @Post('issue')
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 3_600_000 } })
  issue(@Body(zodBody(claimIssueSchema)) dto: ClaimIssueDto, @Ip() ip: string): Promise<ClaimIssueAnswer> {
    return this.claims.issueForPayer(dto, ip);
  }

  /** Choose the password. Works once. */
  @Post('redeem')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 3_600_000 } })
  redeem(@Body(zodBody(claimRedeemSchema)) dto: ClaimRedeemDto): Promise<{ email: string; businessName: string }> {
    return this.claims.redeem(dto);
  }
}

/** Platform staff: a new link to send on WhatsApp (older unused links stop working). */
@Controller('internal/registrations/:id/claim-link')
export class ClaimStaffController {
  constructor(private readonly claims: ClaimService) {}

  @Post()
  @HttpCode(200)
  @RequirePermission('platform.registration.manage')
  issue(@CurrentActor() actor: ActorContext, @Param('id', ParseUUIDPipe) id: string): Promise<{ token: string; expiresAt: Date }> {
    return this.claims.issueForStaff(actor, id);
  }
}
