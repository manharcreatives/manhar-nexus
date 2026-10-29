import { api } from '../auth/api';
import { updateClient, type CommercialStatus } from '../commercial/api';
import { initializeOnboarding } from './api';

/** Everything a platform admin needs to hand a new restaurant its own workspace. */
export interface ProvisionInput {
  name: string;
  locationName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  /** Commercial status of the new client (Trial for a free pilot, Active once paying). */
  commercialStatus: CommercialStatus;
  /** Module keys, in dependency order (restaurant, catalog, checkout, then optional ones). */
  modules: string[];
}

export type StepId = 'business' | 'location' | 'owner' | `module:${string}` | 'commercial' | 'onboarding';

export const CORE_MODULES = ['restaurant', 'catalog', 'checkout'] as const;
export const OPTIONAL_MODULES = ['reports', 'costs'] as const;

export function stepsFor(input: Pick<ProvisionInput, 'modules'>): StepId[] {
  return ['business', 'location', 'owner', ...input.modules.map((m) => `module:${m}` as StepId), 'commercial', 'onboarding'];
}

/** Core modules first (they depend on each other in this order), then the chosen extras. */
export function orderModules(selected: string[]): string[] {
  return [...CORE_MODULES, ...OPTIONAL_MODULES.filter((m) => selected.includes(m))];
}

const SAFE = {
  lower: 'abcdefghjkmnpqrstuvwxyz',
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  digit: '23456789',
  symbol: '#$%&*+-=?@',
};

/** A readable 16-character password with every character class, from crypto randomness. */
export function generatePassword(length = 16): string {
  const pick = (set: string) => set[randomInt(set.length)];
  const all = SAFE.lower + SAFE.upper + SAFE.digit + SAFE.symbol;
  const chars = [pick(SAFE.lower), pick(SAFE.upper), pick(SAFE.digit), pick(SAFE.symbol)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function randomInt(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % max;
}

const post = (path: string, body: unknown) => api(path, { method: 'POST', body: JSON.stringify(body) });

/**
 * Runs the provisioning sequence, skipping steps already done so a failed run can
 * be retried from where it stopped (the business id is kept in `state`).
 * Throws on the first failing step, with `state.failed` naming it.
 */
export async function runProvision(
  input: ProvisionInput,
  state: { businessId?: string; done: Set<StepId>; failed?: StepId },
  onStep: (id: StepId, status: 'running' | 'done') => void,
): Promise<string> {
  const step = async (id: StepId, fn: () => Promise<void>) => {
    if (state.done.has(id)) return;
    state.failed = undefined;
    onStep(id, 'running');
    try {
      await fn();
    } catch (err) {
      state.failed = id;
      throw err;
    }
    state.done.add(id);
    onStep(id, 'done');
  };

  await step('business', async () => {
    const b = await api<{ id: string }>('/internal/businesses', {
      method: 'POST',
      body: JSON.stringify({ name: input.name.trim(), businessTypeKey: 'restaurant' }),
    });
    state.businessId = b.id;
  });
  const id = state.businessId as string;
  await step('location', () => post(`/internal/businesses/${id}/locations`, { name: input.locationName.trim() }).then(() => undefined));
  await step('owner', () =>
    post(`/internal/businesses/${id}/provision`, {
      email: input.ownerEmail.trim().toLowerCase(),
      displayName: input.ownerName.trim(),
      password: input.ownerPassword,
      requirePasswordChange: true,
    }).then(() => undefined),
  );
  for (const m of input.modules) {
    await step(`module:${m}`, async () => {
      await post(`/internal/businesses/${id}/modules/${m}/activate`, {});
      await post(`/internal/businesses/${id}/modules/${m}/complete-setup`, {});
    });
  }
  await step('commercial', () => updateClient(id, { commercialStatus: input.commercialStatus }).then(() => undefined));
  await step('onboarding', () => initializeOnboarding(id).then(() => undefined));
  return id;
}
