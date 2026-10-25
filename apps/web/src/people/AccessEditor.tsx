import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '../ui/Checkbox';
import type { LocationOption, Role } from './api';
import { describeRole } from './display';
import { canGrantRole, type AccessDraft } from './helpers';

interface Props {
  roles: Role[];
  /** Viewer's effective permissions, to explain roles they cannot hand out. */
  held: Set<string>;
  /** Locations the viewer can see; scoping is offered only when there is more than one. */
  locations: LocationOption[];
  draft: AccessDraft;
  onChange: (d: AccessDraft) => void;
  /** Role ids currently flagged as "restricted but no location picked". */
  problems: string[];
  disabled?: boolean;
}

/** Role checklist with an optional per-role "where" choice. */
export function AccessEditor({ roles, held, locations, draft, onChange, problems, disabled }: Props) {
  const { t } = useTranslation();
  const base = useId();
  const scoping = locations.length > 1;

  const toggleRole = (role: Role, on: boolean) => {
    const next = { ...draft };
    if (on) next[role.id] = { allLocations: true, locationIds: [] };
    else delete next[role.id];
    onChange(next);
  };
  const setWhere = (roleId: string, allLocations: boolean) =>
    onChange({ ...draft, [roleId]: { allLocations, locationIds: draft[roleId]?.locationIds ?? [] } });
  const toggleLocation = (roleId: string, locationId: string, on: boolean) => {
    const cur = draft[roleId]?.locationIds ?? [];
    const ids = on ? [...new Set([...cur, locationId])] : cur.filter((x) => x !== locationId);
    onChange({ ...draft, [roleId]: { allLocations: false, locationIds: ids } });
  };

  return (
    <ul className="divide-y divide-line/60 rounded-control border border-line">
      {roles.map((role) => {
        const assigned = role.id in draft;
        const grantable = canGrantRole(role, held);
        // A role you cannot grant stays removable if the person already has it.
        const locked = disabled || (!grantable && !assigned);
        const desc = describeRole(t, role);
        const descId = `${base}-${role.id}-desc`;
        const entry = draft[role.id];
        const missing = problems.includes(role.id);
        return (
          <li key={role.id} className="px-3 py-2">
            <Checkbox
              label={role.name}
              checked={assigned}
              disabled={locked}
              aria-describedby={descId}
              onChange={(e) => toggleRole(role, e.target.checked)}
            />
            <p id={descId} className="-mt-2 pl-8 text-xs text-muted">
              {desc}
              {!grantable && <span className="block text-warn">{t('people.access.beyond')}</span>}
            </p>

            {assigned && scoping && entry && (
              <fieldset className="mt-2 space-y-1 pl-8" disabled={disabled}>
                <legend className="text-xs font-medium uppercase tracking-wider text-muted">{t('people.access.where')}</legend>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                  <input
                    type="radio"
                    name={`${base}-${role.id}-where`}
                    className="size-5 accent-(--color-accent)"
                    checked={entry.allLocations}
                    onChange={() => setWhere(role.id, true)}
                  />
                  {t('people.access.everywhere')}
                </label>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                  <input
                    type="radio"
                    name={`${base}-${role.id}-where`}
                    className="size-5 accent-(--color-accent)"
                    checked={!entry.allLocations}
                    onChange={() => setWhere(role.id, false)}
                  />
                  {t('people.access.some')}
                </label>
                {!entry.allLocations && (
                  <div className="space-y-0 pl-8">
                    {locations.map((l) => (
                      <Checkbox
                        key={l.id}
                        label={l.name}
                        checked={entry.locationIds.includes(l.id)}
                        onChange={(e) => toggleLocation(role.id, l.id, e.target.checked)}
                      />
                    ))}
                    {missing && (
                      <p role="alert" className="text-sm text-bad">
                        {t('people.access.pickLocations')}
                      </p>
                    )}
                  </div>
                )}
              </fieldset>
            )}
          </li>
        );
      })}
    </ul>
  );
}
