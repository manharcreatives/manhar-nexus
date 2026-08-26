import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentActor } from '../common/current-actor.decorator';
import { RequirePermission } from '../iam/principal';
import { zodBody } from '../common/zod-validation.pipe';
import type { ActorContext } from '../common/tenant-scope';
import { OnboardingService } from './onboarding.service';
import {
  initOnboardingSchema,
  completeStepSchema,
  updateNotesSchema,
  listOnboardingQuerySchema,
  onboardingStepSchema,
  type InitOnboardingDto,
  type CompleteStepDto,
  type UpdateNotesDto,
  type ListOnboardingQuery,
  type OnboardingStep,
} from './onboarding.dto';

/**
 * Platform-only: onboarding milestone tracking.
 * All endpoints require platform.onboarding.manage (PLATFORM realm only).
 */
@Controller('internal/onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  /** List all onboarding progress records. */
  @Get()
  @RequirePermission('platform.onboarding.view')
  list(@Query(zodBody(listOnboardingQuerySchema)) q: ListOnboardingQuery) {
    return this.onboarding.list(q);
  }

  /** Initialize onboarding for a business (idempotent). */
  @Post(':businessId/initialize')
  @RequirePermission('platform.onboarding.manage')
  initialize(
    @CurrentActor() actor: ActorContext,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body(zodBody(initOnboardingSchema)) dto: InitOnboardingDto,
  ) {
    return this.onboarding.initialize(actor, businessId, dto);
  }

  /** Get onboarding progress for a specific business. */
  @Get(':businessId')
  @RequirePermission('platform.onboarding.view')
  get(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.onboarding.get(businessId);
  }

  /** Validate go-live readiness for a business. */
  @Get(':businessId/validate')
  @RequirePermission('platform.onboarding.view')
  validate(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.onboarding.validate(businessId);
  }

  /** Mark a specific onboarding step complete (idempotent). */
  @Post(':businessId/steps/:step')
  @RequirePermission('platform.onboarding.manage')
  completeStep(
    @CurrentActor() actor: ActorContext,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('step', zodBody(onboardingStepSchema)) step: OnboardingStep,
    @Body(zodBody(completeStepSchema)) dto: CompleteStepDto,
  ) {
    return this.onboarding.completeStep(actor, businessId, step, dto);
  }

  /** Update notes on an onboarding record. */
  @Patch(':businessId/notes')
  @RequirePermission('platform.onboarding.manage')
  updateNotes(
    @CurrentActor() actor: ActorContext,
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body(zodBody(updateNotesSchema)) dto: UpdateNotesDto,
  ) {
    return this.onboarding.updateNotes(actor, businessId, dto);
  }
}
