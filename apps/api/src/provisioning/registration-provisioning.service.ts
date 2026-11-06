import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, type RegistrationProvisioning, type RegistrationRequest } from '@prisma/client';
import { AuditService } from '../core/audit/audit.service';
import { LocationService } from '../core/location/location.service';
import { ConflictError, DomainError, NotFoundError, ValidationError } from '../common/errors';
import type { ActorContext } from '../common/tenant-scope';
import { PasswordService } from '../iam/password.service';
import { logger } from '../logging/logger';
import { ModuleService } from '../modules/module.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { PrismaService } from '../prisma/prisma.service';
import { BillingRecordService } from './billing-record.service';
import {
  CORE_MODULES,
  TRANSIENT_FAILURE_MESSAGE,
  generateTempPassword,
  stepsFor,
  type ProvisionDto,
  type ProvisionInput,
  type ProvisionView,
  type StepId,
} from './provisioning.dto';

/** A run that has not touched its lock for this long crashed (a serverless function was killed); take it over. */
const STALE_LOCK_MS = 2 * 60_000;
const OPEN_STATUSES: ('NEW' | 'CONTACTED' | 'QUALIFIED')[] = ['NEW', 'CONTACTED', 'QUALIFIED'];

/**
 * "Create the restaurant account" as ONE server-side job per registration request.
 *
 * Failure model (why it is safe to retry at any point):
 *  - every step is recorded in `completedSteps` AND is itself idempotent (it looks before it creates), so a crash
 *    between doing the work and recording it only repeats a no-op;
 *  - the business is created in the SAME transaction that records its id on the job, so a retry can never create a
 *    second business;
 *  - one run at a time: the job is claimed with a compare-and-set, a second click gets 409 (a crashed run's stale
 *    claim is taken over after two minutes);
 *  - the registration is marked CONVERTED (with the businessId) only in the last step;
 *  - the owner's temporary password is generated in the last steps, returned once in the response and only its
 *    argon2 hash is stored. If the response is lost, staff re-issue one (allowed until the owner signs in).
 */
