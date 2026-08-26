import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { zodBody } from '../common/zod-validation.pipe';
import { RequirePermission } from '../iam/principal';
import { OfferingService } from './offering.service';
import {
  createOfferingSchema,
  updateOfferingSchema,
  type CreateOfferingDto,
  type UpdateOfferingDto,
} from './commercial.dto';

@Controller('internal/commercial/offerings')
export class OfferingController {
  constructor(private readonly offerings: OfferingService) {}

  @Post()
  @RequirePermission('platform.commercial.manage')
  create(@Body(zodBody(createOfferingSchema)) dto: CreateOfferingDto) {
    return this.offerings.create(dto);
  }

  @Get()
  @RequirePermission('platform.commercial.view')
  list() {
    return this.offerings.list();
  }

  @Get(':id')
  @RequirePermission('platform.commercial.view')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.offerings.findByIdOrThrow(id);
  }

  @Patch(':id')
  @RequirePermission('platform.commercial.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updateOfferingSchema)) dto: UpdateOfferingDto,
  ) {
    return this.offerings.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('platform.commercial.manage')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.offerings.remove(id);
  }
}
