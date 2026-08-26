import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { pino } from 'pino';
import { REQUEST_ID_HEADER, APP_NAME, APP_VERSION } from '@nexus/shared';

/** Per-request context propagated through the async chain. */
export interface RequestContext {
  requestId: string;
}

const requestStorage = new AsyncLocalStorage<RequestContext>();

export const baseLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { app: APP_NAME, version: APP_VERSION },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

/** Logger that automatically attaches the active request id when present. */
export const logger = {
  child(context: Record<string, unknown> = {}) {
    const reqCtx = requestStorage.getStore();
    return baseLogger.child({ requestId: reqCtx?.requestId, ...context });
  },
};

/** Reads the current request id (or generates a stable fallback for non-HTTP work). */
export function currentRequestId(): string {
  return requestStorage.getStore()?.requestId ?? 'no-request';
}

/** Runs a handler within a request context. Used by middleware and tests. */
export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return requestStorage.run(context, fn);
}

/** Extracts or creates the correlation id and applies it to the response. */
export function resolveRequestId(reqIdHeader: string | undefined): string {
  return reqIdHeader && reqIdHeader.length > 0 ? reqIdHeader : randomUUID();
}

export { REQUEST_ID_HEADER };
