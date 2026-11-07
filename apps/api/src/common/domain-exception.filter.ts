import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { REQUEST_ID_HEADER } from '@nexus/shared';
import { logger } from '../logging/logger';
import { redactUrl } from '../logging/redact-url';
import { DomainError } from './errors';

/** Stable error envelope returned for every failed request. */
interface ErrorBody {
  statusCode: number;
  error: { code: string; message: string; details?: Record<string, unknown> };
  requestId?: string;
}

/**
 * Translates DomainErrors and HttpExceptions into a single stable envelope.
 * Unknown errors become 500 without leaking internals (message is generic;
 * the real error is logged with the request id for correlation).
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = res.getHeader(REQUEST_ID_HEADER)?.toString() ?? undefined;

    const body = this.toBody(exception, requestId);
    if (body.statusCode >= 500) {
      // Log via the project's structured logger (the Nest logger is disabled),
      // so server errors are never silently swallowed.
      logger.child({ err: exception, http: { method: req.method, url: redactUrl(req.originalUrl) } }).error(
        'unhandled error',
      );
    }
    // Rate-limit errors (429) carry details.retryAfterSeconds: surface it as the standard header too.
    const retryAfter = (body.error.details as { retryAfterSeconds?: unknown } | undefined)?.retryAfterSeconds;
    if (body.statusCode === 429 && typeof retryAfter === 'number' && retryAfter > 0 && !res.headersSent) {
      res.setHeader('Retry-After', String(Math.ceil(retryAfter)));
    }
    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown, requestId?: string): ErrorBody {
    if (exception instanceof DomainError) {
      return {
        statusCode: exception.httpStatus,
        error: { code: exception.code, message: exception.message, details: exception.details },
        requestId,
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const rawMessage =
        typeof response === 'string'
          ? response
          : (response as { message?: unknown }).message;
      // Nest validation errors carry `message` as a string[]; keep it structured.
      const message = Array.isArray(rawMessage)
        ? rawMessage.join('; ')
        : (rawMessage?.toString() ?? exception.message);
      return {
        statusCode: status,
        error: { code: this.httpCode(status), message },
        requestId,
      };
    }
    // The body parser (express) rejects before Nest sees the request and throws a plain error with a status and a type.
    const parsed = this.bodyParserError(exception);
    if (parsed) return { statusCode: parsed.status, error: { code: parsed.code, message: parsed.message }, requestId };
    return {
      statusCode: 500,
      error: { code: 'INTERNAL', message: 'Internal server error' },
      requestId,
    };
  }

  /** Oversized, unparseable or wrongly-encoded bodies are the sender's fault: 4xx with a generic message, no stack. */
  private bodyParserError(exception: unknown): { status: number; code: string; message: string } | null {
    const e = exception as { type?: unknown; status?: unknown; statusCode?: unknown } | null;
    if (!e || typeof e !== 'object' || typeof e.type !== 'string') return null;
    const status = typeof e.status === 'number' ? e.status : typeof e.statusCode === 'number' ? e.statusCode : 0;
    switch (e.type) {
      case 'entity.too.large':
        return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'The request is too large.' };
      case 'entity.parse.failed':
      case 'entity.verify.failed':
        return { status: 400, code: 'BAD_REQUEST', message: 'The request body could not be read.' };
      case 'encoding.unsupported':
      case 'charset.unsupported':
        return { status: 415, code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Unsupported content encoding.' };
      default:
        return status >= 400 && status < 500 && e.type.startsWith('request.') ? { status, code: 'BAD_REQUEST', message: 'The request could not be read.' } : null;
    }
  }

  private httpCode(status: number): string {
    switch (status) {
      case 400:
        return 'BAD_REQUEST';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 413:
        return 'PAYLOAD_TOO_LARGE';
      default:
        return status >= 500 ? 'INTERNAL' : 'ERROR';
    }
  }
}
