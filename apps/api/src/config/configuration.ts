import { z } from 'zod';

/** Dev-only defaults; production MUST override (enforced by superRefine below). */
const DEV_JWT_SECRET = 'dev-only-jwt-access-secret-change-in-production-0001';
const DEV_BOOTSTRAP_EMAIL = 'platform@manhar.local';
const DEV_BOOTSTRAP_PASSWORD = 'ChangeMe!Dev12345';

/**
 * Environment contract for the API. Invalid env = fail fast at boot.
 * Defaults target the canonical dev topology (see .env.example / docker-compose.dev.yml).
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
    DATABASE_URL: z
      .string()
      .min(1)
      .default('postgresql://nexus:nexus@localhost:15432/nexus?schema=public'),
    REDIS_URL: z.string().min(1).default('redis://localhost:16379'),
    // Optional until realtime consumers exist (Phase 8); flip to true then.
    REDIS_REQUIRED: z
      .string()
      .default('false')
      .transform((v) => v === 'true'),
    STORAGE_HEALTH_URL: z.string().min(1).default('http://localhost:19000/minio/health/live'),
    STORAGE_REQUIRED: z
      .string()
      .default('false')
      .transform((v) => v === 'true'),

    // ── Authentication (ADR-004/022/023) ──
    /** HS256 access-token signing secret. Must be strong + overridden in prod. */
    JWT_ACCESS_SECRET: z.string().min(32).default(DEV_JWT_SECRET),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(300),
    REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
    REFRESH_ABSOLUTE_TTL_DAYS: z.coerce.number().int().positive().default(90),
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
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    // Production must not run on dev placeholder secrets/credentials.
    const weak: [keyof typeof env, unknown, unknown][] = [
      ['JWT_ACCESS_SECRET', env.JWT_ACCESS_SECRET, DEV_JWT_SECRET],
      ['PLATFORM_BOOTSTRAP_PASSWORD', env.PLATFORM_BOOTSTRAP_PASSWORD, DEV_BOOTSTRAP_PASSWORD],
      ['PLATFORM_BOOTSTRAP_EMAIL', env.PLATFORM_BOOTSTRAP_EMAIL, DEV_BOOTSTRAP_EMAIL],
    ];
    // Production JWT secret must be at least 64 characters (ADR-028).
    if (env.JWT_ACCESS_SECRET.length < 64) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_ACCESS_SECRET'],
        message: 'JWT_ACCESS_SECRET must be at least 64 characters in production (ADR-028)',
      });
    }
    for (const [key, value, devValue] of weak) {
      if (value === devValue) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${String(key)} must be overridden in production (dev placeholder detected)`,
        });
      }
    }
  });

export type AppEnv = z.infer<typeof envSchema>;
