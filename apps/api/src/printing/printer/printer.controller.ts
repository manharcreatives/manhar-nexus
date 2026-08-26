import { Body, Controller, Delete, Get, Param, ParseEnumPipe, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { PrintPurpose } from '@prisma/client';
import { CurrentPrincipal, RequirePermission, scopeFromPrincipal, type Principal } from '../../iam/principal';
import { RequireModule } from '../../modules/module-gating.guard';
import { zodBody } from '../../common/zod-validation.pipe';
import { PrinterService } from './printer.service';
import { createPrinterSchema, updatePrinterSchema, type CreatePrinterDto, type UpdatePrinterDto } from './printer.dto';

@Controller('admin/printing/printers')
@RequireModule('printing')
export class PrinterController {
  constructor(private readonly printers: PrinterService) {}

  @Post()
  @RequirePermission('printing.printer.manage')
  create(@CurrentPrincipal() p: Principal, @Body(zodBody(createPrinterSchema)) dto: CreatePrinterDto) {
    return this.printers.createPrinter(scopeFromPrincipal(p), dto);
  }

  @Get()
  @RequirePermission('printing.printer.view')
  list(
    @CurrentPrincipal() p: Principal,
    @Query('locationId') locationId?: string,
    @Query('purpose', new ParseEnumPipe(PrintPurpose, { optional: true })) purpose?: PrintPurpose,
  ) {
    return this.printers.listPrinters(scopeFromPrincipal(p), { locationId, purpose });
  }

  @Get(':id')
  @RequirePermission('printing.printer.view')
  findOne(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.printers.findOrThrow(scopeFromPrincipal(p), id);
  }

  @Patch(':id')
  @RequirePermission('printing.printer.manage')
  update(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updatePrinterSchema)) dto: UpdatePrinterDto,
  ) {
    return this.printers.updatePrinter(scopeFromPrincipal(p), id, dto);
  }

  @Delete(':id')
  @RequirePermission('printing.printer.manage')
  remove(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.printers.deletePrinter(scopeFromPrincipal(p), id);
  }
}
