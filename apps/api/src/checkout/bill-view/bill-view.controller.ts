import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { CurrentPrincipal, RequirePermission, scopeFromPrincipal, type Principal } from '../../iam/principal';
import { RequireModule } from '../../modules/module-gating.guard';
import { BillViewService } from './bill-view.service';

/**
 * Waiter-facing, customer-safe read models (Update Round 2, A7). Permissions are deliberately
 * separate from `checkout.invoice.view` / `checkout.payment.*`: a waiter can SHOW the bill and
 * the payment QR without being able to browse invoices, take cash or refund anything.
 */
@Controller('admin/checkout')
@RequireModule('checkout')
export class BillViewController {
  constructor(private readonly bills: BillViewService) {}

  @Get('sessions/:sessionId/bill-view')
  @RequirePermission('restaurant.bill.show')
  forSession(@CurrentPrincipal() p: Principal, @Param('sessionId', ParseUUIDPipe) sessionId: string) {
    return this.bills.forSession(scopeFromPrincipal(p), p, sessionId);
  }

  @Get('invoices/:invoiceId/bill-view')
  @RequirePermission('restaurant.bill.show')
  forInvoice(@CurrentPrincipal() p: Principal, @Param('invoiceId', ParseUUIDPipe) invoiceId: string) {
    return this.bills.forInvoice(scopeFromPrincipal(p), p, invoiceId);
  }

  @Get('invoices/:invoiceId/payment-qr')
  @RequirePermission('checkout.paymentqr.show')
  paymentQr(@CurrentPrincipal() p: Principal, @Param('invoiceId', ParseUUIDPipe) invoiceId: string) {
    return this.bills.paymentQr(scopeFromPrincipal(p), p, invoiceId);
  }
}
