import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * On serverless (Vercel) every function instance opens its own Prisma pool. Behind Neon's pooler (PgBouncer) the
 * default pool size multiplies across instances and exhausts connections, so a pooled URL gets connection_limit=1
 * unless the operator already set one. Local, Docker and CI (direct URLs, long-lived process) are untouched.
 */
export function withServerlessPoolLimit(url: string | undefined, env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (!url || !env.VERCEL) return url;
  const pooled = /-pooler\./.test(url) || /[?&]pgbouncer=true/.test(url);
  if (!pooled || /[?&]connection_limit=/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}connection_limit=1`;
}

/**
 * Prisma access layer. Connection is LAZY: the API must boot and serve /health
 * even when PostgreSQL is down (health reports the truth instead of crashing).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const url = withServerlessPoolLimit(process.env.DATABASE_URL);
    super(url && url !== process.env.DATABASE_URL ? { datasources: { db: { url } } } : undefined);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
