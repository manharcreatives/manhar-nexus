import { describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import { actorLabel, agoLabel, formatDuration, liveTotalMs, stepDetail, stepLabel } from './timelineFormat';
import type { TimelineStep } from './timelineApi';

const t = i18n.t.bind(i18n);
const step = (over: Partial<TimelineStep> = {}): TimelineStep => ({
  id: 's1',
  kind: 'sent',
  action: 'service_request.sent',
  at: '2026-10-31T10:00:00.000Z',
  actor: { type: 'staff', label: 'Asha' },
  sincePreviousMs: 0,
  sinceStartMs: 0,
  detail: {},
  source: 'activity',
  ...over,
});

describe('formatDuration', () => {
  it('reads seconds, minutes and hours', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(999)).toBe('0s');
    expect(formatDuration(45_000)).toBe('45s');
    expect(formatDuration(125_000)).toBe('2m 05s');
    expect(formatDuration(3_600_000)).toBe('1h 00m');
    expect(formatDuration(3_600_000 + 12 * 60_000 + 59_000)).toBe('1h 12m');
  });
  it('never shows negative or broken numbers', () => {
    expect(formatDuration(-5000)).toBe('0s');
    expect(formatDuration(Number.NaN)).toBe('0s');
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0s');
  });
});

describe('liveTotalMs', () => {
  it('stops at the server total once the order is finished', () => {
    expect(liveTotalMs({ finished: true, totalMs: 600_000 }, 1000, 999_999)).toBe(600_000);
  });
  it('keeps counting from the moment of the response for an open order', () => {
    expect(liveTotalMs({ finished: false, totalMs: 600_000 }, 1000, 31_000)).toBe(630_000);
  });
  it('ignores a clock that moved backwards', () => {
    expect(liveTotalMs({ finished: false, totalMs: 600_000 }, 5000, 1000)).toBe(600_000);
  });
});

describe('labels', () => {
  it('names known steps and falls back to a readable action for unknown ones', () => {
    expect(stepLabel(step({ kind: 'preparing' }), t)).toBe('Preparing');
    expect(stepLabel(step({ kind: 'other', action: 'service_request.table_swapped' }), t)).toBe('Table swapped');
  });
  it('names the actor, the system, or says it was not recorded', () => {
    expect(actorLabel({ type: 'staff', label: 'Asha' }, t)).toBe('Asha');
    expect(actorLabel({ type: 'system', label: null }, t)).toBe('System');
    expect(actorLabel({ type: 'unknown', label: null }, t)).toBe('Not recorded');
  });
  it('summarises edit details and nothing else', () => {
    expect(stepDetail(step({ detail: {} }), t)).toBeNull();
    expect(stepDetail(step({ detail: { editNumber: 2, changeCount: 1, reason: 'Guest changed mind' } }), t)).toBe('Edit 2 - 1 change - Reason: Guest changed mind');
  });
  it('builds the small chip text', () => {
    expect(agoLabel(0, 'under 1 min', t)).toBe('just now');
    expect(agoLabel(12, '12 min', t)).toBe('12 min ago');
  });
});
