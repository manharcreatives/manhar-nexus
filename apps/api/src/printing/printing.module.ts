import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { AgentService } from './agent/agent.service';
import { AgentController } from './agent/agent.controller';
import { AgentAuthGuard } from './agent/agent-auth.guard';
import { PrinterService } from './printer/printer.service';
import { PrinterController } from './printer/printer.controller';
import { TemplateService } from './template/template.service';
import { TemplateController } from './template/template.controller';
import { JobService } from './job/job.service';
import { JobController } from './job/job.controller';
import { JobAgentController } from './job/job-agent.controller';

/**
 * Phase 10 — Printing & Hardware.
 * PrintAgent (local daemon authentication), PrinterProfile (physical printer
 * config), PrintTemplate (receipt/KOT layout), PrintJob (truthful state
 * machine: QUEUED→SENT→PRINTED|FAILED|OFFLINE).
 *
 * Hard rule per ADR-007: API 2xx NEVER means "printed successfully".
 * Only agent-reported PRINTED status does.
 */
@Module({
  imports: [CoreModule],
  controllers: [
    AgentController,
    PrinterController,
    TemplateController,
    JobController,
    JobAgentController,
  ],
  providers: [AgentService, AgentAuthGuard, PrinterService, TemplateService, JobService],
  exports: [JobService],
})
export class PrintingModule {}
