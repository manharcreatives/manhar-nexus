import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** Recursively convert BigInt values to strings so responses are JSON-safe. */
export function jsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    // Objects with toJSON() (e.g. Prisma Decimal) self-serialize — call it and
    // recursively process the result rather than iterating internal properties.
    const obj = value as Record<string, unknown>;
    if (typeof obj.toJSON === 'function') {
      return jsonSafe((obj.toJSON as () => unknown)());
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = jsonSafe(v);
    return out;
  }
  return value;
}

/**
 * Express' JSON serializer throws on BigInt. Prisma returns BigInt for our
 * `sequence`/`nextValue` columns, so we normalize every response body once here
 * instead of mapping in each controller.
 */
@Injectable()
export class SerializeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => jsonSafe(data)));
  }
}
