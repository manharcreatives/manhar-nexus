import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { zodBody } from '../common/zod-validation.pipe';
import { BusinessExistsGuard } from '../common/business-exists.guard';
import { CurrentActor } from '../common/current-actor.decorator';
import { RequirePermission } from './principal';
import type { ActorContext } from '../common/tenant-scope';
import { ProvisioningService } from './provisioning.service';

const provisionSchema = z
  .object({
    email: z.string().trim().email().toLowerCase(),
    displayName: z.string().trim().min(1).max(100),
    password: z.string().min(8).max(128),
    requirePasswordChange: z.boolean().optional(),
  })
  .strict();

type ProvisionDto = z.infer<typeof provisionSchema>;

/**
 * Platform-realm provisioning: called by Manhar staff after creating a new
 * Business to seed the first owner account. Lives under /internal/* so only
 * PLATFORM realm users can reach it.
 */
@Controller('internal/businesses/:businessId/provision')
@RequirePermission('platform.business.configure')
@UseGuards(BusinessExistsGuard)
export class ProvisioningController {
  constructor(private readonly provisioning: ProvisioningService) {}

  @Post()
  provision(
    @CurrentActor() actor: ActorContext,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body(zodBody(provisionSchema)) dto: ProvisionDto,
  ) {
    return this.provisioning.provisionOwner(actor, businessId, dto);
  }
}
