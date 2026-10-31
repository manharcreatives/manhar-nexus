import {
  DEV_BOOTSTRAP_EMAIL,
  DEV_BOOTSTRAP_PASSWORD,
  DEV_DATABASE_URL,
  DEV_JWT_SECRET,
  DEV_REGISTRATION_IP_SALT,
  EnvValidationError,
  validateEnv,
} from './configuration';

/** A production environment that satisfies every rule (throwaway values). */
function goodProd(overrides: Record<string, string | undefined> = {}): Record<string, unknown> {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://nexus_app:not-a-real-password@db.internal:5432/nexus?schema=public',
    CORS_ORIGIN: 'https://app.example.com',
    JWT_ACCESS_SECRET: 'x'.repeat(64),
    PLATFORM_BOOTSTRAP_EMAIL: 'ops@example.com',
    PLATFORM_BOOTSTRAP_PASSWORD: 'a-long-unique-bootstrap-pass',
    TRUST_PROXY: '1',
    REGISTRATION_IP_SALT: 's'.repeat(40),
    ...overrides,
  };
}

function issuesOf(raw: Record<string, unknown>): string[] {
  try {
    validateEnv(raw);
  } catch (e) {
    if (e instanceof EnvValidationError) return e.issues;
    throw e;
  }
  return [];
}

