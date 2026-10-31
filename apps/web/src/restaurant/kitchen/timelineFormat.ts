import type { TFunction } from 'i18next';
import { titleCaseKey } from '../../lib/humanize';
import type { OrderTimelineResponse, TimelineKind, TimelineStep } from './timelineApi';

/** 45s, 3m 05s, 1h 12m. Whole numbers only; negative or non-finite input reads as 0s. */
export function formatDuration(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  if (m < 60) {
    const s = total % 60;
    return `${m}m ${String(s).padStart(2, '0')}s`;
  }
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

const KNOWN: ReadonlySet<TimelineKind> = new Set(['created', 'items_changed', 'sent', 'edited', 'accepted', 'preparing', 'ready', 'served', 'cancelled', 'item_cancelled']);

/** Human wording for a step; unknown future actions fall back to the title-cased audit action. */
export function stepLabel(step: Pick<TimelineStep, 'kind' | 'action'>, t: TFunction): string {
  if (KNOWN.has(step.kind)) return t(`restaurant.kitchenTimeline.steps.${step.kind}`);
  const name = step.action.includes('.') ? step.action.slice(step.action.indexOf('.') + 1) : step.action;
  return titleCaseKey(name);
}

export function actorLabel(actor: TimelineStep['actor'], t: TFunction): string {
  if (actor.type === 'system') return actor.label ? actor.label : t('restaurant.kitchenTimeline.actorSystem');
  if (actor.label) return actor.label;
  return t('restaurant.kitchenTimeline.actorUnknown');
}

/** One short line of extra facts (never prices), or null. */
export function stepDetail(step: TimelineStep, t: TFunction): string | null {
  const d = step.detail;
  const parts: string[] = [];
  if (d.editNumber !== undefined) parts.push(t('restaurant.kitchenTimeline.detailEdit', { n: d.editNumber }));
  if (d.changeCount !== undefined) parts.push(t('restaurant.kitchenTimeline.detailChanges', { count: d.changeCount }));
  if (d.lineCount !== undefined) parts.push(t('restaurant.kitchenTimeline.detailItems', { count: d.lineCount }));
  if (d.reason) parts.push(t('restaurant.kitchenTimeline.detailReason', { reason: d.reason }));
  return parts.length > 0 ? parts.join(' - ') : null;
}

/**
 * Total elapsed time. For a finished order the server value is final; for an open one it keeps growing from the
 * moment the response was received (client clock only measures the gap since `fetchedAtMs`, never the absolute time).
 */
export function liveTotalMs(tl: Pick<OrderTimelineResponse, 'finished' | 'totalMs'>, fetchedAtMs: number, nowMs: number): number {
  if (tl.finished) return tl.totalMs;
  return tl.totalMs + Math.max(0, nowMs - fetchedAtMs);
}

/** Label for the clickable chip on a ticket: "12m ago" / "just now". `elapsed` comes from restaurant/time.formatElapsed. */
export function agoLabel(mins: number, elapsed: string, t: TFunction): string {
  return mins < 1 ? t('restaurant.kitchenTimeline.justNow') : t('restaurant.kitchenTimeline.ago', { elapsed });
}
