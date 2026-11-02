import { z } from 'zod';

/**
 * Dev-only defaults. They make `npm run dev:api` work with zero config, and
 * production REFUSES every one of them (see `productionRules` below).
 */
export const DEV_JWT_SECRET = 'dev-only-jwt-access-secret-change-in-production-0001';
export const DEV_BOOTSTRAP_EMAIL = 'platform@manhar.local';
export const DEV_BOOTSTRAP_PASSWORD = 'ChangeMe!Dev12345';
export const DEV_DATABASE_URL = 'postgresql://nexus:nexus@localhost:15432/nexus?schema=public';
export const DEV_CORS_ORIGIN = 'http://localhost:5173';
/** Dev-only HMAC key for visitor IP hashes (public registrations, ADR-033). Production refuses it. */
export const DEV_REGISTRATION_IP_SALT = 'dev-only-registration-ip-salt-change-in-production';
/** Public registration POST throttle: per IP, per window (tight; the /auth default is 10/min). */
export const DEFAULT_REGISTRATION_RATE_LIMIT = 5;
export const DEFAULT_REGISTRATION_RATE_TTL_MS = 3_600_000;

/** Production minimums (ADR-028). */
export const PROD_MIN_JWT_SECRET_LENGTH = 64;
export const PROD_MIN_BOOTSTRAP_PASSWORD_LENGTH = 16;
export const PROD_MIN_REGISTRATION_IP_SALT_LENGTH = 32;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '::1']);

const boolFlag = z
  .string()
  .default('false')
  .refine((v) => v === 'true' || v === 'false', { message: 'must be "true" or "false"' })
  .transform((v) => v === 'true');

const boolFlagDefaultTrue = z
  .string()
  .default('true')
  .refine((v) => v === 'true' || v === 'false', { message: 'must be "true" or "false"' })
  .transform((v) => v === 'true');

/** A bare browser origin: scheme + host (+ port), no path/query/trailing slash. */
function parseOrigin(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.origin !== value) return null; // rejects paths, trailing slashes, credentials
    return url;
  } catch {
    return null;
  }
}

