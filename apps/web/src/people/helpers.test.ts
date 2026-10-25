import { describe, expect, it } from 'vitest';
import type { Person, Role } from './api';
import {
  assignableRoles,
  canGrantRole,
  classifyPeopleError,
  draftFromPerson,
  draftProblems,
  isOwner,
  lastSeen,
  planAccessChanges,
  planIsEmpty,
  roleLocationNames,
  statusTone,
  suggestPassword,
  validateEmail,
  validateName,
  validateNewPerson,
  validatePassword,
  viewerPermissions,
} from './helpers';

const role = (key: string, permissions: string[], id = `id-${key}`): Role => ({
  id,
  businessId: null,
  key,
  name: key,
  description: null,
  isSystem: true,
  permissions,
});

const person = (roles: Person['roles']): Pick<Person, 'roles'> => ({ roles });
const pr = (roleId: string, allLocations: boolean, locs: string[] = [], key = roleId): Person['roles'][number] => ({
  roleId,
  key,
  name: key,
  description: null,
  isSystem: true,
  allLocations,
  locations: locs.map((id) => ({ id, name: `Loc ${id}` })),
});

describe('form validation', () => {
  it('validates names', () => {
    expect(validateName('  ')).toBe('required');
    expect(validateName('a'.repeat(201))).toBe('tooLong');
    expect(validateName(' Asha ')).toBeNull();
  });
  it('validates emails', () => {
    expect(validateEmail('')).toBe('required');
    expect(validateEmail('asha')).toBe('invalid');
    expect(validateEmail('asha@cafe')).toBe('invalid');
    expect(validateEmail('a sha@cafe.in')).toBe('invalid');
    expect(validateEmail(' asha@cafe.in ')).toBeNull();
  });
  it('validates passwords against the API bounds', () => {
    expect(validatePassword('')).toBe('required');
    expect(validatePassword('1234567')).toBe('tooShort');
    expect(validatePassword('12345678')).toBeNull();
    expect(validatePassword('x'.repeat(201))).toBe('tooLong');
  });
  it('validates a whole new-person form including confirmation', () => {
    const bad = validateNewPerson({ displayName: '', email: 'x', password: 'abcdefgh', confirm: 'abcdefgX' });
    expect(bad.ok).toBe(false);
    expect(bad.errors).toEqual({ displayName: 'required', email: 'invalid', password: null, confirm: 'mismatch' });
    const good = validateNewPerson({ displayName: 'Asha', email: 'a@b.in', password: 'abcdefgh', confirm: 'abcdefgh' });
    expect(good.ok).toBe(true);
  });
});

