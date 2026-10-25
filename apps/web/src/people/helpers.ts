import type { AssignRoleBody, Person, PersonRole, Role, UserStatus } from './api';

/** Mirrors the API (createUserSchema / resetPasswordSchema). */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;
export const NAME_MAX = 200;

/** The business owner role key (system role, holds every permission). */
export const OWNER_ROLE_KEY = 'owner';
const PLATFORM_ROLE_KEY = 'platform-admin';
const WILDCARD = '*';

// ── form validation ──────────────────────────────────────────────────────

export type NameError = 'required' | 'tooLong';
export type EmailError = 'required' | 'invalid';
export type PasswordError = 'required' | 'tooShort' | 'tooLong';
export type ConfirmError = 'mismatch';

export function validateName(name: string): NameError | null {
  const v = name.trim();
  if (v === '') return 'required';
  if (v.length > NAME_MAX) return 'tooLong';
  return null;
}

/** Deliberately simple: one @, something either side, a dot in the domain, no spaces. */
export function validateEmail(email: string): EmailError | null {
  const v = email.trim();
  if (v === '') return 'required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'invalid';
  return null;
}

export function validatePassword(password: string): PasswordError | null {
  if (password === '') return 'required';
  if (password.length < PASSWORD_MIN) return 'tooShort';
  if (password.length > PASSWORD_MAX) return 'tooLong';
  return null;
}

export function validateConfirm(password: string, confirm: string): ConfirmError | null {
  return password === confirm ? null : 'mismatch';
}

export interface NewPersonForm {
  displayName: string;
  email: string;
  password: string;
  confirm: string;
}
export interface NewPersonErrors {
  displayName: NameError | null;
  email: EmailError | null;
  password: PasswordError | null;
  confirm: ConfirmError | null;
}

export function validateNewPerson(f: NewPersonForm): { ok: boolean; errors: NewPersonErrors } {
  const errors: NewPersonErrors = {
    displayName: validateName(f.displayName),
    email: validateEmail(f.email),
    password: validatePassword(f.password),
    confirm: f.password === '' ? null : validateConfirm(f.password, f.confirm),
  };
  return { ok: Object.values(errors).every((e) => e === null), errors };
}

/**
 * A readable random password (no look-alike characters) the owner can hand to
 * a new person. Uses the platform CSPRNG.
 */
export function suggestPassword(length = 12, random: (n: number) => Uint32Array = cryptoRandom): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const values = random(length);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[values[i] % alphabet.length];
  return out;
}
function cryptoRandom(n: number): Uint32Array {
  return crypto.getRandomValues(new Uint32Array(n));
}

// ── roles and access ─────────────────────────────────────────────────────

/** Roles a business may hand out (the platform role is never assignable). */
export function assignableRoles(roles: Role[]): Role[] {
  return roles.filter((r) => r.key !== PLATFORM_ROLE_KEY);
}

/** Effective permissions of the viewer, from the role keys on their own profile. */
export function viewerPermissions(roles: Role[], viewerRoleKeys: string[]): Set<string> {
  const keys = new Set(viewerRoleKeys);
  const out = new Set<string>();
  for (const r of roles) if (keys.has(r.key)) for (const p of r.permissions) out.add(p);
  return out;
}

/**
 * The API only lets you hand out a role whose every permission you already
 * hold (wildcard covers all). Mirrors that so the UI can explain it up front.
 */
export function canGrantRole(role: Role, held: Set<string>): boolean {
  if (held.has(WILDCARD)) return true;
  return role.permissions.every((p) => p !== WILDCARD && held.has(p));
}

export const isOwner = (p: Pick<Person, 'roles'>): boolean => p.roles.some((r) => r.key === OWNER_ROLE_KEY);

/** Per-role location scope being edited: absent key = role not held. */
export type AccessDraft = Record<string, { allLocations: boolean; locationIds: string[] }>;

