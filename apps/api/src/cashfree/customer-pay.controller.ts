import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { zodBody } from '../common/zod-validation.pipe';
import { Public } from '../iam/principal';
import { customerPayRateLimit, customerPayRateTtlMs } from './customer-pay.config';
import { customerPaySchema, type CustomerPayAnswer, type CustomerPayDto, type CustomerPayStatus } from './customer-pay.dto';
import { CustomerPayService } from './customer-pay.service';

/**
 * The owner paying for their own registration request (behind CUSTOMER_PAY_ENABLED). Unauthenticated by design: the
 * reference code plus the registration email is the proof of ownership. POST, so the email is never in a URL.
 */
@Controller('public/payments')
@Public()
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: () => customerPayRateLimit(), ttl: () => customerPayRateTtlMs() } })
export class CustomerPayController {
  constructor(private readonly pay: CustomerPayService) {}

  /** Tells the landing page whether to show "Pay now". Reveals nothing else. */
  @Get('config')
  config(): { customerPay: boolean } {
    return { customerPay: this.pay.available() };
  }

  /** Creates (or returns) the single open payment link for this request, priced by the server. */
  @Post('pay-link')
  @HttpCode(200)
  payLink(@Body(zodBody(customerPaySchema)) dto: CustomerPayDto): Promise<CustomerPayAnswer> {
    return this.pay.pay(dto);
  }

  /** Paid or not, for the thank-you page. */
  @Post('status')
  @HttpCode(200)
  status(@Body(zodBody(customerPaySchema)) dto: CustomerPayDto): Promise<CustomerPayStatus> {
    return this.pay.status(dto);
  }
}
