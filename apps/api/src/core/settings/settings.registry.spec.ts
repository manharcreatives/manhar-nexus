import { z } from 'zod';
import { SettingValueType } from '@prisma/client';
import { SettingsRegistry, type SettingDefinition } from './settings.registry';

describe('SettingsRegistry', () => {
  it('ships the core namespace defaults', () => {
    const registry = new SettingsRegistry();
    const core = registry.list('core');
    expect(core.length).toBeGreaterThan(0);
    expect(registry.get('core', 'time_format')?.default).toBe('24h');
    expect(registry.get('core', 'rounding_mode')?.valueType).toBe(SettingValueType.STRING);
  });

  it('returns undefined for unknown settings', () => {
    const registry = new SettingsRegistry();
    expect(registry.get('core', 'nope')).toBeUndefined();
    expect(registry.get('unknown', 'x')).toBeUndefined();
  });

  it('lets modules register more definitions', () => {
    const registry = new SettingsRegistry();
    const defs: SettingDefinition[] = [
      {
        namespace: 'catalog',
        key: 'allow_negative_stock',
        valueType: SettingValueType.BOOLEAN,
        schema: z.boolean(),
        default: false,
        description: 'test',
      },
    ];
    registry.register(defs);
    expect(registry.get('catalog', 'allow_negative_stock')?.default).toBe(false);
  });

  it('rejects duplicate definitions', () => {
    const registry = new SettingsRegistry();
    expect(() =>
      registry.register([
        {
          namespace: 'core',
          key: 'time_format',
          valueType: SettingValueType.STRING,
          schema: z.string(),
          default: '24h',
          description: 'dup',
        },
      ]),
    ).toThrow(/Duplicate setting/);
  });
});