export function draftFromPerson(p: Pick<Person, 'roles'>): AccessDraft {
  const d: AccessDraft = {};
  for (const r of p.roles) d[r.roleId] = { allLocations: r.allLocations, locationIds: r.locations.map((l) => l.id) };
  return d;
}

/** Role ids restricted to specific locations but with none picked (the API would treat that as all). */
export function draftProblems(d: AccessDraft): string[] {
  return Object.entries(d)
    .filter(([, v]) => !v.allLocations && v.locationIds.length === 0)
    .map(([id]) => id);
}

const sameSet = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
};

export interface AccessPlan {
  remove: string[];
  upsert: AssignRoleBody[];
}

/** Minimal set of API calls that turns the person's current access into the draft. */
export function planAccessChanges(current: Pick<Person, 'roles'>, draft: AccessDraft): AccessPlan {
  const before = draftFromPerson(current);
  const remove = Object.keys(before).filter((id) => !(id in draft));
  const upsert: AssignRoleBody[] = [];
  for (const [roleId, next] of Object.entries(draft)) {
    const prev = before[roleId];
    const changed =
      !prev ||
      prev.allLocations !== next.allLocations ||
      (!next.allLocations && !sameSet(prev.locationIds, next.locationIds));
    if (!changed) continue;
    upsert.push(
      next.allLocations
        ? { roleId, allLocations: true }
        : { roleId, allLocations: false, locationIds: [...next.locationIds] },
    );
  }
  return { remove, upsert };
}

export const planIsEmpty = (p: AccessPlan): boolean => p.remove.length === 0 && p.upsert.length === 0;

/** Location names a role assignment covers, or null for every location. */
export function roleLocationNames(r: PersonRole): string[] | null {
  return r.allLocations ? null : r.locations.map((l) => l.name);
}

// ── display ──────────────────────────────────────────────────────────────

export type Tone = 'ok' | 'warn' | 'bad' | 'neutral';
export function statusTone(s: UserStatus): Tone {
  if (s === 'ACTIVE') return 'ok';
  if (s === 'SUSPENDED') return 'bad';
  return 'warn';
}

export type LastSeen =
  | { key: 'never' }
  | { key: 'justNow' }
  | { key: 'minutes' | 'hours' | 'days'; count: number }
  | { key: 'date'; date: Date };

/** Coarse "last signed in" wording; older than a week shows the date. */
export function lastSeen(iso: string | null, now: number = Date.now()): LastSeen {
  if (!iso) return { key: 'never' };
  const at = new Date(iso);
  const diff = Math.max(0, now - at.getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return { key: 'justNow' };
  if (min < 60) return { key: 'minutes', count: min };
  const h = Math.floor(min / 60);
  if (h < 24) return { key: 'hours', count: h };
  const d = Math.floor(h / 24);
  if (d < 7) return { key: 'days', count: d };
  return { key: 'date', date: at };
}

// ── errors ───────────────────────────────────────────────────────────────

export type PeopleErrorKey =
  | 'network'
  | 'noAccess'
  | 'notFound'
  | 'emailTaken'
  | 'selfChange'
  | 'beyondYourRole'
  | 'beyondYourLocations'
  | 'invalid'
  | 'generic';

/** Classifies an API failure into a stable key the UI turns into a human sentence. */
export function classifyPeopleError(err: unknown): PeopleErrorKey {
  const e = err as { status?: number; code?: string; message?: string } | null;
  const status = e?.status;
  if (status === undefined) return 'network';
  const msg = (e?.message ?? '').toLowerCase();
  // Location check first: "...beyond your own scope" also contains "your own".
  if (msg.includes('location') && (status === 403 || msg.includes('scope'))) return 'beyondYourLocations';
  if (msg.includes('your own')) return 'selfChange';
  if (msg.includes('cannot grant') || msg.includes('do not hold') || msg.includes('wildcard')) return 'beyondYourRole';
  if (status === 409 || msg.includes('already in use')) return 'emailTaken';
  if (status === 401 || status === 403) return 'noAccess';
  if (status === 404) return 'notFound';
  if (status === 400) return 'invalid';
  return 'generic';
}
