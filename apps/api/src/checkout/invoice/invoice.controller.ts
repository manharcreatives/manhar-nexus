import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentPrincipal, RequirePermission, scopeFromPrincipal, type Principal } from '../../iam/principal';
import { RequireModule } from '../../modules/module-gating.guard';
import { zodBody, zodQuery } from '../../common/zod-validation.pipe';
import { InvoiceService } from './invoice.service';
import {
  createInvoiceSchema,
  listInvoicesSchema,
  finaliseInvoiceSchema,
  voidInvoiceSchema,
  type CreateInvoiceDto,
  type ListInvoicesQuery,
  type FinaliseInvoiceDto,
  type VoidInvoiceDto,
} from './invoice.dto';

@Controller('admin/checkout')
@RequireModule('checkout')
export class InvoiceController {
  constructor(private readonly invoices: InvoiceService) {}

  @Post('sessions/:sessionId/invoice')
  @RequirePermission('checkout.invoice.create')
  getOrCreate(
    @CurrentPrincipal() p: Principal,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body(zodBody(createInvoiceSchema)) dto: CreateInvoiceDto,
  ) {
    return this.invoices.getOrCreateDraftInvoice(scopeFromPrincipal(p), sessionId, dto);
  }

  @Get('sessions/:sessionId/invoice')
  @RequirePermission('checkout.invoice.view')
  findBySession(
    @CurrentPrincipal() p: Principal,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.invoices.findSessionInvoice(scopeFromPrincipal(p), sessionId);
  }

  @Get('invoices')
  @RequirePermission('checkout.invoice.view')
  list(
    @CurrentPrincipal() p: Principal,
    @Query(zodQuery(listInvoicesSchema)) q: ListInvoicesQuery,
  ) {
    return this.invoices.listInvoices(scopeFromPrincipal(p), p, q);
  }

  @Get('invoices/:id')
  @RequirePermission('checkout.invoice.view')
  findOne(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoices.findInvoiceOrThrow(scopeFromPrincipal(p), id);
  }

  @Post('invoices/:id/finalise')
  @RequirePermission('checkout.invoice.create')
  finalise(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(finaliseInvoiceSchema)) dto: FinaliseInvoiceDto,
  ) {
    return this.invoices.finaliseInvoice(scopeFromPrincipal(p), id, dto);
  }

  @Post('invoices/:id/void')
  @RequirePermission('checkout.invoice.create')
  void_(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(voidInvoiceSchema)) dto: VoidInvoiceDto,
  ) {
    return this.invoices.voidInvoice(scopeFromPrincipal(p), id, dto);
  }
}

/**
 * Live bill preview for the Tables panel. Deliberately gated by the restaurant
 * session permission (not checkout) so waiters and hosts can show guests the
 * running total before the cashier opens a bill.
 */
@Controller('admin/sessions')
@RequireModule('restaurant')
export class SessionBillController {
  constructor(private readonly invoices: InvoiceService) {}

  @Get(':sessionId/bill-preview')
  @RequirePermission('restaurant.session.view')
  preview(
    @CurrentPrincipal() p: Principal,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.invoices.previewSessionBill(scopeFromPrincipal(p), sessionId);
  }
}
