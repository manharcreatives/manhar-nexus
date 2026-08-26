import { Injectable } from '@nestjs/common';
import { Prisma, ModuleStatus, type ModuleActivation } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../core/audit/audit.service';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../common/errors';
import type { TenantScope } from '../common/tenant-scope';
import { ModuleRegistry } from './module.registry';
import type { ModuleManifest } from './module-manifest';

/** Composite view: manifest metadata + per-business status. */
export interface ModuleView {
  key: string;
  name: string;
  description: string;
  dependencies: string[];
  setupSteps: ModuleManifest['setupSteps'];
  /** AVAILABLE when no activation row exists. */
  status: ModuleStatus | 'AVAILABLE';
  config: Record<string, unknown>;
  setupCompletedAt: Date | null;
  activatedAt: Date | null;
  suspendedAt: Date | null;
  disabledAt: Date | null;
}

/**
 * Module lifecycle management — the engine that drives per-business module
 * state transitions. Manifests are code-defined; activation state is in the DB.
 *
 * Status machine:
 *   AVAILABLE (no row) → activate() → PENDING_SETUP
 *   PENDING_SETUP      → completeSetup() → ACTIVE
 *   ACTIVE             → disable() → DISABLED | suspend() (platform) → SUSPENDED
 *   DISABLED           → resume() → ACTIVE (if setup was already completed)
 *   SUSPENDED          → unsuspend() (platform) → ACTIVE
 *   TRIAL              → completeSetup() → ACTIVE (time-limit management in P12)
 *   ARCHIVED           → no user-facing transition (platform only via direct SQL)
 */
