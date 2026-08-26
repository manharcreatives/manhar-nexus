import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  aggregateHealth,
  APP_VERSION,
  type ComponentHealth,
  type HealthReport,
} from '@nexus/shared';
import { PrismaService } from '../prisma/prisma.service';

const CHECK_TIMEOUT_MS = 2000;

/** Injectable dependency probes so tests never touch real infrastructure. */
export interface DependencyProbes {
  database(): Promise<void>;
  redis(): Promise<void>;
  storage(): Promise<void>;
}

/** DI token for the active probe set (overridable in tests). */
export const DEPENDENCY_PROBES = Symbol('DEPENDENCY_PROBES');

async function withTimeout(
  operation: () => Promise<void>,
  timeoutMessage: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  let timer: NodeJS.Timeout | undefined;
  const operationPromise = operation();
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMessage)), CHECK_TIMEOUT_MS);
  });
  // Whichever promise loses the race must never surface as an
  // unhandled rejection (e.g. Prisma rejecting seconds after our timer won).
  operationPromise.catch(() => {});
  timeoutPromise.catch(() => {});
  try {
    await Promise.race([operationPromise, timeoutPromise]);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(DEPENDENCY_PROBES) private readonly probes: DependencyProbes,
  ) {}

  async getReport(): Promise<HealthReport> {
    const components: ComponentHealth[] = [
      { name: 'api', status: 'up', required: true },
      await this.check('database', true, () => this.probes.database()),
      await this.check('redis', this.config.get<boolean>('REDIS_REQUIRED', false), () =>
        this.probes.redis(),
      ),
      await this.check('storage', this.config.get<boolean>('STORAGE_REQUIRED', false), () =>
        this.probes.storage(),
      ),
    ];
    return {
      status: aggregateHealth(components),
      uptimeSec: Math.floor((Date.now() - this.startedAt) / 1000),
      version: APP_VERSION,
      components,
    };
  }

  private async check(
    name: string,
    required: boolean,
    probe: () => Promise<void>,
  ): Promise<ComponentHealth> {
    const result = await withTimeout(probe, `${name} check timed out`);
    return result.ok
      ? { name, status: 'up', required }
      : { name, status: 'down', required, message: result.message };
  }
}

/** Real infrastructure probes. Kept stateless; each probe opens/closes its own connection. */
export function createDefaultProbes(prisma: PrismaService, config: ConfigService): DependencyProbes {
  return {
    async database() {
      await prisma.$queryRawUnsafe('SELECT 1');
    },
    async redis() {
      const url = config.get<string>('REDIS_URL', 'redis://localhost:16379');
      const client = new Redis(url, {
        lazyConnect: true,
        connectTimeout: CHECK_TIMEOUT_MS,
        maxRetriesPerRequest: 0,
        enableOfflineQueue: false,
        retryStrategy: () => null,
      });
      // Without an 'error' listener, ioredis failures crash the process.
      client.on('error', () => {});
      try {
        await client.connect();
        const pong = await client.ping();
        if (pong !== 'PONG') throw new Error(`unexpected PING reply: ${String(pong)}`);
      } finally {
        client.disconnect();
      }
    },
    async storage() {
      const url = config.get<string>(
        'STORAGE_HEALTH_URL',
        'http://localhost:19000/minio/health/live',
      );
      const response = await fetch(url, { signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) });
      if (!response.ok) throw new Error(`storage health responded ${response.status}`);
    },
  };
}
