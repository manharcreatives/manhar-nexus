import { Injectable } from '@nestjs/common';

/** A permission the platform knows about, `module.resource.action`. */
export interface PermissionDefinition {
  /** e.g. 'core', 'platform', later 'catalog'/'checkout' (module segment). */
  module: string;
  resource: string;
  /** view|create|edit|delete|assign|configure|export|deactivate|manage|… */
  action: string;
  description: string;
  /**
   * Platform/IAM-critical: a business Owner may NOT grant this to a custom
   * business role (defense against privilege escalation via custom roles).
   */
  restricted?: boolean;
}

export const permissionKey = (d: {
  module: string;
  resource: string;
  action: string;
}): string => `${d.module}.${d.resource}.${d.action}`;

/** Wildcard grant held by Owner (business-wide) and platform-admin. */
export const WILDCARD = '*';

/**
 * The typed permission catalog — the single source of truth for which
 * permissions exist (mirrors SettingsRegistry). Grants store a permission KEY
 * string validated against this registry; there is no permissions DB table, so
 * modules add permissions in later phases by calling `register()` with zero
 * engine changes.
 */
@Injectable()
export class PermissionRegistry {
  private readonly defs = new Map<string, PermissionDefinition>();

  constructor() {
    this.register(CORE_PERMISSIONS);
  }

  register(defs: PermissionDefinition[]): void {
    for (const def of defs) {
      const key = permissionKey(def);
      if (this.defs.has(key)) throw new Error(`Duplicate permission: ${key}`);
      this.defs.set(key, def);
    }
  }

  has(key: string): boolean {
    return key === WILDCARD || this.defs.has(key);
  }

  get(key: string): PermissionDefinition | undefined {
    return this.defs.get(key);
  }

  isRestricted(key: string): boolean {
    return this.defs.get(key)?.restricted ?? false;
  }

  keys(): string[] {
    return [...this.defs.keys()];
  }

  list(module?: string): PermissionDefinition[] {
    const all = [...this.defs.values()];
    return module ? all.filter((d) => d.module === module) : all;
  }
}

const p = (
  module: string,
  resource: string,
  action: string,
  description: string,
  restricted = false,
): PermissionDefinition => ({ module, resource, action, description, restricted });

/**
 * Phase 3 core catalog: platform (Manhar internal realm) + core/IAM (business
 * realm). Vertical module permissions (catalog/checkout/…) arrive in Phase 5+
 * via `register()`.
 */
export const CORE_PERMISSIONS: PermissionDefinition[] = [
  // ── Platform realm (restricted: never grantable to a business role) ──
  p('platform', 'business', 'view', 'View any business', true),
  p('platform', 'business', 'create', 'Provision a new business', true),
  p('platform', 'business', 'configure', 'Edit any business', true),
  p('platform', 'location', 'manage', 'Manage any business locations', true),
  p('platform', 'setting', 'manage', 'Manage any business settings', true),
  p('platform', 'audit', 'view', 'View any business activity history', true),
  p('platform', 'numbering', 'manage', 'Manage any business numbering', true),
  p('platform', 'user', 'manage', 'Manage platform users', true),
  p('platform', 'modules', 'manage', 'Manage module activations for any business', true),
  p('platform', 'commercial', 'view', 'View offerings, price books, and bundles', true),
  p('platform', 'commercial', 'manage', 'Manage offerings, price books, and bundles', true),
  p('platform', 'client', 'view', 'View client account commercial details and usage', true),
  p('platform', 'client', 'manage', 'Manage client account commercial status and overrides', true),
  p('platform', 'activation', 'view', 'View activation requests', true),
  p('platform', 'activation', 'manage', 'Manage the activation request workflow', true),
  p('platform', 'onboarding', 'view', 'View client onboarding progress', true),
  p('platform', 'onboarding', 'manage', 'Manage client onboarding milestones', true),
  p('platform', 'registration', 'view', 'View public registration requests (landing-page leads)', true),
  p('platform', 'registration', 'manage', 'Triage public registration requests (status, owner, notes)', true),

  // ── Core / IAM (business realm) ──
  p('core', 'user', 'view', 'View users'),
  p('core', 'user', 'create', 'Create users'),
  p('core', 'user', 'edit', 'Edit users'),
  p('core', 'user', 'deactivate', 'Suspend/reactivate users', true),
  p('core', 'role', 'view', 'View roles'),
  p('core', 'role', 'create', 'Create custom roles', true),
  p('core', 'role', 'edit', 'Edit custom roles', true),
  p('core', 'role', 'delete', 'Delete custom roles', true),
  p('core', 'role', 'assign', 'Assign roles to users', true),
  p('core', 'location', 'view', 'View locations'),
  p('core', 'location', 'create', 'Create locations'),
  p('core', 'location', 'edit', 'Edit locations'),
  p('core', 'business', 'view', 'View business profile'),
  p('core', 'business', 'configure', 'Edit business profile'),
  p('core', 'setting', 'view', 'View settings'),
  p('core', 'setting', 'edit', 'Edit settings'),
  p('core', 'audit', 'view', 'View activity history'),
  p('core', 'audit', 'export', 'Export activity history'),
  p('core', 'numbering', 'view', 'View numbering series'),
  p('core', 'numbering', 'manage', 'Configure/allocate numbering'),
  p('core', 'modules', 'view', 'View module catalog and activation status'),
  p('core', 'modules', 'manage', 'Activate, disable, and configure modules', true),
  p('core', 'alert', 'view', 'View alert notification rules'),
  p('core', 'alert', 'edit', 'Create, update, and delete alert notification rules'),
  p('core', 'notification', 'view', 'View own in-app notifications'),
];