@Injectable()
export class ModuleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly registry: ModuleRegistry,
  ) {}

  async listForBusiness(businessId: string): Promise<ModuleView[]> {
    const activations = await this.prisma.moduleActivation.findMany({
      where: { businessId },
    });
    const byKey = new Map(activations.map((a) => [a.moduleKey, a]));

    return this.registry.list().map((manifest) => {
      const activation = byKey.get(manifest.key);
      return this.toView(manifest, activation);
    });
  }

  async getForBusiness(businessId: string, moduleKey: string): Promise<ModuleView> {
    const manifest = this.assertManifestExists(moduleKey);
    const activation = await this.prisma.moduleActivation.findFirst({
      where: { businessId, moduleKey },
    });
    return this.toView(manifest, activation ?? undefined);
  }

  /** Activate a module for a business (creates row, status = PENDING_SETUP). */
  async activate(scope: TenantScope, moduleKey: string): Promise<ModuleView> {
    const manifest = this.assertManifestExists(moduleKey);
    const { businessId } = scope;

    // Check dependencies are ACTIVE.
    await this.assertDepsActive(businessId, manifest);

    // Idempotent: if already activated (any non-ARCHIVED status), reject.
    const existing = await this.prisma.moduleActivation.findFirst({
      where: { businessId, moduleKey },
    });
    if (existing) {
      if (existing.status === 'ARCHIVED') {
        throw new ForbiddenError(
          'Module is archived; contact platform support to re-enable',
          { moduleKey },
        );
      }
      throw new ConflictError('Module is already activated', { moduleKey, status: existing.status });
    }

    const now = new Date();
    const activation = await this.prisma.$transaction(async (tx) => {
      let record: Awaited<ReturnType<typeof tx.moduleActivation.create>>;
      try {
        record = await tx.moduleActivation.create({
          data: {
            businessId,
            moduleKey,
            status: 'PENDING_SETUP',
            config: manifest.defaultConfig as Prisma.InputJsonValue,
            activatedAt: now,
          },
        });
      } catch (e) {
        // Concurrent activation race: the findFirst check above is outside the
        // transaction, so two simultaneous requests can both pass it and then
        // race to create the same (businessId, moduleKey) row.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new ConflictError('Module is already activated', { moduleKey });
        }
        throw e;
      }
      await this.audit.append(tx, scope, {
        action: 'module.activated',
        resourceType: 'module_activation',
        resourceId: record.id,
        metadata: { moduleKey, status: record.status },
      });
      return record;
    });

    return this.toView(manifest, activation);
  }

  /** Mark setup complete → ACTIVE (all required steps assumed done by caller). */
  async completeSetup(scope: TenantScope, moduleKey: string): Promise<ModuleView> {
    const manifest = this.assertManifestExists(moduleKey);
    const activation = await this.findActivationOrThrow(scope.businessId, moduleKey);

    if (!['PENDING_SETUP', 'TRIAL'].includes(activation.status)) {
      throw new ValidationError('Module is not in PENDING_SETUP or TRIAL status', {
        moduleKey,
        status: activation.status,
      });
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const record = await tx.moduleActivation.update({
        where: { id: activation.id },
        data: {
          status: 'ACTIVE',
          setupCompletedAt: now,
          version: { increment: 1 },
        },
      });
      await this.audit.append(tx, scope, {
        action: 'module.setup_completed',
        resourceType: 'module_activation',
        resourceId: record.id,
        metadata: { moduleKey },
      });
      return record;
    });

    return this.toView(manifest, updated);
  }

  /** Owner disables a module (DISABLE ≠ DELETE — data and config preserved). */
  async disable(scope: TenantScope, moduleKey: string): Promise<ModuleView> {
    const manifest = this.assertManifestExists(moduleKey);
    const activation = await this.findActivationOrThrow(scope.businessId, moduleKey);

    if (activation.status !== 'ACTIVE') {
      throw new ValidationError('Only ACTIVE modules can be disabled', {
        moduleKey,
        status: activation.status,
      });
    }

    await this.assertNoDependents(scope.businessId, moduleKey);

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const record = await tx.moduleActivation.update({
        where: { id: activation.id },
        data: { status: 'DISABLED', disabledAt: now, version: { increment: 1 } },
      });
      await this.audit.append(tx, scope, {
        action: 'module.disabled',
        resourceType: 'module_activation',
        resourceId: record.id,
        metadata: { moduleKey },
      });
      return record;
    });

    return this.toView(manifest, updated);
  }

  /** Owner re-enables a DISABLED module (config preserved). */
  async resume(scope: TenantScope, moduleKey: string): Promise<ModuleView> {
    const manifest = this.assertManifestExists(moduleKey);
    const activation = await this.findActivationOrThrow(scope.businessId, moduleKey);

    if (activation.status !== 'DISABLED') {
      throw new ValidationError('Only DISABLED modules can be resumed', {
        moduleKey,
        status: activation.status,
      });
    }

    // Re-check dependencies are still active.
    await this.assertDepsActive(scope.businessId, manifest);

    const updated = await this.prisma.$transaction(async (tx) => {
      const record = await tx.moduleActivation.update({
        where: { id: activation.id },
        data: {
          status: activation.setupCompletedAt ? 'ACTIVE' : 'PENDING_SETUP',
          disabledAt: null,
          version: { increment: 1 },
        },
      });
      await this.audit.append(tx, scope, {
        action: 'module.resumed',
        resourceType: 'module_activation',
        resourceId: record.id,
        metadata: { moduleKey, newStatus: record.status },
      });
      return record;
    });

    return this.toView(manifest, updated);
  }

  /** Platform suspends a module (business cannot re-enable; platform must unsuspend). */
  async suspend(scope: TenantScope, moduleKey: string): Promise<ModuleView> {
    const manifest = this.assertManifestExists(moduleKey);
    const activation = await this.findActivationOrThrow(scope.businessId, moduleKey);

    if (!['ACTIVE', 'PENDING_SETUP', 'TRIAL'].includes(activation.status)) {
      throw new ValidationError('Module cannot be suspended from current status', {
        moduleKey,
        status: activation.status,
      });
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const record = await tx.moduleActivation.update({
        where: { id: activation.id },
        data: { status: 'SUSPENDED', suspendedAt: now, version: { increment: 1 } },
      });
      await this.audit.append(tx, scope, {
        action: 'module.suspended',
        resourceType: 'module_activation',
        resourceId: record.id,
        metadata: { moduleKey },
      });
      return record;
    });

    return this.toView(manifest, updated);
  }

  /** Platform unsuspends a module (restores to ACTIVE or PENDING_SETUP). */
  async unsuspend(scope: TenantScope, moduleKey: string): Promise<ModuleView> {
    const manifest = this.assertManifestExists(moduleKey);
    const activation = await this.findActivationOrThrow(scope.businessId, moduleKey);

    if (activation.status !== 'SUSPENDED') {
      throw new ValidationError('Only SUSPENDED modules can be unsuspended', {
        moduleKey,
        status: activation.status,
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const record = await tx.moduleActivation.update({
        where: { id: activation.id },
        data: {
          status: activation.setupCompletedAt ? 'ACTIVE' : 'PENDING_SETUP',
          suspendedAt: null,
          version: { increment: 1 },
        },
      });
      await this.audit.append(tx, scope, {
        action: 'module.unsuspended',
        resourceType: 'module_activation',
        resourceId: record.id,
        metadata: { moduleKey, newStatus: record.status },
      });
      return record;
    });

    return this.toView(manifest, updated);
  }

  /** Returns true if the module is ACTIVE for the business. Used by gating guard. */
  async isActive(businessId: string, moduleKey: string): Promise<boolean> {
    const activation = await this.prisma.moduleActivation.findFirst({
      where: { businessId, moduleKey, status: 'ACTIVE' },
      select: { id: true },
    });
    return activation !== null;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private assertManifestExists(moduleKey: string): ModuleManifest {
    const manifest = this.registry.get(moduleKey);
    if (!manifest) throw new NotFoundError('Unknown module', { moduleKey });
    return manifest;
  }

  private async findActivationOrThrow(
    businessId: string,
    moduleKey: string,
  ): Promise<ModuleActivation> {
    const activation = await this.prisma.moduleActivation.findFirst({
      where: { businessId, moduleKey },
    });
    if (!activation) {
      throw new NotFoundError('Module is not activated for this business', { moduleKey });
    }
    return activation;
  }

  private async assertDepsActive(businessId: string, manifest: ModuleManifest): Promise<void> {
    for (const dep of manifest.dependencies) {
      const active = await this.isActive(businessId, dep);
      if (!active) {
        const depManifest = this.registry.get(dep);
        throw new ValidationError(
          `Dependency '${depManifest?.name ?? dep}' must be ACTIVE before activating '${manifest.name}'`,
          { requiredDependency: dep, moduleKey: manifest.key },
        );
      }
    }
  }

  /** Prevents disabling a module that other ACTIVE modules depend on. */
  private async assertNoDependents(businessId: string, moduleKey: string): Promise<void> {
    const activeModules = await this.prisma.moduleActivation.findMany({
      where: { businessId, status: 'ACTIVE' },
      select: { moduleKey: true },
    });
    const activeKeys = new Set(activeModules.map((m) => m.moduleKey));
    activeKeys.delete(moduleKey); // exclude self

    const dependents = this.registry
      .list()
      .filter(
        (m) => m.dependencies.includes(moduleKey) && activeKeys.has(m.key),
      );

    if (dependents.length > 0) {
      throw new ValidationError(
        `Cannot disable '${moduleKey}': the following active modules depend on it: ${dependents.map((m) => m.name).join(', ')}`,
        { moduleKey, dependents: dependents.map((m) => m.key) },
      );
    }
  }

  private toView(
    manifest: ModuleManifest,
    activation?: ModuleActivation,
  ): ModuleView {
    return {
      key: manifest.key,
      name: manifest.name,
      description: manifest.description,
      dependencies: manifest.dependencies,
      setupSteps: manifest.setupSteps,
      status: activation?.status ?? 'AVAILABLE',
      config: (activation?.config ?? {}) as Record<string, unknown>,
      setupCompletedAt: activation?.setupCompletedAt ?? null,
      activatedAt: activation?.activatedAt ?? null,
      suspendedAt: activation?.suspendedAt ?? null,
      disabledAt: activation?.disabledAt ?? null,
    };
  }
}
