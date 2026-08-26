import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../core/audit/audit.service';
import { BusinessService } from '../core/business/business.service';
import { NotFoundError, ValidationError } from '../common/errors';
import type { ActorContext } from '../common/tenant-scope';
import {
  ONBOARDING_STEPS,
  type OnboardingStep,
  type InitOnboardingDto,
  type CompleteStepDto,
  type ListOnboardingQuery,
  type UpdateNotesDto,
} from './onboarding.dto';

export interface OnboardingValidation {
  hasLocation: boolean;
  hasActiveModule: boolean;
  hasNonOwnerUser: boolean;
  hasBranding: boolean;
  issues: string[];
}

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly businessService: BusinessService,
  ) {}

  /** Initialize onboarding progress for a business (idempotent). */
  async initialize(
    actor: ActorContext,
    businessId: string,
    dto: InitOnboardingDto,
  ) {
    await this.businessService.findByIdOrThrow(businessId);

    const existing = await this.prisma.onboardingProgress.findUnique({
      where: { businessId },
    });
    if (existing) {
      return existing;
    }

    const record = await this.prisma.$transaction(async (tx) => {
      const created = await tx.onboardingProgress.create({
        data: {
          businessId,
          completedSteps: ['BUSINESS_CREATED'],
          currentStep: 'LOCATION_ADDED',
          notes: dto.notes,
        },
      });
      await this.audit.append(tx, { businessId, actor }, {
        action: 'onboarding.initialized',
        resourceType: 'onboarding_progress',
        resourceId: created.id,
        metadata: { businessId },
      });
      return created;
    });

    return record;
  }

  /** Get onboarding progress for a business (404 if not started). */
  async get(businessId: string) {
    const record = await this.prisma.onboardingProgress.findUnique({
      where: { businessId },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            commercialStatus: true,
            slug: true,
            logoUrl: true,
            accentColor: true,
          },
        },
      },
    });
    if (!record) {
      throw new NotFoundError('Onboarding not started for this business', { businessId });
    }
    return record;
  }

  /** List all onboarding progress records (platform overview). */
  async list(query: ListOnboardingQuery) {
    const where: Record<string, unknown> = {};
    if (query.currentStep) where['currentStep'] = query.currentStep;
    if (query.completed === true) where['completedAt'] = { not: null };
    if (query.completed === false) where['completedAt'] = null;

    return this.prisma.onboardingProgress.findMany({
      where,
      skip: query.skip,
      take: query.take,
      orderBy: { startedAt: 'desc' },
      include: {
        business: {
          select: { id: true, name: true, commercialStatus: true },
        },
      },
    });
  }

  /** Mark a step complete (idempotent). Advances currentStep automatically. */
  async completeStep(
    actor: ActorContext,
    businessId: string,
    step: OnboardingStep,
    dto: CompleteStepDto,
  ) {
    const record = await this.findOrThrow(businessId);

    if (record.completedAt) {
      throw new ValidationError('Onboarding is already fully completed', { businessId });
    }

    const alreadyDone = record.completedSteps.includes(step);

    const updated = await this.prisma.$transaction(async (tx) => {
      const newCompletedSteps = alreadyDone
        ? record.completedSteps
        : [...record.completedSteps, step];

      const nextStep = this.computeCurrentStep(newCompletedSteps as OnboardingStep[]);

      const r = await tx.onboardingProgress.update({
        where: { businessId },
        data: {
          completedSteps: newCompletedSteps,
          currentStep: nextStep,
          completedAt: nextStep === 'COMPLETED' && newCompletedSteps.includes('COMPLETED')
            ? new Date()
            : record.completedAt,
        },
      });

      if (!alreadyDone) {
        await this.audit.append(tx, { businessId, actor }, {
          action: 'onboarding.step_completed',
          resourceType: 'onboarding_progress',
          resourceId: record.id,
          metadata: { step, note: dto.note },
        });
      }

      return r;
    });

    return updated;
  }

  /** Update the notes field on an onboarding record. */
  async updateNotes(
    actor: ActorContext,
    businessId: string,
    dto: UpdateNotesDto,
  ) {
    const record = await this.findOrThrow(businessId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const r = await tx.onboardingProgress.update({
        where: { businessId },
        data: { notes: dto.notes },
      });
      await this.audit.append(tx, { businessId, actor }, {
        action: 'onboarding.notes_updated',
        resourceType: 'onboarding_progress',
        resourceId: record.id,
        metadata: {},
      });
      return r;
    });
    return updated;
  }

  /**
   * Validate that a business is ready for go-live.
   * Returns a structured object showing which pre-conditions pass/fail.
   */
  async validate(businessId: string): Promise<OnboardingValidation> {
    await this.businessService.findByIdOrThrow(businessId);

    const [locationCount, activeModuleCount, business] = await Promise.all([
      this.prisma.location.count({ where: { businessId, status: 'ACTIVE' } }),
      this.prisma.moduleActivation.count({ where: { businessId, status: 'ACTIVE' } }),
      this.prisma.business.findUnique({
        where: { id: businessId },
        select: { slug: true, logoUrl: true, accentColor: true, invoiceName: true },
      }),
    ]);

    const userCount = await this.prisma.user.count({
      where: { businessId, status: 'ACTIVE' },
    });

    const hasLocation = locationCount > 0;
    const hasActiveModule = activeModuleCount > 0;
    const hasNonOwnerUser = userCount > 0;
    const hasBranding = !!(business?.slug || business?.invoiceName || business?.logoUrl || business?.accentColor);

    const issues: string[] = [];
    if (!hasLocation) issues.push('No active locations — add at least one location');
    if (!hasActiveModule) issues.push('No active modules — activate at least one module');
    if (!hasNonOwnerUser) issues.push('No users provisioned — provision the owner account');
    if (!hasBranding) issues.push('No branding configured — set business slug or invoice name');

    return { hasLocation, hasActiveModule, hasNonOwnerUser, hasBranding, issues };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async findOrThrow(businessId: string) {
    const record = await this.prisma.onboardingProgress.findUnique({
      where: { businessId },
    });
    if (!record) {
      throw new NotFoundError('Onboarding not started for this business', { businessId });
    }
    return record;
  }

  /**
   * Given the list of completed steps, return the key of the first step
   * not yet in the list (this becomes the new currentStep).
   * If all steps are done, returns 'COMPLETED'.
   */
  private computeCurrentStep(completedSteps: OnboardingStep[]): OnboardingStep {
    const done = new Set(completedSteps);
    return ONBOARDING_STEPS.find((s) => !done.has(s)) ?? 'COMPLETED';
  }
}
