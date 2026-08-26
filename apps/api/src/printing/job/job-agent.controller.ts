import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Public } from '../../iam/principal';
import { AgentAuthGuard, CurrentAgent } from '../agent/agent-auth.guard';
import { zodBody } from '../../common/zod-validation.pipe';
import { JobService } from './job.service';
import {
  agentStatusFailedSchema,
  agentStatusOfflineSchema,
  type AgentStatusFailedDto,
  type AgentStatusOfflineDto,
} from './job.dto';
import type { PrintAgent } from '@prisma/client';

/**
 * Agent-facing endpoints. Authentication is via agent bearer secret (AgentAuthGuard),
 * not user JWT. All routes are @Public() to skip the JwtAuthGuard global guard.
 */
@Controller('agent/print')
@Public()
@UseGuards(AgentAuthGuard)
export class JobAgentController {
  constructor(private readonly jobs: JobService) {}

  @Post('heartbeat')
  heartbeat(@CurrentAgent() agent: PrintAgent) {
    return this.jobs.agentHeartbeat(agent);
  }

  @Get('jobs')
  claimJobs(@CurrentAgent() agent: PrintAgent) {
    return this.jobs.agentClaimJobs(agent);
  }

  @Post('jobs/:id/printed')
  markPrinted(@CurrentAgent() agent: PrintAgent, @Param('id', ParseUUIDPipe) id: string) {
    return this.jobs.agentMarkPrinted(agent, id);
  }

  @Post('jobs/:id/failed')
  markFailed(
    @CurrentAgent() agent: PrintAgent,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(agentStatusFailedSchema)) dto: AgentStatusFailedDto,
  ) {
    return this.jobs.agentMarkFailed(agent, id, dto ?? {});
  }

  @Post('jobs/:id/offline')
  markOffline(
    @CurrentAgent() agent: PrintAgent,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(agentStatusOfflineSchema)) dto: AgentStatusOfflineDto,
  ) {
    return this.jobs.agentMarkOffline(agent, id, dto ?? {});
  }
}
