import type { TFunction } from 'i18next';
import { StatusPill } from '../ui/StatusPill';
import type { Person, PersonRole } from './api';
import { lastSeen, roleLocationNames, statusTone } from './helpers';

/** One human line about a role: our own copy for system roles, the business's text for custom ones. */
export function describeRole(
  t: TFunction,
  r: { key: string; description: string | null; isSystem: boolean; permissions?: string[] },
): string {
  if (r.isSystem) return t(`people.roleDesc.${r.key}`, { defaultValue: r.description ?? '' });
  if (r.description) return r.description;
  return r.permissions ? t('people.roleCustom', { count: r.permissions.length }) : '';
}

export function lastSeenText(t: TFunction, iso: string | null): string {
  const s = lastSeen(iso);
  if (s.key === 'date') return s.date.toLocaleDateString();
  if (s.key === 'never' || s.key === 'justNow') return t(`people.lastSeen.${s.key}`);
  return t(`people.lastSeen.${s.key}`, { count: s.count });
}

export function whereText(t: TFunction, r: PersonRole): string {
  const names = roleLocationNames(r);
  return names === null ? t('people.allLocations') : t('people.onlyLocations', { names: names.join(', ') });
}

/** Status as text + shape (never color alone); adds a lockout pill while one is in force. */
export function PersonStatus({ t, person }: { t: TFunction; person: Pick<Person, 'status' | 'lockedUntil'> }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      <StatusPill tone={statusTone(person.status)}>{t(`people.status.${person.status}`)}</StatusPill>
      {person.lockedUntil && <StatusPill tone="warn">{t('people.status.locked')}</StatusPill>}
    </span>
  );
}

/** Compact role list for a table cell or card. */
export function RoleList({ t, roles }: { t: TFunction; roles: PersonRole[] }) {
  if (roles.length === 0) return <span className="text-muted">{t('people.noRoles')}</span>;
  return (
    <ul className="space-y-1">
      {roles.map((r) => (
        <li key={r.roleId}>
          <span className="font-medium">{r.name}</span>
          <span className="block text-xs text-muted">{whereText(t, r)}</span>
        </li>
      ))}
    </ul>
  );
}
