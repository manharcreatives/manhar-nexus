import { Body, Controller, Delete, Get, Param, ParseEnumPipe, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { PrintPurpose } from '@prisma/client';
import { CurrentPrincipal, RequirePermission, scopeFromPrincipal, type Principal } from '../../iam/principal';
import { RequireModule } from '../../modules/module-gating.guard';
import { zodBody } from '../../common/zod-validation.pipe';
import { TemplateService } from './template.service';
import {
  createTemplateSchema,
  updateTemplateSchema,
  type CreateTemplateDto,
  type UpdateTemplateDto,
} from './template.dto';

@Controller('admin/printing/templates')
@RequireModule('printing')
export class TemplateController {
  constructor(private readonly templates: TemplateService) {}

  @Post()
  @RequirePermission('printing.printer.manage')
  create(@CurrentPrincipal() p: Principal, @Body(zodBody(createTemplateSchema)) dto: CreateTemplateDto) {
    return this.templates.createTemplate(scopeFromPrincipal(p), dto);
  }

  @Get()
  @RequirePermission('printing.printer.view')
  list(
    @CurrentPrincipal() p: Principal,
    @Query('locationId') locationId?: string,
    @Query('purpose', new ParseEnumPipe(PrintPurpose, { optional: true })) purpose?: PrintPurpose,
  ) {
    return this.templates.listTemplates(scopeFromPrincipal(p), { locationId, purpose });
  }

  @Get(':id')
  @RequirePermission('printing.printer.view')
  findOne(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.templates.findOrThrow(scopeFromPrincipal(p), id);
  }

  @Patch(':id')
  @RequirePermission('printing.printer.manage')
  update(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updateTemplateSchema)) dto: UpdateTemplateDto,
  ) {
    return this.templates.updateTemplate(scopeFromPrincipal(p), id, dto);
  }

  @Delete(':id')
  @RequirePermission('printing.printer.manage')
  remove(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.templates.deleteTemplate(scopeFromPrincipal(p), id);
  }
}