describe('validateEnv', () => {
  describe('development / test', () => {
    it('boots with zero configuration using dev defaults', () => {
      const env = validateEnv({});
      expect(env.NODE_ENV).toBe('development');
      expect(env.PORT).toBe(3000);
      expect(env.JWT_ACCESS_SECRET).toBe(DEV_JWT_SECRET);
      expect(env.DATABASE_URL).toBe(DEV_DATABASE_URL);
      expect(env.REDIS_REQUIRED).toBe(false);
    });

    it('accepts the dev defaults in test mode', () => {
      expect(() => validateEnv({ NODE_ENV: 'test' })).not.toThrow();
    });

    it('defaults the registration salt and throttle in development (ADR-033)', () => {
      const env = validateEnv({});
      expect(env.REGISTRATION_IP_SALT).toBe(DEV_REGISTRATION_IP_SALT);
      expect(env.REGISTRATION_RATE_LIMIT).toBe(5);
      expect(env.REGISTRATION_RATE_TTL_MS).toBe(3_600_000);
    });

    it('coerces numbers and boolean flags', () => {
      const env = validateEnv({ PORT: '3100', REDIS_REQUIRED: 'true', TRUST_PROXY: '2' });
      expect(env.PORT).toBe(3100);
      expect(env.REDIS_REQUIRED).toBe(true);
      expect(env.TRUST_PROXY).toBe(2);
    });

    it('still fails fast on malformed values', () => {
      const issues = issuesOf({
        PORT: 'abc',
        NODE_ENV: 'prod',
        REDIS_REQUIRED: 'yes',
        DATABASE_URL: 'mysql://x',
        CORS_ORIGIN: 'http://localhost:5173/',
        JWT_ACCESS_SECRET: 'short',
      });
      const keys = issues.map((i) => i.split(':')[0]);
      expect(keys).toEqual(
        expect.arrayContaining([
          'PORT',
          'NODE_ENV',
          'REDIS_REQUIRED',
          'DATABASE_URL',
          'CORS_ORIGIN',
          'JWT_ACCESS_SECRET',
        ]),
      );
    });
  });

  describe('production', () => {
    it('accepts a fully specified production environment', () => {
      const env = validateEnv(goodProd());
      expect(env.NODE_ENV).toBe('production');
      expect(env.CORS_ORIGIN).toBe('https://app.example.com');
    });

    it('refuses to boot on dev defaults when nothing is configured', () => {
      const issues = issuesOf({ NODE_ENV: 'production' });
      const joined = issues.join('\n');
      expect(joined).toMatch(/JWT_ACCESS_SECRET must be overridden/);
      expect(joined).toMatch(/PLATFORM_BOOTSTRAP_PASSWORD must be overridden/);
      expect(joined).toMatch(/PLATFORM_BOOTSTRAP_EMAIL must be overridden/);
      expect(joined).toMatch(/DATABASE_URL must be overridden/);
      expect(joined).toMatch(/CORS_ORIGIN must not be a localhost/);
    });

    it('refuses the dev JWT secret even if explicitly set', () => {
      expect(issuesOf(goodProd({ JWT_ACCESS_SECRET: DEV_JWT_SECRET })).join()).toMatch(
        /JWT_ACCESS_SECRET must be overridden/,
      );
    });

    it('refuses a JWT secret shorter than 32 chars (all envs) and 64 chars (production)', () => {
      expect(issuesOf(goodProd({ JWT_ACCESS_SECRET: 'y'.repeat(31) })).join()).toMatch(
        /JWT_ACCESS_SECRET/,
      );
      expect(issuesOf(goodProd({ JWT_ACCESS_SECRET: 'y'.repeat(63) })).join()).toMatch(
        /at least 64 characters/,
      );
    });

    it('refuses the dev bootstrap password ChangeMe!Dev12345', () => {
      const issues = issuesOf(goodProd({ PLATFORM_BOOTSTRAP_PASSWORD: DEV_BOOTSTRAP_PASSWORD }));
      expect(issues.join()).toMatch(/PLATFORM_BOOTSTRAP_PASSWORD must be overridden/);
    });

    it('refuses a short bootstrap password', () => {
      expect(issuesOf(goodProd({ PLATFORM_BOOTSTRAP_PASSWORD: 'Short!Pass12' })).join()).toMatch(
        /PLATFORM_BOOTSTRAP_PASSWORD must be at least 16/,
      );
    });

    it('requires a real REGISTRATION_IP_SALT (ADR-033): unset, dev default or short is refused', () => {
      expect(issuesOf(goodProd({ REGISTRATION_IP_SALT: undefined })).join()).toMatch(
        /REGISTRATION_IP_SALT must be overridden/,
      );
      expect(issuesOf(goodProd({ REGISTRATION_IP_SALT: DEV_REGISTRATION_IP_SALT })).join()).toMatch(
        /REGISTRATION_IP_SALT must be overridden/,
      );
      expect(issuesOf(goodProd({ REGISTRATION_IP_SALT: 'z'.repeat(31) })).join()).toMatch(
        /REGISTRATION_IP_SALT must be at least 32/,
      );
    });

    it('refuses the dev bootstrap email', () => {
      expect(issuesOf(goodProd({ PLATFORM_BOOTSTRAP_EMAIL: DEV_BOOTSTRAP_EMAIL })).join()).toMatch(
        /PLATFORM_BOOTSTRAP_EMAIL must be overridden/,
      );
    });

    it.each(['http://localhost:5173', 'https://localhost', 'https://127.0.0.1:8443', 'http://[::1]:5173'])(
      'refuses loopback CORS origin %s',
      (origin) => {
        expect(issuesOf(goodProd({ CORS_ORIGIN: origin })).join()).toMatch(/CORS_ORIGIN/);
      },
    );

    it('refuses a plain-http public CORS origin', () => {
      expect(issuesOf(goodProd({ CORS_ORIGIN: 'http://app.example.com' })).join()).toMatch(
        /must use https/,
      );
    });

    it('refuses the dev DATABASE_URL', () => {
      expect(issuesOf(goodProd({ DATABASE_URL: DEV_DATABASE_URL })).join()).toMatch(
        /DATABASE_URL must be overridden/,
      );
    });

    it('treats an empty value as missing', () => {
      expect(issuesOf(goodProd({ CORS_ORIGIN: '' })).join()).toMatch(/CORS_ORIGIN/);
    });

    it('never echoes secret values in the error message', () => {
      const secret = 'S3cr3t-'.repeat(4); // 28 chars: too short
      try {
        validateEnv(goodProd({ JWT_ACCESS_SECRET: secret, PLATFORM_BOOTSTRAP_PASSWORD: 'tiny' }));
        throw new Error('expected validation to fail');
      } catch (e) {
        expect(e).toBeInstanceOf(EnvValidationError);
        const message = (e as Error).message;
        expect(message).toContain('NODE_ENV=production');
        expect(message).not.toContain(secret);
        expect(message).not.toContain('tiny');
      }
    });
  });
});
