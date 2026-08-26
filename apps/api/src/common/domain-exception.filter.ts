import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { REQUEST_ID_HEADER } from '@nexus/shared';
import { logger } from '../logging/logger';
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
      logger.child({ err: exception, http: { method: req.method, url: req.originalUrl } }).error(
        'unhandled error',
      );
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
    return {
      statusCode: 500,
      error: { code: 'INTERNAL', message: 'Internal server error' },
      requestId,
    };
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
      default:
        return status >= 500 ? 'INTERNAL' : 'ERROR';
    }
  }
}
