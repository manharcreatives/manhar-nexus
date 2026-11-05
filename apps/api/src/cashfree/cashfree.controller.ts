import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Req, type RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { UnauthorizedError, ValidationError } from '../common/errors';
import { CurrentActor } from '../common/current-actor.decorator';
import type { ActorContext } from '../common/tenant-scope';
import { zodBody } from '../common/zod-validation.pipe';
import { Public, RequirePermission } from '../iam/principal';
import { logger } from '../logging/logger';
import { CashfreeClient } from './cashfree.client';
import { createPaymentLinkSchema, type CreatePaymentLinkDto } from './cashfree.dto';
import { parseLinkEvent } from './cashfree.events';
import { verifyWebhookSignature } from './cashfree.signature';
import { RegistrationPaymentService } from './registration-payment.service';

/** Manhar staff: create and see the payment links for one registration request. */
@Controller('internal/registrations/:id/payment-links')
export class RegistrationPaymentController {
  constructor(private readonly payments: RegistrationPaymentService) {}

  @Get()
  @RequirePermission('platform.registration.view')
  list(@Param('id', ParseUUIDPipe) id: string) {
    return this.payments.list(id);
  }

  @Post()
  @RequirePermission('platform.registration.manage')
  create(
    @CurrentActor() actor: ActorContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(createPaymentLinkSchema)) dto: CreatePaymentLinkDto,
  ) {
    return this.payments.createLink(actor, id, dto);
  }
}

/**
 * Cashfree calls this when a payment link changes state. Public (Cashfree has no login), so the signature over the
 * RAW body is the only thing that makes a request believable: nothing is parsed or applied before it verifies.
 */
@Controller('public/cashfree')
@Public()
export class CashfreeWebhookController {
  constructor(
    private readonly cashfree: CashfreeClient,
    private readonly payments: RegistrationPaymentService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-webhook-signature') signature: string | undefined,
    @Headers('x-webhook-timestamp') timestamp: string | undefined,
  ): Promise<{ ok: true; outcome: string }> {
    const secret = this.cashfree.config().clientSecret; // 503 if unset, so Cashfree retries later
    const rawBody = req.rawBody?.toString('utf8');
    if (!verifyWebhookSignature({ timestamp, signature, rawBody, secret })) {
      logger.child({ cashfree: { webhook: 'rejected' } }).warn('bad signature');
      throw new UnauthorizedError('Invalid webhook signature');
    }
    if (rawBody === undefined) throw new ValidationError('Empty body');

    const event = parseLinkEvent(rawBody, req.headers['content-type']);
    if (!event) return { ok: true, outcome: 'ignored' }; // another event type: acknowledged, nothing to do
    const outcome = await this.payments.applyLinkEvent(event);
    return { ok: true, outcome };
  }
}