@Injectable()
export class RegistrationProvisioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly locations: LocationService,
    private readonly modules: ModuleService,
    private readonly onboarding: OnboardingService,
    private readonly passwords: PasswordService,
    private readonly billing: BillingRecordService,
  ) {}

  /** The job's progress (never a password). 404 when nothing has been started. */
  async status(registrationId: string): Promise<ProvisionView> {
    const reg = await this.registrationOrThrow(registrationId);
    const job = await this.prisma.registrationProvisioning.findUnique({ where: { registrationId } });
    if (!job) throw new NotFoundError('Account creation has not been started for this request');
    return this.view(job, reg.email);
  }

  async run(actor: ActorContext, registrationId: string, dto: ProvisionDto, now = new Date(), opts: { auto?: boolean } = {}): Promise<ProvisionView> {
    const reg = await this.registrationOrThrow(registrationId);
    const existing = await this.prisma.registrationProvisioning.findUnique({ where: { registrationId } });

    if (existing?.status === 'DONE') return this.afterDone(existing, reg, dto);
    if (!existing) {
      if (reg.status === 'CONVERTED') throw new ConflictError('This request is already converted.');
      if (!(OPEN_STATUSES as string[]).includes(reg.status)) {
        throw new ValidationError(`Cannot create an account for a ${reg.status.toLowerCase()} request`, { status: reg.status });
      }
      const paid = await this.prisma.registrationPayment.count({ where: { registrationId, status: 'PAID' } });
      if (paid === 0 && dto.allowUnpaid !== true) {
        throw new ConflictError('No payment is recorded for this request yet. Wait for the payment, or confirm a free pilot.', { needsPayment: true });
      }
    }

    const job = await this.claim(actor, reg, existing, dto, now, opts.auto === true);
    return this.execute(actor, job, reg, now);
  }

  // ── claiming ────────────────────────────────────────────────────────────────

  private defaults(reg: RegistrationRequest, dto: ProvisionDto, auto: boolean): ProvisionInput {
    const extras = dto.extraModules ?? ['reports', 'costs'];
    return {
      name: dto.name ?? reg.restaurantName,
      locationName: dto.locationName ?? 'Main Location',
      ownerName: dto.ownerName ?? reg.contactName,
      ownerEmail: dto.ownerEmail ?? reg.email,
      commercialStatus: dto.commercialStatus ?? (dto.allowUnpaid ? 'TRIAL' : 'ACTIVE'),
      modules: [...CORE_MODULES, ...extras.filter((m, i) => extras.indexOf(m) === i)],
      ...(auto ? { auto: true } : {}),
    };
  }

  private async claim(
    actor: ActorContext,
    reg: RegistrationRequest,
    existing: RegistrationProvisioning | null,
    dto: ProvisionDto,
    now: Date,
    auto: boolean,
  ): Promise<RegistrationProvisioning> {
    if (!existing) {
      try {
        return await this.prisma.registrationProvisioning.create({
          data: {
            registrationId: reg.id,
            status: 'RUNNING',
            completedSteps: [],
            input: this.defaults(reg, dto, auto) as unknown as Prisma.InputJsonValue,
            lockedAt: now,
            startedBy: actor.id ?? actor.label,
          },
        });
      } catch (err) {
        // Two clicks at once: the other one created the row first and is running it.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new ConflictError('Account creation is already running for this request. Wait a moment, then check again.');
        }
        throw err;
      }
    }

    // A retry may fix the owner's email (a typo, or an address that already has an account) until the owner exists.
    const input = existing.input as unknown as ProvisionInput;
    const changeEmail = dto.ownerEmail && !existing.completedSteps.includes('owner') && dto.ownerEmail !== input.ownerEmail;
    const stale = new Date(now.getTime() - STALE_LOCK_MS);
    const res = await this.prisma.registrationProvisioning.updateMany({
      where: {
        id: existing.id,
        status: { not: 'DONE' },
        OR: [{ status: 'FAILED' }, { lockedAt: null }, { lockedAt: { lt: stale } }],
      },
      data: {
        status: 'RUNNING',
        lockedAt: now,
        lastError: null,
        ...(changeEmail ? { input: { ...input, ownerEmail: dto.ownerEmail } as unknown as Prisma.InputJsonValue } : {}),
      },
    });
    if (res.count === 0) {
      throw new ConflictError('Account creation is already running for this request. Wait a moment, then check again.');
    }
    return this.prisma.registrationProvisioning.findUniqueOrThrow({ where: { id: existing.id } });
  }

  // ── running ─────────────────────────────────────────────────────────────────

  private async execute(actor: ActorContext, start: RegistrationProvisioning, reg: RegistrationRequest, now: Date): Promise<ProvisionView> {
    let job = start;
    const input = job.input as unknown as ProvisionInput;
    const log = logger.child({ registrationId: reg.id, reference: reg.referenceCode });
    let credentials: ProvisionView['credentials'];

    for (const id of stepsFor(input.modules)) {
      if (job.completedSteps.includes(id)) continue;
      try {
        job = await this.prisma.registrationProvisioning.update({ where: { id: job.id }, data: { currentStep: id, lockedAt: new Date() } });
        if (id === 'finalize') credentials = await this.finalize(actor, job, reg, input, now);
        else await this.runStep(actor, id, job, reg, input);
        if (id !== 'business') {
          job = await this.prisma.registrationProvisioning.update({ where: { id: job.id }, data: { completedSteps: { push: id } } });
        } else {
          job = await this.prisma.registrationProvisioning.findUniqueOrThrow({ where: { id: job.id } });
        }
      } catch (err) {
        const message = err instanceof DomainError ? err.message.slice(0, 300) : TRANSIENT_FAILURE_MESSAGE;
        if (!(err instanceof DomainError)) log.error({ err, step: id }, 'provisioning step failed');
        else log.warn(`provisioning step ${id} refused: ${message}`);
        job = await this.prisma.registrationProvisioning.update({
          where: { id: job.id },
          data: { status: 'FAILED', currentStep: id, lastError: message, lockedAt: null },
        });
        return this.view(job, reg.email);
      }
    }

    job = await this.prisma.registrationProvisioning.update({ where: { id: job.id }, data: { status: 'DONE', currentStep: null, lockedAt: null, lastError: null } });
    log.info({ businessId: job.businessId }, 'restaurant account created');
    return { ...this.view(job, reg.email), ...(credentials ? { credentials } : {}) };
  }

  private async runStep(actor: ActorContext, id: StepId, job: RegistrationProvisioning, reg: RegistrationRequest, input: ProvisionInput): Promise<void> {
    if (id === 'business') return this.createBusiness(actor, job, input);
    const businessId = job.businessId;
    if (!businessId) throw new ValidationError('The business was not created yet');
    const scope = { businessId, actor };
    if (id === 'location') {
      if ((await this.prisma.location.count({ where: { businessId } })) === 0) await this.locations.create(scope, { name: input.locationName });
      return;
    }
    if (id === 'owner') return this.createOwner(actor, businessId, input);
    if (id.startsWith('module:')) {
      const key = id.slice('module:'.length);
      const find = () => this.prisma.moduleActivation.findFirst({ where: { businessId, moduleKey: key } });
      if (!(await find())) {
        try {
          await this.modules.activate(scope, key);
        } catch (err) {
          if (!(err instanceof ConflictError)) throw err; // a concurrent run already activated it
        }
      }
      const current = await find();
      if (current && ['PENDING_SETUP', 'TRIAL'].includes(current.status)) await this.modules.completeSetup(scope, key);
      return;
    }
    if (id === 'commercial') {
      await this.prisma.business.update({ where: { id: businessId }, data: { commercialStatus: input.commercialStatus } });
      await this.billing.recordForBusiness(businessId, reg.id);
      return;
    }
    if (id === 'onboarding') {
      await this.onboarding.initialize(actor, businessId, {});
      return;
    }
  }

  /** Business + audit + the job's businessId and "business done" in ONE transaction: no orphan, no duplicate. */
  private async createBusiness(actor: ActorContext, job: RegistrationProvisioning, input: ProvisionInput): Promise<void> {
    if (job.businessId) {
      if (!job.completedSteps.includes('business')) {
        await this.prisma.registrationProvisioning.update({ where: { id: job.id }, data: { completedSteps: { push: 'business' } } });
      }
      return;
    }
    const type = await this.prisma.businessType.findUnique({ where: { key: 'restaurant' } });
    if (!type || !type.isActive) throw new ValidationError('The restaurant business type is not set up on this server');
    await this.prisma.$transaction(async (tx) => {
      const business = await tx.business.create({ data: { name: input.name, businessTypeId: type.id, currencyCode: 'INR', timezone: 'Asia/Kolkata' } });
      await this.audit.append(tx, { businessId: business.id, actor }, {
        action: 'business.created',
        resourceType: 'business',
        resourceId: business.id,
        metadata: { name: business.name, businessTypeKey: 'restaurant', registrationId: job.registrationId, ...(input.auto ? { autoProvisioned: true } : {}) },
      });
      await tx.registrationProvisioning.update({ where: { id: job.id }, data: { businessId: business.id, completedSteps: { push: 'business' } } });
    });
  }

  /** The owner login, created with a random password nobody knows; the real temporary one is set in `finalize`. */
  private async createOwner(actor: ActorContext, businessId: string, input: ProvisionInput): Promise<void> {
    const email = input.ownerEmail.trim().toLowerCase();
    const mine = await this.prisma.user.findFirst({ where: { businessId, email } });
    if (mine) return;
    if (await this.prisma.user.findFirst({ where: { email } })) {
      throw new ConflictError('That email already has an account. Use a different owner email and retry.', { email });
    }
    const ownerRole = await this.prisma.role.findFirst({ where: { key: 'owner', businessId: null } });
    if (!ownerRole) throw new NotFoundError('System owner role not found; run the seed first');
    const passwordHash = await this.passwords.hash(randomBytes(24).toString('base64url'));
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { realm: 'BUSINESS', businessId, email, passwordHash, mustChangePassword: true, displayName: input.ownerName, status: 'ACTIVE' },
      });
      await tx.userRole.create({ data: { userId: user.id, roleId: ownerRole.id, businessId, allLocations: true } });
      await this.audit.append(tx, { businessId, actor }, {
        action: 'business.provisioned',
        resourceType: 'app_user',
        resourceId: user.id,
        metadata: { email, displayName: input.ownerName, role: 'owner' },
      });
    });
  }

  /** Issue the temporary password, then (last of all) mark the request converted. */
  private async finalize(actor: ActorContext, job: RegistrationProvisioning, reg: RegistrationRequest, input: ProvisionInput, now: Date): Promise<ProvisionView['credentials'] | undefined> {
    const businessId = job.businessId as string;
    const email = input.ownerEmail.trim().toLowerCase();
    // An automatic run never issues a password: the owner sets their own through a one-time link.
    const credentials = input.auto ? undefined : await this.setTempPassword(businessId, email);
    const res = await this.prisma.registrationRequest.updateMany({
      where: { id: reg.id, status: { in: OPEN_STATUSES } },
      data: { status: 'CONVERTED', businessId, updatedAt: now },
    });
    if (res.count === 0) {
      const fresh = await this.prisma.registrationRequest.findUnique({ where: { id: reg.id }, select: { status: true, businessId: true } });
      if (!(fresh?.status === 'CONVERTED' && fresh.businessId === businessId)) {
        throw new ConflictError('The request was changed by someone else meanwhile. Reload and try again.');
      }
    }
    void actor;
    return credentials;
  }

  private async setTempPassword(businessId: string, email: string): Promise<{ email: string; password: string }> {
    const user = await this.prisma.user.findFirst({ where: { businessId, email } });
    if (!user) throw new NotFoundError('The owner login was not found');
    const password = generateTempPassword();
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await this.passwords.hash(password), mustChangePassword: true } });
    return { email, password };
  }

  /** A finished job: report it; or, on request and only before the owner ever signed in, issue a fresh password. */
  private async afterDone(job: RegistrationProvisioning, reg: RegistrationRequest, dto: ProvisionDto): Promise<ProvisionView> {
    const view = this.view(job, reg.email);
    if (dto.reissuePassword !== true) return view;
    const input = job.input as unknown as ProvisionInput;
    const email = input.ownerEmail.trim().toLowerCase();
    const owner = await this.prisma.user.findFirst({ where: { businessId: job.businessId ?? '', email } });
    if (!owner) throw new NotFoundError('The owner login was not found');
    if (owner.lastLoginAt) throw new ConflictError('The owner has already signed in. Use "reset password" on their account instead.');
    return { ...view, credentials: await this.setTempPassword(job.businessId as string, email) };
  }

  private view(job: RegistrationProvisioning, fallbackEmail: string): ProvisionView {
    const input = job.input as unknown as ProvisionInput;
    const failed = job.status === 'FAILED' ? (job.currentStep as StepId | null) : null;
    return {
      status: job.status as ProvisionView['status'],
      steps: stepsFor(input.modules).map((id) => ({
        id,
        state: job.completedSteps.includes(id) ? 'done' : failed === id ? 'failed' : job.status === 'RUNNING' && job.currentStep === id ? 'running' : 'pending',
      })),
      failedStep: failed,
      error: job.status === 'FAILED' ? job.lastError : null,
      businessId: job.businessId,
      ownerEmail: input.ownerEmail ?? fallbackEmail,
    };
  }

  private async registrationOrThrow(id: string): Promise<RegistrationRequest> {
    const reg = await this.prisma.registrationRequest.findUnique({ where: { id } });
    if (!reg) throw new NotFoundError('Registration request not found');
    return reg;
  }
}
