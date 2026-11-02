import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentActor } from '../../common/current-actor.decorator';
import { RequirePermission } from '../../iam/principal';
import { zodBody } from '../../common/zod-validation.pipe';
import { paginationQuerySchema } from '../../common/pagination';
import type { ActorContext } from '../../common/tenant-scope';
import { BusinessService } from './business.service';
import {
  createBusinessSchema,
  deleteBusinessSchema,
  updateBusinessSchema,
  type CreateBusinessDto,
  type DeleteBusinessDto,
  type UpdateBusinessDto,
} from './business.dto';

/** Manhar platform realm: Business Workspace (tenant root) management. */
@Controller('internal/businesses')
export class BusinessController {
  constructor(private readonly business: BusinessService) {}

  @Post()
  @RequirePermission('platform.business.create')
  create(
    @CurrentActor() actor: ActorContext,
    @Body(zodBody(createBusinessSchema)) dto: CreateBusinessDto,
  ) {
    return this.business.create(actor, dto);
  }

  @Get()
  @RequirePermission('platform.business.view')
  list(@Query(zodBody(paginationQuerySchema)) q: { skip?: number; take?: number }) {
    return this.business.list(q);
  }

  @Get(':id')
  @RequirePermission('platform.business.view')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.business.findByIdOrThrow(id);
  }

  @Patch(':id')
  @RequirePermission('platform.business.configure')
  update(
    @CurrentActor() actor: ActorContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(updateBusinessSchema)) dto: UpdateBusinessDto,
  ) {
    return this.business.update(actor, id, dto);
  }

  @Delete(':id')
  @RequirePermission('platform.business.delete')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(deleteBusinessSchema)) _dto: DeleteBusinessDto,
  ) {
    return this.business.remove(id);
  }
}
