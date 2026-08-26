import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentPrincipal, RequirePermission, scopeFromPrincipal, type Principal } from '../../iam/principal';
import { RequireModule } from '../../modules/module-gating.guard';
import { zodBody } from '../../common/zod-validation.pipe';
import { AgentService } from './agent.service';
import { createAgentSchema, updateAgentSchema, type CreateAgentDto, type UpdateAgentDto } from './agent.dto';

@Controller('admin/printing/agents')
@RequireModule('printing')
export class AgentController {
  constructor(private readonly agents: AgentService) {}

  @Post()
  @RequirePermission('printing.printer.manage')
  create(@CurrentPrincipal() p: Principal, @Body(zodBody(createAgentSchema)) dto: CreateAgentDto) {
    return this.agents.createAgent(scopeFromPrincipal(p), dto);
  }

  @Get()
  @RequirePermission('printing.printer.view')
  list(
    @CurrentPrincipal() p: Principal,
    @Query('locationId') locationId?: string,
  ) {
    return this.agents.listAgents(scopeFromPrincipal(p), locationId);
  }

  @Get(':id')
  @RequirePermission('printing.printer.view')
  findOne(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.agents.findOrThrow(scopeFromPrincipal(p), id);
  }

  @Patch(':id')
  @RequirePermission('printing.printer.manage')
  update(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updateAgentSchema)) dto: UpdateAgentDto,
  ) {
    return this.agents.updateAgent(scopeFromPrincipal(p), id, dto);
  }

  @Post(':id/rotate-secret')
  @RequirePermission('printing.printer.manage')
  rotateSecret(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.agents.rotateSecret(scopeFromPrincipal(p), id);
  }

  @Delete(':id')
  @RequirePermission('printing.printer.manage')
  remove(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.agents.deleteAgent(scopeFromPrincipal(p), id);
  }
}
