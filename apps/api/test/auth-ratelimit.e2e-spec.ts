// Set the low rate limit BEFORE the app's ConfigModule loads (module-load time),
// so this dedicated app boots with a small /auth throttle we can trip.
process.env.AUTH_RATE_LIMIT = '3';
process.env.AUTH_RATE_TTL_MS = '60000';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';

/** Proves the coarse per-IP rate limit on /auth (ADR-023), Redis-free. */
describe('Auth rate limiting (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    applyHttpDefaults(app);
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('returns 429 once the per-window login limit is exceeded', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `ratelimit@nowhere.test`, password: 'x' });
      statuses.push(res.status);
    }
    // First few pass through to auth (401), then the limiter kicks in (429).
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
  });
});
