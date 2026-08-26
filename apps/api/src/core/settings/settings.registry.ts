import { Injectable } from '@nestjs/common';
import { z, type ZodTypeAny } from 'zod';
import { SettingValueType } from '@prisma/client';

/** One typed, defaulted setting the platform knows about. */
export interface SettingDefinition {
  namespace: string;
  key: string;
  valueType: SettingValueType;
  /** Value validator — the source of truth for what is a legal value. */
  schema: ZodTypeAny;
  /** Effective value when neither location nor business has set one. */
  default: unknown;
  description: string;
  /**
   * When true, the raw value is never written into the immutable audit chain
   * (only a redaction marker is recorded), so secrets/PII can't become
   * permanently un-redactable history. Core settings are non-sensitive.
   */
  sensitive?: boolean;
}

/** Fully-qualified id for a setting definition. */
export const settingId = (namespace: string, key: string): string => `${namespace}.${key}`;

/**
 * The typed setting catalog. Core registers vertical-neutral settings here;
 * modules will register their own definitions in later phases (the engine is
 * the extension seam, so new settings never require engine changes).
 *
 * Unknown (namespace,key) pairs are rejected on write — configuration is typed,
 * not a free-form key-value bag.
 */
@Injectable()
export class SettingsRegistry {
  private readonly defs = new Map<string, SettingDefinition>();

  constructor() {
    this.register(CORE_SETTINGS);
  }

  register(definitions: SettingDefinition[]): void {
    for (const def of definitions) {
      const id = settingId(def.namespace, def.key);
      if (this.defs.has(id)) {
        throw new Error(`Duplicate setting definition: ${id}`);
      }
      this.defs.set(id, def);
    }
  }

  get(namespace: string, key: string): SettingDefinition | undefined {
    return this.defs.get(settingId(namespace, key));
  }

  list(namespace?: string): SettingDefinition[] {
    const all = [...this.defs.values()];
    return namespace ? all.filter((d) => d.namespace === namespace) : all;
  }
}

/** Vertical-neutral core settings available to every business. */
export const CORE_SETTINGS: SettingDefinition[] = [
  {
    namespace: 'core',
    key: 'locale',
    valueType: SettingValueType.STRING,
    schema: z.string().min(2).max(10),
    default: 'en',
    description: 'Display locale (BCP-47 language tag).',
  },
  {
    namespace: 'core',
    key: 'date_format',
    valueType: SettingValueType.STRING,
    schema: z.string().min(1).max(32),
    default: 'dd/MM/yyyy',
    description: 'Preferred date display format.',
  },
  {
    namespace: 'core',
    key: 'time_format',
    valueType: SettingValueType.STRING,
    schema: z.enum(['12h', '24h']),
    default: '24h',
    description: 'Clock format for time display.',
  },
  {
    namespace: 'core',
    key: 'rounding_mode',
    valueType: SettingValueType.STRING,
    schema: z.enum(['nearest', 'up', 'down']),
    default: 'nearest',
    description: 'Monetary rounding mode applied at defined points (ADR-015).',
  },
];
