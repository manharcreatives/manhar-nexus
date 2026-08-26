/**
 * Shared constants and contracts consumed by all Nexus apps.
 * Phase 1 scope: health contract, request-id header, app identity.
 * Domain types arrive with their owning phases (never speculative).
 */

export const APP_NAME = 'Manhar Nexus';
export const APP_VERSION = '0.1.0';

/** Header used to propagate/return the per-request correlation id. */
export const REQUEST_ID_HEADER = 'x-request-id';

export const HEALTH_STATUS = {
  OK: 'ok',
  DEGRADED: 'degraded',
  ERROR: 'error',
} as const;
export type HealthStatus = (typeof HEALTH_STATUS)[keyof typeof HEALTH_STATUS];

export type ComponentStatus = 'up' | 'down';

export interface ComponentHealth {
  name: string;
  status: ComponentStatus;
  required: boolean;
  latencyMs?: number;
  message?: string;
}

export interface HealthReport {
  status: HealthStatus;
  uptimeSec: number;
  version: string;
  components: ComponentHealth[];
}

/** Aggregation rule: any required component down => error; any down => degraded; else ok. */
export function aggregateHealth(components: ComponentHealth[]): HealthStatus {
  const requiredDown = components.some((c) => c.required && c.status === 'down');
  if (requiredDown) return HEALTH_STATUS.ERROR;
  const anyDown = components.some((c) => c.status === 'down');
  return anyDown ? HEALTH_STATUS.DEGRADED : HEALTH_STATUS.OK;
}

/** Canonical dev ports (avoid clashes with common system services). */
export const DEV_PORTS = {
  postgres: 15432,
  redis: 16379,
  minioApi: 19000,
  minioConsole: 19001,
} as const;

export const ENV_KEYS = {
  port: 'PORT',
  nodeEnv: 'NODE_ENV',
  logLevel: 'LOG_LEVEL',
  corsOrigin: 'CORS_ORIGIN',
  databaseUrl: 'DATABASE_URL',
  redisUrl: 'REDIS_URL',
  storageHealthUrl: 'STORAGE_HEALTH_URL',
  storageRequired: 'STORAGE_REQUIRED',
} as const;
