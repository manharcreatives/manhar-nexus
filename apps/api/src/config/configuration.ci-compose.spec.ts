import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EnvValidationError, validateEnv } from './configuration';

/**
 * The "Docker images + compose boot" CI job writes deploy/api.env and boots the production image. Production mode
 * refuses the development registration salt, so a missing REGISTRATION_IP_SALT made the API container exit and the job
 * fail with "container nexus-api-1 is unhealthy" (it was hidden for days because an earlier job was red).
 */
const CI_ENV = {
  NODE_ENV: 'production',
  LOG_LEVEL: 'info',
  CORS_ORIGIN: 'https://nexus.ci.test',
  DATABASE_URL: 'postgresql://nexus_app:abc123@postgres:5432/nexus?schema=public',
  DATABASE_URL_UNPOOLED: 'postgresql://nexus_app:abc123@postgres:5432/nexus?schema=public',
  JWT_ACCESS_SECRET: 'a'.repeat(96),
  PLATFORM_BOOTSTRAP_EMAIL: 'ci-admin@example.com',
  PLATFORM_BOOTSTRAP_PASSWORD: 'b'.repeat(32),
  TRUST_PROXY: '1',
};

describe('the production environment the CI compose job generates', () => {
  it('is accepted when it carries a 48-character registration salt (openssl rand -hex 24)', () => {
    expect(() => validateEnv({ ...CI_ENV, REGISTRATION_IP_SALT: 'c'.repeat(48) })).not.toThrow();
  });

  it('is refused without a salt: the API would not boot', () => {
    expect(() => validateEnv(CI_ENV)).toThrow(EnvValidationError);
  });

  it('ci.yml writes the salt into deploy/api.env', () => {
    const ci = readFileSync(resolve(__dirname, '../../../../.github/workflows/ci.yml'), 'utf8');
    const apiEnvBlock = ci.slice(ci.indexOf('NODE_ENV=production'), ci.indexOf('} > deploy/api.env'));
    expect(apiEnvBlock).toContain('REGISTRATION_IP_SALT=');
  });
});
