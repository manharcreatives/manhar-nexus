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
  | { type: 'failure'; kind: 'rate-limit' | 'network' | 'server' | 'validation' }
  | { type: 'nudge' };

export interface BuddyState {
  event: BuddyEvent;
  /** Bumps on every event so a repeat of the same event still re-animates the bubble. */
  seq: number;
}

let state: BuddyState = { event: { type: 'welcome' }, seq: 0 };
const listeners = new Set<() => void>();

export function emitBuddy(event: BuddyEvent): void {
  state = { event, seq: state.seq + 1 };
  listeners.forEach((l) => l());
}

export function resetBuddy(): void {
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
