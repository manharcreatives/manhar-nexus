import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './common/domain-exception.filter';
import { SerializeInterceptor } from './common/serialize.interceptor';
import { loggingMiddleware } from './logging/logging.middleware';

/**
 * Shared HTTP defaults applied identically to production bootstrap and tests,
 * guaranteeing the e2e suite exercises the real middleware stack.
 */
export function applyHttpDefaults(app: INestApplication): void {
  // Trust exactly the configured number of proxy hops so req.ip is the real
  // client behind an ingress/LB (rate-limit + login telemetry correctness).
  // 0 (default) = don't trust XFF; set to the ingress hop count in production.
  const trustProxy = Number(process.env.TRUST_PROXY ?? 0);
  app.getHttpAdapter().getInstance().set('trust proxy', trustProxy);
  // credentials:true so the httpOnly refresh cookie flows on the allowed origin.
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173', credentials: true });
  app.use(cookieParser());
  app.use(loggingMiddleware());
  app.useGlobalInterceptors(new SerializeInterceptor());
  app.useGlobalFilters(new DomainExceptionFilter());
}

/** Production bootstrap path. */
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { logger: false });
  applyHttpDefaults(app);
  return app;
}
