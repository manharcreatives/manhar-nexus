import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentPrincipal, RequirePermission, scopeFromPrincipal, type Principal } from '../../iam/principal';
import { RequireModule } from '../../modules/module-gating.guard';
import { zodBody } from '../../common/zod-validation.pipe';
import { PaymentService } from './payment.service';
import {
  initiatePaymentSchema,
  capturePaymentSchema,
  cancelPaymentSchema,
  createRefundSchema,
  type InitiatePaymentDto,
  type CapturePaymentDto,
  type CancelPaymentDto,
  type CreateRefundDto,
} from './payment.dto';

@Controller('admin/checkout')
@RequireModule('checkout')
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Get('invoices/:invoiceId/payments')
  @RequirePermission('checkout.payment.view')
  list(
    @CurrentPrincipal() p: Principal,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ) {
    return this.payments.listPayments(scopeFromPrincipal(p), invoiceId);
  }

  @Post('invoices/:invoiceId/payments')
  @RequirePermission('checkout.payment.process')
  initiate(
    @CurrentPrincipal() p: Principal,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body(zodBody(initiatePaymentSchema)) dto: InitiatePaymentDto,
  ) {
    return this.payments.initiatePayment(scopeFromPrincipal(p), invoiceId, dto);
  }

  @Get('payments/:id')
  @RequirePermission('checkout.payment.view')
  findOne(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.payments.findPaymentOrThrow(scopeFromPrincipal(p), id);
  }

  @Post('payments/:id/capture')
  @RequirePermission('checkout.payment.process')
  capture(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(capturePaymentSchema)) dto: CapturePaymentDto,
  ) {
    return this.payments.capturePayment(scopeFromPrincipal(p), id, dto);
  }

  @Post('payments/:id/cancel')
  @RequirePermission('checkout.payment.process')
  cancel(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(cancelPaymentSchema)) dto: CancelPaymentDto,
  ) {
    return this.payments.cancelPayment(scopeFromPrincipal(p), id, dto);
  }

  @Post('payments/:id/refunds')
  @RequirePermission('checkout.payment.process')
  refund(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(createRefundSchema)) dto: CreateRefundDto,
  ) {
    return this.payments.createRefund(scopeFromPrincipal(p), id, dto);
  }
}
