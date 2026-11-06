import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PRICED_PLAN_KEYS } from '@nexus/shared';
import { z } from 'zod';
import { CurrentActor } from '../common/current-actor.decorator';
import type { ActorContext } from '../common/tenant-scope';
import { zodBody } from '../common/zod-validation.pipe';
import { Public, RequirePermission } from '../iam/principal';
import { CashfreeClient } from './cashfree.client';
import { SubscriptionService, type CheckoutAnswer } from './subscription.service';

/** Plan is optional (defaults to what the visitor chose); the price is never read from the client. */
export const createSubscriptionSchema = z
  .object({ planKey: z.enum(PRICED_PLAN_KEYS).optional(), replaceOpen: z.boolean().optional() })
  .strict();

/** Manhar staff: set up, watch and cancel the owner's UPI AutoPay mandate for one registration request. */
@Controller('internal/registrations/:id/subscriptions')
export class RegistrationSubscriptionController {
  constructor(private readonly subscriptions: SubscriptionService) {}

  @Get()
  @RequirePermission('platform.registration.view')
  list(@Param('id', ParseUUIDPipe) id: string) {
    return this.subscriptions.list(id);
  }

  @Post()
  @RequirePermission('platform.registration.manage')
  create(
    @CurrentActor() actor: ActorContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(createSubscriptionSchema)) dto: z.infer<typeof createSubscriptionSchema>,
  ) {
    return this.subscriptions.create(actor, id, dto);
  }

  @Post(':subscriptionId/refresh')
  @HttpCode(200)
  @RequirePermission('platform.registration.manage')
  refresh(@Param('id', ParseUUIDPipe) id: string, @Param('subscriptionId', ParseUUIDPipe) subscriptionId: string) {
    return this.subscriptions.refresh(id, subscriptionId);
  }

  @Post(':subscriptionId/cancel')
  @HttpCode(200)
  @RequirePermission('platform.registration.manage')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Param('subscriptionId', ParseUUIDPipe) subscriptionId: string) {
    return this.subscriptions.cancel(id, subscriptionId);
  }
}

/**
 * The owner's authorisation page (/pay/autopay/<token>) fetches its Cashfree checkout session here. Unauthenticated:
 * the 192-bit random token in the link is the proof. Throttled, and it answers 404 for anything that is not a real token.
 */
@Controller('public/subscriptions')
@Public()
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 60, ttl: 3_600_000 } })
export class PublicSubscriptionController {
  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly cashfree: CashfreeClient,
  ) {}

  @Get('checkout/:token')
  checkout(@Param('token') token: string): Promise<CheckoutAnswer> {
    return this.subscriptions.checkout(token.slice(0, 64), this.cashfree.config().environment);
  }
}
