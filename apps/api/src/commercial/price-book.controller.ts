import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { zodBody } from '../common/zod-validation.pipe';
import { RequirePermission } from '../iam/principal';
import { PriceBookService } from './price-book.service';
import {
  createPriceBookSchema,
  updatePriceBookSchema,
  createPriceBookEntrySchema,
  updatePriceBookEntrySchema,
  type CreatePriceBookDto,
  type UpdatePriceBookDto,
  type CreatePriceBookEntryDto,
  type UpdatePriceBookEntryDto,
} from './commercial.dto';

@Controller('internal/commercial/price-books')
export class PriceBookController {
  constructor(private readonly priceBooks: PriceBookService) {}

  @Post()
  @RequirePermission('platform.commercial.manage')
  create(@Body(zodBody(createPriceBookSchema)) dto: CreatePriceBookDto) {
    return this.priceBooks.create(dto);
  }

  @Get()
  @RequirePermission('platform.commercial.view')
  list() {
    return this.priceBooks.list();
  }

  @Get(':id')
  @RequirePermission('platform.commercial.view')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.priceBooks.findByIdOrThrow(id);
  }

  @Patch(':id')
  @RequirePermission('platform.commercial.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updatePriceBookSchema)) dto: UpdatePriceBookDto,
  ) {
    return this.priceBooks.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('platform.commercial.manage')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.priceBooks.remove(id);
  }

  @Post(':id/entries')
  @RequirePermission('platform.commercial.manage')
  addEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(createPriceBookEntrySchema)) dto: CreatePriceBookEntryDto,
  ) {
    return this.priceBooks.addEntry(id, dto);
  }

  @Patch(':id/entries/:entryId')
  @RequirePermission('platform.commercial.manage')
  updateEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body(zodBody(updatePriceBookEntrySchema)) dto: UpdatePriceBookEntryDto,
  ) {
    return this.priceBooks.updateEntry(id, entryId, dto);
  }

  @Delete(':id/entries/:entryId')
  @RequirePermission('platform.commercial.manage')
  removeEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
  ) {
    return this.priceBooks.removeEntry(id, entryId);
  }
}
