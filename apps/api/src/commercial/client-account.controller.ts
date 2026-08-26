import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { zodBody } from '../common/zod-validation.pipe';
import { RequirePermission } from '../iam/principal';
import { ClientAccountService } from './client-account.service';
import {
  updateClientAccountSchema,
  createClientPriceOverrideSchema,
  updateClientPriceOverrideSchema,
  clientListQuerySchema,
  type UpdateClientAccountDto,
  type CreateClientPriceOverrideDto,
  type UpdateClientPriceOverrideDto,
} from './commercial.dto';

@Controller('internal/commercial/clients')
export class ClientAccountController {
  constructor(private readonly clients: ClientAccountService) {}

  @Get()
  @RequirePermission('platform.client.view')
  list(@Query(zodBody(clientListQuerySchema)) q: { skip?: number; take?: number; commercialStatus?: string }) {
    return this.clients.list(q);
  }

  @Get(':businessId')
  @RequirePermission('platform.client.view')
  get(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.clients.findByIdOrThrow(businessId);
  }

  @Patch(':businessId')
  @RequirePermission('platform.client.manage')
  update(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body(zodBody(updateClientAccountSchema)) dto: UpdateClientAccountDto,
  ) {
    return this.clients.update(businessId, dto);
  }

  @Get(':businessId/usage')
  @RequirePermission('platform.client.view')
  usage(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.clients.getUsage(businessId);
  }

  @Get(':businessId/price-overrides')
  @RequirePermission('platform.client.view')
  listOverrides(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.clients.listPriceOverrides(businessId);
  }

  @Post(':businessId/price-overrides')
  @RequirePermission('platform.client.manage')
  createOverride(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body(zodBody(createClientPriceOverrideSchema)) dto: CreateClientPriceOverrideDto,
  ) {
    return this.clients.createPriceOverride(businessId, dto);
  }

  @Patch(':businessId/price-overrides/:overrideId')
  @RequirePermission('platform.client.manage')
  updateOverride(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('overrideId', ParseUUIDPipe) overrideId: string,
    @Body(zodBody(updateClientPriceOverrideSchema)) dto: UpdateClientPriceOverrideDto,
  ) {
    return this.clients.updatePriceOverride(businessId, overrideId, dto);
  }

  @Delete(':businessId/price-overrides/:overrideId')
  @RequirePermission('platform.client.manage')
  removeOverride(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('overrideId', ParseUUIDPipe) overrideId: string,
  ) {
    return this.clients.removePriceOverride(businessId, overrideId);
  }
}
