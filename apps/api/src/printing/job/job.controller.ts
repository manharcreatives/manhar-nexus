import { Body, Controller, Get, Param, ParseEnumPipe, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { PrintJobStatus, PrintPurpose } from '@prisma/client';
import { CurrentPrincipal, RequirePermission, scopeFromPrincipal, type Principal } from '../../iam/principal';
import { RequireModule } from '../../modules/module-gating.guard';
import { zodBody } from '../../common/zod-validation.pipe';
import { JobService } from './job.service';
import {
  enqueueJobSchema,
  reprintJobSchema,
  cancelJobSchema,
  type EnqueueJobDto,
  type ReprintJobDto,
  type CancelJobDto,
} from './job.dto';

@Controller('admin/printing/jobs')
@RequireModule('printing')
export class JobController {
  constructor(private readonly jobs: JobService) {}

  @Post()
  @RequirePermission('printing.job.view')
  enqueue(@CurrentPrincipal() p: Principal, @Body(zodBody(enqueueJobSchema)) dto: EnqueueJobDto) {
    const scope = scopeFromPrincipal(p);
    const actor = { id: p.userId, label: p.displayName };
    return this.jobs.enqueue(scope, dto, actor);
  }

  @Get()
  @RequirePermission('printing.job.view')
  list(
    @CurrentPrincipal() p: Principal,
    @Query('status', new ParseEnumPipe(PrintJobStatus, { optional: true })) status?: PrintJobStatus,
    @Query('purpose', new ParseEnumPipe(PrintPurpose, { optional: true })) purpose?: PrintPurpose,
    @Query('locationId') locationId?: string,
    @Query('printerId') printerId?: string,
  ) {
    return this.jobs.listJobs(scopeFromPrincipal(p), { status, purpose, locationId, printerId });
  }

  @Get(':id')
  @RequirePermission('printing.job.view')
  findOne(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.jobs.findOrThrow(scopeFromPrincipal(p), id);
  }

  @Post(':id/reprint')
  @RequirePermission('printing.job.reprint')
  reprint(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(reprintJobSchema)) dto: ReprintJobDto,
  ) {
    const actor = { id: p.userId, label: p.displayName };
    return this.jobs.reprint(scopeFromPrincipal(p), id, dto, actor);
  }

  @Post(':id/cancel')
  @RequirePermission('printing.job.view')
  cancel(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(cancelJobSchema)) dto: CancelJobDto,
  ) {
    return this.jobs.cancelJob(scopeFromPrincipal(p), id, dto);
  }
}
