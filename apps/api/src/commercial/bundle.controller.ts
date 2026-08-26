import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { zodBody } from '../common/zod-validation.pipe';
import { RequirePermission } from '../iam/principal';
import { BundleService } from './bundle.service';
import {
  createBundleSchema,
  updateBundleSchema,
  type CreateBundleDto,
  type UpdateBundleDto,
} from './commercial.dto';

@Controller('internal/commercial/bundles')
export class BundleController {
  constructor(private readonly bundles: BundleService) {}

  @Post()
  @RequirePermission('platform.commercial.manage')
  create(@Body(zodBody(createBundleSchema)) dto: CreateBundleDto) {
    return this.bundles.create(dto);
  }

  @Get()
  @RequirePermission('platform.commercial.view')
  list() {
    return this.bundles.list();
  }

  @Get(':id')
  @RequirePermission('platform.commercial.view')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.bundles.findByIdOrThrow(id);
  }

  @Patch(':id')
  @RequirePermission('platform.commercial.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updateBundleSchema)) dto: UpdateBundleDto,
  ) {
    return this.bundles.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('platform.commercial.manage')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.bundles.remove(id);
  }

  @Post(':id/items/:offeringId')
  @RequirePermission('platform.commercial.manage')
  addItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('offeringId', ParseUUIDPipe) offeringId: string,
  ) {
    return this.bundles.addItem(id, offeringId);
  }

  @Delete(':id/items/:offeringId')
  @RequirePermission('platform.commercial.manage')
  removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('offeringId', ParseUUIDPipe) offeringId: string,
  ) {
    return this.bundles.removeItem(id, offeringId);
  }
}