describe('suggestPassword', () => {
  it('is long enough and avoids look-alike characters', () => {
    const pw = suggestPassword(16);
    expect(pw).toHaveLength(16);
    expect(pw).not.toMatch(/[0O1lI]/);
    expect(validatePassword(pw)).toBeNull();
  });
  it('maps random values into the alphabet deterministically', () => {
    const fixed = () => new Uint32Array([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(suggestPassword(8, fixed)).toBe('ABCDEFGH');
  });
});

describe('roles and grant checks', () => {
  const roles = [role('platform-admin', ['*']), role('owner', ['*']), role('host', ['a', 'b']), role('kitchen', ['c'])];
  it('never offers the platform role', () => {
    expect(assignableRoles(roles).map((r) => r.key)).toEqual(['owner', 'host', 'kitchen']);
  });
  it('derives viewer permissions from their role keys', () => {
    expect([...viewerPermissions(roles, ['host'])].sort()).toEqual(['a', 'b']);
    expect(viewerPermissions(roles, ['owner']).has('*')).toBe(true);
  });
  it('only lets you grant roles within your own permissions', () => {
    const held = new Set(['a', 'b']);
    expect(canGrantRole(roles[2], held)).toBe(true);
    expect(canGrantRole(roles[3], held)).toBe(false);
    expect(canGrantRole(roles[1], held)).toBe(false);
    expect(canGrantRole(roles[1], new Set(['*']))).toBe(true);
  });
  it('detects owners', () => {
    expect(isOwner(person([pr('x', true, [], 'owner')]))).toBe(true);
    expect(isOwner(person([pr('x', true, [], 'host')]))).toBe(false);
  });
});

describe('access planning', () => {
  const current = person([pr('host', true), pr('kitchen', false, ['l1', 'l2'])]);

  it('round-trips the current access with no changes', () => {
    expect(planIsEmpty(planAccessChanges(current, draftFromPerson(current)))).toBe(true);
  });
  it('treats a reordered location list as unchanged', () => {
    const d = draftFromPerson(current);
    d.kitchen = { allLocations: false, locationIds: ['l2', 'l1'] };
    expect(planIsEmpty(planAccessChanges(current, d))).toBe(true);
  });
  it('plans removals, additions and scope changes', () => {
    const plan = planAccessChanges(current, {
      kitchen: { allLocations: true, locationIds: ['l1'] },
      accountant: { allLocations: false, locationIds: ['l3'] },
    });
    expect(plan.remove).toEqual(['host']);
    expect(plan.upsert).toEqual([
      { roleId: 'kitchen', allLocations: true },
      { roleId: 'accountant', allLocations: false, locationIds: ['l3'] },
    ]);
  });
  it('flags restricted roles with no locations picked', () => {
    expect(draftProblems({ a: { allLocations: false, locationIds: [] }, b: { allLocations: true, locationIds: [] } })).toEqual([
      'a',
    ]);
  });
  it('names the locations of a restricted role', () => {
    expect(roleLocationNames(pr('k', false, ['l1']))).toEqual(['Loc l1']);
    expect(roleLocationNames(pr('k', true))).toBeNull();
  });
});

describe('display helpers', () => {
  it('maps statuses to tones', () => {
    expect(statusTone('ACTIVE')).toBe('ok');
    expect(statusTone('SUSPENDED')).toBe('bad');
    expect(statusTone('PENDING')).toBe('warn');
  });
  it('describes the last sign-in coarsely', () => {
    const now = Date.parse('2026-10-25T12:00:00Z');
    expect(lastSeen(null, now)).toEqual({ key: 'never' });
    expect(lastSeen('2026-10-25T11:59:40Z', now)).toEqual({ key: 'justNow' });
    expect(lastSeen('2026-10-25T11:15:00Z', now)).toEqual({ key: 'minutes', count: 45 });
    expect(lastSeen('2026-10-25T07:00:00Z', now)).toEqual({ key: 'hours', count: 5 });
    expect(lastSeen('2026-10-22T12:00:00Z', now)).toEqual({ key: 'days', count: 3 });
    expect(lastSeen('2026-09-01T12:00:00Z', now).key).toBe('date');
  });
});

describe('classifyPeopleError', () => {
  const err = (status: number | undefined, message = '', code?: string) => ({ status, message, code });
  it('classifies API failures into human keys', () => {
    expect(classifyPeopleError(new TypeError('Failed to fetch'))).toBe('network');
    expect(classifyPeopleError(err(409, 'Email already in use'))).toBe('emailTaken');
    expect(classifyPeopleError(err(403, 'You cannot change your own role assignments'))).toBe('selfChange');
    expect(classifyPeopleError(err(403, 'You cannot reset your own password here'))).toBe('selfChange');
    expect(classifyPeopleError(err(403, 'Cannot grant a permission you do not hold'))).toBe('beyondYourRole');
    expect(classifyPeopleError(err(403, 'Cannot grant wildcard permission'))).toBe('beyondYourRole');
    expect(classifyPeopleError(err(403, 'Cannot grant all-locations access beyond your own scope'))).toBe(
      'beyondYourLocations',
    );
    expect(classifyPeopleError(err(403, 'Cannot grant access to a location outside your scope'))).toBe(
      'beyondYourLocations',
    );
    expect(classifyPeopleError(err(403, 'Forbidden'))).toBe('noAccess');
    expect(classifyPeopleError(err(404, 'User not found'))).toBe('notFound');
    expect(classifyPeopleError(err(404, 'Location not found in this business'))).toBe('notFound');
    expect(classifyPeopleError(err(400, 'Validation failed'))).toBe('invalid');
    expect(classifyPeopleError(err(500, 'boom'))).toBe('generic');
  });
});

describe('copy coverage', () => {
  it('has a sentence for every error key, status and system role', async () => {
    const copy = (await import('../i18n/en.people.json')).default.people as unknown as {
      err: Record<string, unknown>;
      status: Record<string, string>;
      roleDesc: Record<string, string>;
    };
    const errKeys = ['network', 'noAccess', 'notFound', 'emailTaken', 'selfChange', 'beyondYourRole', 'beyondYourLocations', 'invalid', 'generic'];
    for (const k of errKeys) expect(typeof copy.err[k]).toBe('string');
    for (const s of ['ACTIVE', 'SUSPENDED', 'PENDING', 'locked']) expect(copy.status[s]).toBeTruthy();
    for (const r of ['owner', 'location-manager', 'checkout-associate', 'service-team', 'host', 'kitchen-team', 'stock-control-manager', 'accountant']) {
      expect(copy.roleDesc[r]).toBeTruthy();
    }
  });
});
