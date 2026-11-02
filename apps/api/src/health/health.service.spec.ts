import type { ConfigService } from '@nestjs/config';
import { HEALTH_STATUS, aggregateHealth, type ComponentHealth } from '@nexus/shared';
import { HealthService, type DependencyProbes } from './health.service';
import type { PrismaService } from '../prisma/prisma.service';

function fakeConfig(overrides: Record<string, unknown> = {}): ConfigService {
  const map = new Map<string, unknown>(Object.entries({ STORAGE_REQUIRED: false, ...overrides }));
  return {
    get: (key: string, defaultValue?: unknown) => map.get(key) ?? defaultValue,
  } as unknown as ConfigService;
}

function fakePrisma(): PrismaService {
  return { $queryRawUnsafe: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } as unknown as PrismaService;
}

const allUpProbes: DependencyProbes = {
  database: jest.fn().mockResolvedValue(undefined),
  redis: jest.fn().mockResolvedValue(undefined),
  storage: jest.fn().mockResolvedValue(undefined),
};

function component(name: string, status: 'up' | 'down', required: boolean): ComponentHealth {
  return { name, status, required };
}

describe('aggregateHealth (shared contract)', () => {
  it('returns ok when everything is up', () => {
    expect(
      aggregateHealth([component('a', 'up', true), component('b', 'up', false)]),
    ).toBe(HEALTH_STATUS.OK);
  });

  it('returns degraded when only an optional component is down', () => {
    expect(
      aggregateHealth([component('a', 'up', true), component('b', 'down', false)]),
    ).toBe(HEALTH_STATUS.DEGRADED);
  });

  it('returns error when a required component is down', () => {
    expect(
      aggregateHealth([component('a', 'up', true), component('b', 'down', true)]),
    ).toBe(HEALTH_STATUS.ERROR);
  });
});

describe('HealthService', () => {
  const build = async (
    probes: DependencyProbes,
    configOverrides: Record<string, unknown> = {},
  ): Promise<HealthService> => {
    return new HealthService(fakePrisma(), fakeConfig(configOverrides), probes);
  };

  it('reports ok with all components up and includes api/database/redis/storage', async () => {
    const service = await build(allUpProbes);
    const report = await service.getReport();
    expect(report.status).toBe(HEALTH_STATUS.OK);
    expect(report.components.map((c) => c.name)).toEqual(['api', 'database', 'redis', 'storage']);
    expect(report.components.every((c) => c.status === 'up')).toBe(true);
  });

  it('omits optional probes when HEALTH_INCLUDE_OPTIONAL=false', async () => {
    const service = await build(
      {
        ...allUpProbes,
        redis: jest.fn().mockRejectedValue(new Error('redis down')),
        storage: jest.fn().mockRejectedValue(new Error('storage down')),
      },
      { HEALTH_INCLUDE_OPTIONAL: false },
    );
    const report = await service.getReport();
    expect(report.status).toBe(HEALTH_STATUS.OK);
    expect(report.components.map((c) => c.name)).toEqual(['api', 'database']);
  });

  it('marks storage as optional by default so its outage only degrades', async () => {
    const service = await build({
      ...allUpProbes,
      storage: jest.fn().mockRejectedValue(new Error('connection refused')),
    });
    const report = await service.getReport();
    expect(report.status).toBe(HEALTH_STATUS.DEGRADED);
    const storage = report.components.find((c) => c.name === 'storage');
    expect(storage?.required).toBe(false);
    expect(storage?.message).toContain('connection refused');
  });

  it('escalates to error when the database is down (required dependency)', async () => {
    const service = await build({
      ...allUpProbes,
      database: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    });
    const report = await service.getReport();
    expect(report.status).toBe(HEALTH_STATUS.ERROR);
  });

  it('propagates STORAGE_REQUIRED=true making storage outage fatal', async () => {
    const service = await build(
      {
        ...allUpProbes,
        storage: jest.fn().mockRejectedValue(new Error('down')),
      },
      { STORAGE_REQUIRED: true },
    );
    const report = await service.getReport();
    expect(report.status).toBe(HEALTH_STATUS.ERROR);
  });

  it('treats redis as optional by default and required when REDIS_REQUIRED=true', async () => {
    const probes = {
      ...allUpProbes,
      redis: jest.fn().mockRejectedValue(new Error('redis down')),
    };
    const optionalReport = await (await build(probes)).getReport();
    expect(optionalReport.status).toBe(HEALTH_STATUS.DEGRADED);

    const strictService = await build(probes, { REDIS_REQUIRED: true });
    expect((await strictService.getReport()).status).toBe(HEALTH_STATUS.ERROR);
  });

  it('records structured failure messages without throwing (redis outage)', async () => {
    const service = await build({
      database: jest.fn().mockResolvedValue(undefined),
      redis: jest.fn().mockRejectedValue(new Error('connect timeout')),
      storage: jest.fn().mockResolvedValue(undefined),
    });
    const report = await service.getReport();
    expect(report.status).toBe(HEALTH_STATUS.DEGRADED);
    expect(report.components.find((c) => c.name === 'redis')?.message).toBe('connect timeout');
  });
});