/**
 * Environment contract for the API. Invalid env = fail fast at boot.
 * Defaults target the canonical dev topology (see apps/api/.env.example).
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().max(65535).default(3000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    /** Exact browser origin allowed by CORS (credentials:true), e.g. https://app.example.com */
    CORS_ORIGIN: z
      .string()
      .min(1)
      .default(DEV_CORS_ORIGIN)
      .refine((v) => parseOrigin(v) !== null, {
        message: 'must be a bare origin like https://app.example.com (no path, no trailing slash)',
      }),
    DATABASE_URL: z
      .string()
      .min(1)
      .default(DEV_DATABASE_URL)
      .refine((v) => /^postgres(ql)?:\/\//.test(v), {
        message: 'must be a postgresql:// connection string',
      }),
    REDIS_URL: z.string().min(1).default('redis://localhost:16379'),
    // Optional until realtime consumers exist (Phase 8); flip to true then.
    REDIS_REQUIRED: boolFlag,
    STORAGE_HEALTH_URL: z.string().min(1).default('http://localhost:19000/minio/health/live'),
    STORAGE_REQUIRED: boolFlag,
    // Set false on serverless hosts where Redis/Storage are intentionally not
    // provisioned, so /health reports "ok" instead of "degraded".
    HEALTH_INCLUDE_OPTIONAL: boolFlagDefaultTrue,

    // ── Authentication (ADR-004/022/023) ──
    /** HS256 access-token signing secret. Must be strong + overridden in prod. */
    JWT_ACCESS_SECRET: z.string().min(32).default(DEV_JWT_SECRET),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(300),
    REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
    REFRESH_ABSOLUTE_TTL_DAYS: z.coerce.number().int().positive().default(90),
    // Browser-visible path of the refresh cookie. Same-origin deployments that
    // proxy the API under /api must use /api/auth so the cookie is sent back.
    REFRESH_COOKIE_PATH: z
      .string()
      .default('/auth')
      .refine(
        (v) => v.startsWith('/') && !v.includes('?') && !v.includes('#') && (v === '/' || !v.endsWith('/')),
        { message: 'must be an absolute cookie path such as /auth or /api/auth' },
      ),
    // argon2id params (OWASP 2024 floor).
    ARGON2_MEMORY_KIB: z.coerce.number().int().positive().default(19456),
    ARGON2_TIME_COST: z.coerce.number().int().positive().default(2),
    ARGON2_PARALLELISM: z.coerce.number().int().positive().default(1),
    // Per-account lockout.
    AUTH_MAX_FAILED_ATTEMPTS: z.coerce.number().int().positive().default(5),
    AUTH_LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),
    // Coarse per-IP rate limit on /auth (in-memory; Redis-backed later).
    AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(10),
    AUTH_RATE_TTL_MS: z.coerce.number().int().positive().default(60_000),
    // First platform admin, created idempotently by the seed (ADR-022).
    PLATFORM_BOOTSTRAP_EMAIL: z.string().email().default(DEV_BOOTSTRAP_EMAIL),
    PLATFORM_BOOTSTRAP_PASSWORD: z.string().min(12).default(DEV_BOOTSTRAP_PASSWORD),
    // Number of proxy hops to trust for real client IP (0 = don't trust XFF).
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),

    // ── Public registration requests (ADR-033) ──
    /** HMAC key for the stored visitor-IP hash. Dev default is allowed; production must override. */
    REGISTRATION_IP_SALT: z.string().min(16).default(DEV_REGISTRATION_IP_SALT),
    /** Per-IP POST limit on /public/registrations per window (in-memory, per API instance). */
    REGISTRATION_RATE_LIMIT: z.coerce.number().int().positive().default(DEFAULT_REGISTRATION_RATE_LIMIT),
    REGISTRATION_RATE_TTL_MS: z.coerce.number().int().positive().default(DEFAULT_REGISTRATION_RATE_TTL_MS),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    const fail = (key: string, message: string): void => {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message });
    };

    // 1. No development placeholder may survive into production.
    const placeholders: [string, string, string][] = [
      ['JWT_ACCESS_SECRET', env.JWT_ACCESS_SECRET, DEV_JWT_SECRET],
      ['PLATFORM_BOOTSTRAP_PASSWORD', env.PLATFORM_BOOTSTRAP_PASSWORD, DEV_BOOTSTRAP_PASSWORD],
      ['PLATFORM_BOOTSTRAP_EMAIL', env.PLATFORM_BOOTSTRAP_EMAIL, DEV_BOOTSTRAP_EMAIL],
      ['DATABASE_URL', env.DATABASE_URL, DEV_DATABASE_URL],
      ['REGISTRATION_IP_SALT', env.REGISTRATION_IP_SALT, DEV_REGISTRATION_IP_SALT],
    ];
    for (const [key, value, devValue] of placeholders) {
      if (value === devValue) {
        fail(key, `${key} must be overridden in production (development default detected)`);
      }
    }

    // 2. Secret strength (ADR-028: 64+ chars for the signing secret).
    if (env.JWT_ACCESS_SECRET.length < PROD_MIN_JWT_SECRET_LENGTH) {
      fail(
        'JWT_ACCESS_SECRET',
        `JWT_ACCESS_SECRET must be at least ${PROD_MIN_JWT_SECRET_LENGTH} characters in production (ADR-028)`,
      );
    }
    if (env.PLATFORM_BOOTSTRAP_PASSWORD.length < PROD_MIN_BOOTSTRAP_PASSWORD_LENGTH) {
      fail(
        'PLATFORM_BOOTSTRAP_PASSWORD',
        `PLATFORM_BOOTSTRAP_PASSWORD must be at least ${PROD_MIN_BOOTSTRAP_PASSWORD_LENGTH} characters in production`,
      );
    }

    if (env.REGISTRATION_IP_SALT.length < PROD_MIN_REGISTRATION_IP_SALT_LENGTH) {
      fail(
        'REGISTRATION_IP_SALT',
        `REGISTRATION_IP_SALT must be at least ${PROD_MIN_REGISTRATION_IP_SALT_LENGTH} characters in production`,
      );
    }

    // 3. CORS must name the real public HTTPS origin of the web app.
    const origin = parseOrigin(env.CORS_ORIGIN);
    if (origin) {
      if (LOOPBACK_HOSTS.has(origin.hostname)) {
        fail('CORS_ORIGIN', 'CORS_ORIGIN must not be a localhost/loopback origin in production');
      } else if (origin.protocol !== 'https:') {
        fail('CORS_ORIGIN', 'CORS_ORIGIN must use https:// in production (the refresh cookie is Secure)');
      }
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

/** Thrown when the environment is invalid. The message never contains values. */
export class EnvValidationError extends Error {
  constructor(readonly issues: string[], nodeEnv: string) {
    super(
      `Invalid environment configuration (NODE_ENV=${nodeEnv}). Fix the following and restart:\n` +
        issues.map((i) => `  - ${i}`).join('\n'),
    );
    this.name = 'EnvValidationError';
  }
}

/**
 * Parses + validates the raw environment. Returns typed config or throws an
 * `EnvValidationError` listing every problem by variable name (never by value,
 * so secrets cannot leak into logs).
 */
export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const parsed = envSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const issues = parsed.error.issues.map((issue) => {
    const key = issue.path.join('.') || '(root)';
    return issue.message.startsWith(key) ? issue.message : `${key}: ${issue.message}`;
  });
  const nodeEnv = typeof raw.NODE_ENV === 'string' && raw.NODE_ENV ? raw.NODE_ENV : 'development';
  throw new EnvValidationError(issues, nodeEnv);
}
