import { Controller, Get, Query } from '@nestjs/common';
import { CurrentPrincipal, RequirePermission, scopeFromPrincipal } from '../iam/principal';
import { RequireModule } from '../modules/module-gating.guard';
import { zodBody } from '../common/zod-validation.pipe';
import type { Principal } from '../iam/principal';
import { ReportService } from './report.service';
import {
  dailyReportQuerySchema,
  dailySeriesQuerySchema,
  itemReportQuerySchema,
  type DailySeriesQuery,
  salesReportQuerySchema,
  type DailyReportQuery,
  type ItemReportQuery,
  type SalesReportQuery,
} from './report.dto';

/**
 * Phase 11 — Reports endpoints (business realm).
 * All routes require the 'reports' module ACTIVE and the appropriate permission.
 * businessId is derived from the JWT principal (never the URL).
 * locationId is validated as a UUID by the Zod query schema.
 */
@Controller('admin/reports')
@RequireModule('reports')
export class ReportController {
  constructor(private readonly reports: ReportService) {}

  /** Daily Closing Report — financial summary for one calendar day (UTC). */
  @Get('daily')
  @RequirePermission('reports.daily.view')
  dailyClosing(
    @CurrentPrincipal() principal: Principal,
    @Query(zodBody(dailyReportQuerySchema)) q: DailyReportQuery,
  ) {
    return this.reports.dailyClosingReport(scopeFromPrincipal(principal), q.date, q.locationId);
  }

  /** Sales Summary — aggregate financials over a date range. */
  @Get('sales')
  @RequirePermission('reports.sales.view')
  salesSummary(
    @CurrentPrincipal() principal: Principal,
    @Query(zodBody(salesReportQuerySchema)) q: SalesReportQuery,
  ) {
    return this.reports.salesSummaryReport(scopeFromPrincipal(principal), q.from, q.to, q.locationId);
  }

  /** Daily revenue series — one zero-filled point per UTC day, at most 92 days. */
  @Get('daily-series')
  @RequirePermission('reports.sales.view')
  dailySeries(
    @CurrentPrincipal() principal: Principal,
    @Query(zodBody(dailySeriesQuerySchema)) q: DailySeriesQuery,
  ) {
    return this.reports.dailySeriesReport(scopeFromPrincipal(principal), q.from, q.to, q.locationId);
  }

  /** Top selling items — ranked by quantity sold in the date range. */
  @Get('items')
  @RequirePermission('reports.sales.view')
  topItems(
    @CurrentPrincipal() principal: Principal,
    @Query(zodBody(itemReportQuerySchema)) q: ItemReportQuery,
  ) {
    return this.reports.itemReport(
      scopeFromPrincipal(principal),
      q.from,
      q.to,
      q.locationId,
      q.limit,
    );
  }
}
