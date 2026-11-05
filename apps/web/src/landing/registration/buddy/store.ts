import { useSyncExternalStore } from 'react';
import type { RegistrationFieldName } from '../../content';

/**
 * What the registration form tells Manhar Bot. The form only reports facts (a field was focused, a value was
 * accepted or rejected); how the bot feels about them lives in content.ts.
 */
export type BuddyEvent =
  | { type: 'welcome' }
  | { type: 'focus'; field: RegistrationFieldName }
  | { type: 'typing'; field: 'phone'; digits: number; valid: boolean }
  | { type: 'valid'; field: RegistrationFieldName }
  | { type: 'invalid'; field: RegistrationFieldName }
  | { type: 'consent'; checked: boolean }
  | { type: 'submit' }
  | { type: 'success'; referenceCode: string }
  | { type: 'failure'; kind: 'rate-limit' | 'already-received' | 'network' | 'server' | 'validation' }
  /** The bot leads: it names the next field to fill. `first` is the opening ask, `again` a patient reminder. */
  | { type: 'ask'; field: RegistrationFieldName; first?: boolean; again?: boolean }
  /** Everything required is filled in: press Send. */
  | { type: 'ready' };

export interface BuddyState {
  event: BuddyEvent;
  /** Bumps on every event so a repeat of the same event still re-animates the bubble. */
  seq: number;
}

let state: BuddyState = { event: { type: 'welcome' }, seq: 0 };
const listeners = new Set<() => void>();

/** The bot itself moved the cursor to this field; the focus event that follows is not the visitor's choice. */
let guided: { field: RegistrationFieldName; until: number } | null = null;
export function expectGuidedFocus(field: RegistrationFieldName): void {
  guided = { field, until: Date.now() + 400 };
}

export function emitBuddy(event: BuddyEvent): void {
  if (event.type === 'focus' && guided && guided.field === event.field && Date.now() < guided.until) {
    guided = null;
    return;
  }
  state = { event, seq: state.seq + 1 };
  listeners.forEach((l) => l());
}

export function resetBuddy(): void {
  guided = null;
  state = { event: { type: 'welcome' }, seq: 0 };
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void): (() => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const snapshot = (): BuddyState => state;

export function useBuddyState(): BuddyState {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** The order the bot walks the visitor through. Type of business and the note keep their defaults / are optional. */
export const GUIDE_ORDER = ['restaurantName', 'contactName', 'phone', 'email', 'city', 'outlets', 'consent'] as const satisfies readonly RegistrationFieldName[];
export type GuideField = (typeof GUIDE_ORDER)[number];

/** The first field in the walk-through that is not complete yet; null when the form is ready to send. */
export function nextField(done: ReadonlySet<string>): GuideField | null {
  return GUIDE_ORDER.find((f) => !done.has(f)) ?? null;
}

let progress: ReadonlySet<string> = new Set();
/** The form reports which fields are complete (filled in and valid) whenever its values change. */
export function setBuddyProgress(done: ReadonlySet<string>): void {
  progress = done;
}
export function getBuddyProgress(): ReadonlySet<string> {
  return progress;
}
