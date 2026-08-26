import { Module } from '@nestjs/common';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';

/** Phase 11 — Reports module (business-realm read-only reporting). */
@Module({
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportsModule {}
