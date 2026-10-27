import { describe, expect, it } from 'vitest';
import i18n from '../i18n';
import { exampleDate, exampleTime, friendlyValue, settingText } from './display';

const t = i18n.t.bind(i18n);
const when = new Date(2026, 9, 27, 16, 5);

describe('settings display', () => {
  it('labels known settings in plain words without keys or jargon', () => {
    const s = settingText(t, 'core', 'locale', 'Display locale (BCP-47 language tag).');
    expect(s.title).toBe('Language');
    expect(`${s.title} ${s.hint}`).not.toMatch(/BCP|ADR|locale/i);
    expect(settingText(t, 'core', 'rounding_mode', 'Monetary rounding mode applied at defined points (ADR-015).').hint).not.toMatch(/ADR/);
  });
  it('falls back to a title-cased key and a description without asides for unknown settings', () => {
    expect(settingText(t, 'x', 'table_hold_minutes', 'How long a table is held (ADR-099).')).toEqual({
      title: 'Table hold minutes',
      hint: 'How long a table is held',
    });
  });
  it('shows formats as worked examples', () => {
    expect(exampleDate('dd/MM/yyyy', when)).toBe('27/10/2026');
    expect(exampleDate('MM/dd/yyyy', when)).toBe('10/27/2026');
    expect(exampleTime('24h', when)).toBe('16:05');
    expect(exampleTime('12h', when)).toBe('4:05 pm');
    expect(friendlyValue(t, 'core', 'date_format', 'dd/MM/yyyy', when)).toBe('e.g. 27/10/2026');
    expect(friendlyValue(t, 'core', 'rounding_mode', 'nearest')).toBe('Round to the nearest paisa');
    expect(friendlyValue(t, 'other', 'date_format', 'dd/MM/yyyy')).toBeNull();
  });
});
