import { useCallback, useSyncExternalStore } from 'react';

/** Mirrors the API contract: planKey / billingCycle. */
export type PlanKey = 'counter' | 'floor' | 'pass' | 'many-doors' | 'not-sure';
export type BillingCycle = 'monthly' | 'yearly';
export type BeginIntent = 'register' | 'demo';

export interface RegistrationIntent {
  plan: PlanKey;
  cycle: BillingCycle;
  /** 'demo' when the visitor clicked "Book a live demo" rather than a plan. */
  begin: BeginIntent;
}

const PLANS: readonly PlanKey[] = ['counter', 'floor', 'pass', 'many-doors', 'not-sure'];
const DEFAULT_INTENT: RegistrationIntent = { plan: 'not-sure', cycle: 'yearly', begin: 'register' };

let state: RegistrationIntent = { ...DEFAULT_INTENT };
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

/** Read `#register?plan=floor&cycle=monthly&begin=demo` style params from a location hash. */
export function parseIntentHash(hash: string): Partial<RegistrationIntent> {
  const q = hash.indexOf('?');
  if (q === -1) return {};
  const params = new URLSearchParams(hash.slice(q + 1));
  const out: Partial<RegistrationIntent> = {};
  const plan = params.get('plan');
  const cycle = params.get('cycle');
  const begin = params.get('begin');
  if (plan && (PLANS as readonly string[]).includes(plan)) out.plan = plan as PlanKey;
  if (cycle === 'monthly' || cycle === 'yearly') out.cycle = cycle;
  if (begin === 'register' || begin === 'demo') out.begin = begin;
  return out;
}

export function getRegistrationIntent(): RegistrationIntent {
  return state;
}

export function setRegistrationIntent(patch: Partial<RegistrationIntent>): void {
  const next = { ...state, ...patch };
  if (next.plan === state.plan && next.cycle === state.cycle && next.begin === state.begin) return;
  state = next;
  emit();
}

export function resetRegistrationIntent(): void {
  setRegistrationIntent(DEFAULT_INTENT);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Tiny shared store: the visitor's chosen plan/billing cycle, set by the Pricing section and read by the
 * Register form (so "Choose Floor" pre-fills the form). Also reads `#register?plan=..&cycle=..` hash params
 * via `applyIntentFromHash()` (called by LandingApp on navigation).
 *
 *   const { plan, cycle, begin, choosePlan, setCycle, setBegin } = useRegistrationIntent();
 *   <Button href="#register" onClick={() => choosePlan('floor', cycle)}>Choose Floor</Button>
 */
export function useRegistrationIntent() {
  const intent = useSyncExternalStore(subscribe, getRegistrationIntent, getRegistrationIntent);
  const choosePlan = useCallback((plan: PlanKey, cycle?: BillingCycle) => setRegistrationIntent({ plan, begin: 'register', ...(cycle ? { cycle } : {}) }), []);
  const setCycle = useCallback((cycle: BillingCycle) => setRegistrationIntent({ cycle }), []);
  const setBegin = useCallback((begin: BeginIntent) => setRegistrationIntent({ begin }), []);
  return { ...intent, choosePlan, setCycle, setBegin };
}

export function applyIntentFromHash(hash: string): void {
  const patch = parseIntentHash(hash);
  if (Object.keys(patch).length) setRegistrationIntent(patch);
}
