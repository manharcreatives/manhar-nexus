import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { zodBody } from '../common/zod-validation.pipe';
import { CurrentPrincipal, RequirePermission, type Principal } from '../iam/principal';
import { ActivationService } from './activation.service';
import {
  createActivationRequestSchema,
  transitionActivationSchema,
  createChecklistSchema,
  updateChecklistItemSchema,
  activationListQuerySchema,
  type CreateActivationRequestDto,
  type TransitionActivationDto,
  type CreateChecklistDto,
  type UpdateChecklistItemDto,
} from './commercial.dto';

@Controller('internal/commercial/clients/:businessId/activation-requests')
export class ActivationController {
  constructor(private readonly activation: ActivationService) {}

  @Post()
  @RequirePermission('platform.activation.manage')
  create(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @CurrentPrincipal() principal: Principal,
    @Body(zodBody(createActivationRequestSchema)) dto: CreateActivationRequestDto,
  ) {
    return this.activation.create(businessId, dto, principal);
  }

  @Get()
  @RequirePermission('platform.activation.view')
  list(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Query(zodBody(activationListQuerySchema)) q: { skip?: number; take?: number; status?: string },
  ) {
    return this.activation.list(businessId, q);
  }

  @Get(':requestId')
  @RequirePermission('platform.activation.view')
  get(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return this.activation.findByIdOrThrow(businessId, requestId);
  }

  @Post(':requestId/transition')
  @RequirePermission('platform.activation.manage')
  transition(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentPrincipal() principal: Principal,
    @Body(zodBody(transitionActivationSchema)) dto: TransitionActivationDto,
  ) {
    return this.activation.transition(businessId, requestId, dto, principal);
  }

  @Post(':requestId/checklist')
  @RequirePermission('platform.activation.manage')
  createChecklist(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body(zodBody(createChecklistSchema)) dto: CreateChecklistDto,
  ) {
    return this.activation.createChecklist(businessId, requestId, dto);
  }

  @Get(':requestId/checklist')
  @RequirePermission('platform.activation.view')
  getChecklist(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return this.activation.getChecklist(businessId, requestId);
  }

  @Patch(':requestId/checklist/items/:itemId')
  @RequirePermission('platform.activation.manage')
  updateChecklistItem(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body(zodBody(updateChecklistItemSchema)) dto: UpdateChecklistItemDto,
  ) {
    return this.activation.updateChecklistItem(businessId, requestId, itemId, dto);
  }
}
