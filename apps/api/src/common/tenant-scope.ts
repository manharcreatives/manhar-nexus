/**
 * Tenant scope — the mandatory context every tenant-scoped operation carries.
 *
 * ADR-002: isolation is enforced at the repository layer via a non-null
 * `businessId`. Scope is passed EXPLICITLY into services (never read ambiently)
 * so isolation is visible, testable, and impossible to forget silently.
 */

/** Kinds of actor that can cause an audited change. Matches Prisma `ActorType`. */
export type ActorType = 'INTERNAL_ADMIN' | 'USER' | 'SYSTEM';

/** Who is performing an action — recorded on every audit event. */
export interface ActorContext {
  type: ActorType;
  /** Stable id (a user id from Phase 3; absent for the internal-admin bridge). */
  id?: string;
  /** Human-readable label for activity history, e.g. "internal-admin". */
  label: string;
}

/** The isolation boundary + actor for a single tenant-scoped operation. */
export interface TenantScope {
  businessId: string;
  /** Optional operating location within the business. */
  locationId?: string;
  actor: ActorContext;
}

/** The internal-admin bridge actor used until real auth lands (Phase 3). */
export const INTERNAL_ADMIN_ACTOR: ActorContext = {
  type: 'INTERNAL_ADMIN',
  label: 'internal-admin',
};
