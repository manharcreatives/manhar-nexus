import { Injectable } from '@nestjs/common';
import { Prisma, type Setting } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError, ValidationError, VersionConflictError } from '../../common/errors';
import { lockBusiness } from '../../common/locks';
import { TenantScopedRepository } from '../../common/tenant-scoped.repository';
import type { TenantScope } from '../../common/tenant-scope';
import { AuditService } from '../audit/audit.service';
import { SettingsRegistry } from './settings.registry';

/** Where an effective value came from in the precedence chain. */
export type SettingSource = 'location' | 'business' | 'default';

export interface EffectiveSetting {
  namespace: string;
  key: string;
  value: unknown;
  valueType: string;
  source: SettingSource;
  /** Row version when the value came from a stored row. */
  version?: number;
}

/**
 * Typed, scoped configuration engine (Master §2 Configuration Center).
 *
 * Precedence: location override → business value → registry default.
 * Writes are type-validated against the registry, versioned for optimistic
 * concurrency (ADR-017), serialized per business, and audited (ADR-016).
 */
@Injectable()
export class SettingsService extends TenantScopedRepository {
  constructor(
    prisma: PrismaService,
    private readonly registry: SettingsRegistry,
    private readonly audit: AuditService,
  ) {
    super(prisma);
  }

  /** Resolve one setting's effective value for an optional location context. */
  async getEffective(
    scope: TenantScope,
    namespace: string,
    key: string,
    locationId?: string,
  ): Promise<EffectiveSetting> {
    const def = this.registry.get(namespace, key);
    if (!def) throw new NotFoundError('Unknown setting', { namespace, key });

    if (locationId) {
      await this.assertLocationInScope(scope, locationId);
      const locationRow = await this.prisma.setting.findFirst({
        where: this.scoped(scope, { locationId, namespace, key }),
      });
      if (locationRow) return this.toEffective(def.valueType, locationRow, 'location');
    }

    const businessRow = await this.prisma.setting.findFirst({
      where: this.scoped(scope, { locationId: null, namespace, key }),
    });
    if (businessRow) return this.toEffective(def.valueType, businessRow, 'business');

    return { namespace, key, value: def.default, valueType: def.valueType, source: 'default' };
  }

  /** Effective values for every registered setting in a namespace. */
  async getEffectiveNamespace(
    scope: TenantScope,
    namespace: string,
    locationId?: string,
  ): Promise<EffectiveSetting[]> {
    const defs = this.registry.list(namespace);
    if (defs.length === 0) throw new NotFoundError('Unknown settings namespace', { namespace });
    return Promise.all(defs.map((d) => this.getEffective(scope, namespace, d.key, locationId)));
  }

  /** Create or update a setting value at business or location scope. */
  async set(
    scope: TenantScope,
    namespace: string,
    key: string,
    value: unknown,
    opts: { locationId?: string; expectedVersion?: number } = {},
  ): Promise<Setting> {
    const def = this.registry.get(namespace, key);
    if (!def) throw new ValidationError('Unknown setting', { namespace, key });

    const parsed = def.schema.safeParse(value);
    if (!parsed.success) {
      throw new ValidationError('Invalid setting value', {
        namespace,
        key,
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    const nextValue = parsed.data as unknown;

    if (opts.locationId) await this.assertLocationInScope(scope, opts.locationId);
    const locationId = opts.locationId ?? null;

    return this.prisma.$transaction(async (tx) => {
      // Serialize read-modify-write for this business (avoids lost updates).
      await lockBusiness(tx, scope.businessId);

      const existing = await tx.setting.findFirst({
        where: { businessId: scope.businessId, locationId, namespace, key },
      });

      if (opts.expectedVersion !== undefined) {
        const currentVersion = existing?.version ?? 0;
        if (opts.expectedVersion !== currentVersion) {
          throw new VersionConflictError('Setting was modified concurrently', {
            expectedVersion: opts.expectedVersion,
            actualVersion: currentVersion,
          });
        }
      }

      const jsonValue =
        nextValue === null ? Prisma.JsonNull : (nextValue as Prisma.InputJsonValue);

      const row = existing
        ? await tx.setting.update({
            where: { id: existing.id },
            data: { value: jsonValue, valueType: def.valueType, version: existing.version + 1 },
          })
        : await tx.setting.create({
            data: {
              businessId: scope.businessId,
              locationId,
              namespace,
              key,
              value: jsonValue,
              valueType: def.valueType,
            },
          });

      // Never write raw values for sensitive settings into the immutable chain.
      const redact = (v: unknown): unknown => (def.sensitive ? '[redacted]' : v);
      await this.audit.append(tx, { ...scope, locationId: opts.locationId }, {
        action: 'setting.updated',
        resourceType: 'setting',
        resourceId: row.id,
        locationId: opts.locationId,
        metadata: {
          namespace,
          key,
          scope: locationId ? 'location' : 'business',
          sensitive: def.sensitive ?? false,
          from: existing ? redact(existing.value as unknown) : null,
          to: redact(nextValue),
          version: row.version,
        },
      });

      return row;
    });
  }

  /** Raw stored setting rows for a business (both scopes). */
  async listRaw(scope: TenantScope): Promise<Setting[]> {
    return this.prisma.setting.findMany({
      where: this.scoped(scope),
      orderBy: [{ namespace: 'asc' }, { key: 'asc' }],
    });
  }

  private toEffective(
    valueType: string,
    row: Setting,
    source: SettingSource,
  ): EffectiveSetting {
    return {
      namespace: row.namespace,
      key: row.key,
      value: row.value as unknown,
      valueType,
      source,
      version: row.version,
    };
  }
}
