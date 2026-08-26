import { PipeTransform } from '@nestjs/common';
import { ZodError, ZodTypeAny, z } from 'zod';
import { ValidationError } from './errors';

/**
 * Validates/parses input against a Zod schema, converting Zod failures into a
 * typed ValidationError (400) with field-level details. Consistent with the
 * project's existing Zod usage (env config), so we avoid class-validator's
 * decorator-metadata complexity.
 */
export class ZodValidationPipe<T extends ZodTypeAny> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    try {
      return this.schema.parse(value);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new ValidationError('Request validation failed', {
          issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        });
      }
      throw err;
    }
  }
}

/** Convenience factory for use in `@Body(zodBody(schema))`. */
export const zodBody = <T extends ZodTypeAny>(schema: T): ZodValidationPipe<T> =>
  new ZodValidationPipe(schema);

/** Convenience factory for use in `@Query(zodQuery(schema))`. */
export const zodQuery = <T extends ZodTypeAny>(schema: T): ZodValidationPipe<T> =>
  new ZodValidationPipe(schema);
