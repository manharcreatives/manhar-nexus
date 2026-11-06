import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentActor } from '../common/current-actor.decorator';
import { zodBody } from '../common/zod-validation.pipe';
import type { ActorContext } from '../common/tenant-scope';
import { RequirePermission } from '../iam/principal';
import { provisionSchema, type ProvisionDto } from './provisioning.dto';
import { RegistrationProvisioningService } from './registration-provisioning.service';

/** Platform-only: create the restaurant account for a registration request as one resumable job. */
@Controller('internal/registrations/:id/provision')
export class RegistrationProvisioningController {
  constructor(private readonly provisioning: RegistrationProvisioningService) {}

  /**
   * Runs (or resumes) the job. Answers 200 with the progress; a failed step is reported in the body (status FAILED,
   * failedStep, error) so the UI can show it and offer "Retry". The temporary password is in `credentials`, once.
   */
  @Post()
  @HttpCode(200)
  @RequirePermission('platform.registration.manage')
  run(
    @CurrentActor() actor: ActorContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodBody(provisionSchema)) dto: ProvisionDto,
  ) {
    return this.provisioning.run(actor, id, dto);
  }

  @Get()
  @RequirePermission('platform.registration.view')
  status(@Param('id', ParseUUIDPipe) id: string) {
    return this.provisioning.status(id);
  }
}
