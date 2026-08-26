import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { REQUEST_ID_HEADER, resolveRequestId, runWithRequestContext, logger } from './logger';

/**
 * Registers the request context (request id) for every HTTP request,
 * echoes it back via the response header, and emits structured
 * request/finish log lines with duration.
 */
export function loggingMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = resolveRequestId(req.header(REQUEST_ID_HEADER));
    res.setHeader(REQUEST_ID_HEADER, requestId);
    const startedAt = process.hrtime.bigint();
    const log = logger.child({ http: { method: req.method, url: req.originalUrl } });
    log.info('request started');
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      logger
        .child({
          http: { method: req.method, url: req.originalUrl, statusCode: res.statusCode },
          durationMs,
        })
        .info('request finished');
    });
    runWithRequestContext({ requestId }, () => next());
  };
}
