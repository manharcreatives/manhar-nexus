import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HEALTH_STATUS, REQUEST_ID_HEADER, type HealthReport } from '@nexus/shared';
import { AppModule } from '../src/app.module';
import { applyHttpDefaults } from '../src/app.factory';
import { DEPENDENCY_PROBES, HealthService, type DependencyProbes } from '../src/health/health.service';

function reportWith(components: HealthReport['components']): HealthReport {
  return {
    status: components.some((c) => c.required && c.status === 'down')
      ? HEALTH_STATUS.ERROR
      : components.some((c) => c.status === 'down')
        ? HEALTH_STATUS.DEGRADED
        : HEALTH_STATUS.OK,
    uptimeSec: 1,
    version: 'test',
    components,
  };
}

const up = (name: string, required = true) => ({ name, status: 'up', required }) as const;
const down = (name: string, required = true) => ({ name, status: 'down', required }) as const;

describe('Nexus API (e2e)', () => {
  let app: INestApplication;

  async function boot(healthReport: HealthReport): Promise<void> {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HealthService)
      .useValue({ getReport: () => Promise.resolve(healthReport) })
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    applyHttpDefaults(app);
    await app.init();
  }

  afterEach(async () => {
    if (app) await app.close();
  });

  it('returns ok/200 with echoed request id when all dependencies are up', async () => {
    await boot(reportWith([up('api'), up('database'), up('redis'), up('storage')]));
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe(HEALTH_STATUS.OK);
    expect(res.headers[REQUEST_ID_HEADER]).toBeDefined();
    expect(res.body.components).toHaveLength(4);
  });

  it('returns degraded/200 when only an optional dependency is down', async () => {
    await boot(
      reportWith([up('api'), up('database'), up('redis'), down('storage', false)]),
    );
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe(HEALTH_STATUS.DEGRADED);
  });

  it('returns error/503 when a required dependency is down', async () => {
    await boot(reportWith([up('api'), down('database'), up('redis'), up('storage')]));
    const res = await request(app.getHttpServer()).get('/health').expect(503);
    expect(res.body.status).toBe(HEALTH_STATUS.ERROR);
  });

  it('propagates an inbound request id instead of generating one', async () => {
    await boot(reportWith([up('api'), up('database'), up('redis'), up('storage')]));
    const res = await request(app.getHttpServer())
      .get('/health')
      .set(REQUEST_ID_HEADER, 'test-correlation-42')
      .expect(200);
    expect(res.headers[REQUEST_ID_HEADER]).toBe('test-correlation-42');
  });

  it('boots the real AppModule offline and reports every dependency down (503)', async () => {
    // Real AppModule + real HTTP stack; only probe IO is replaced with
    // deterministic fast failures so the test never depends on local services
    // or on OS-level TCP timeout behavior. Live probes are verified manually
    // against the portable PostgreSQL cluster (see DEVELOPER_SETUP.md).
    const failingProbes: DependencyProbes = {
      database: () => Promise.reject(new Error('ECONNREFUSED (simulated)')),
      redis: () => Promise.reject(new Error('ECONNREFUSED (simulated)')),
      storage: () => Promise.reject(new Error('ECONNREFUSED (simulated)')),
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DEPENDENCY_PROBES)
      .useValue(failingProbes)
      .compile();
    const rawApp = moduleRef.createNestApplication({ logger: false });
    applyHttpDefaults(rawApp);
    await rawApp.init();
    const res = await request(rawApp.getHttpServer()).get('/health').expect(503);
    expect(res.body.status).toBe(HEALTH_STATUS.ERROR);
    expect(res.headers[REQUEST_ID_HEADER]).toBeDefined();
    const downNames = res.body.components
      .filter((c: { status: string }) => c.status === 'down')
      .map((c: { name: string }) => c.name);
    expect(downNames.sort()).toEqual(['database', 'redis', 'storage']);
    await rawApp.close();
  });
});
