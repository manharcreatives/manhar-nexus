import { z } from 'zod';

/**
 * A JSON-compatible setting value. Intentionally excludes bare `null`: setting
 * values are non-null by convention so "no row" and "null value" never collide
 * in precedence resolution. A definition that genuinely needs null must model
 * it as an object/enum with explicit precedence semantics.
 */
const settingValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.record(z.unknown()),
  z.array(z.unknown()),
]);

export const setSettingSchema = z
  .object({
    value: settingValue,
    /**
     * Optimistic concurrency (ADR-017): the version the client last saw.
     * Omit to force-write; 0 asserts "no row yet"; N asserts current version = N.
     */
    expectedVersion: z.number().int().nonnegative().optional(),
  })
  .strict();
export type SetSettingDto = z.infer<typeof setSettingSchema>;

export const settingScopeQuerySchema = z.object({
  /** Target/override location; absent = business scope. */
  locationId: z.string().uuid().optional(),
});
export type SettingScopeQuery = z.infer<typeof settingScopeQuerySchema>;
