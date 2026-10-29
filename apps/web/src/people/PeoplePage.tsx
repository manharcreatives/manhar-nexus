import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { useAsync } from '../reports/useAsync';
import { PageHeader } from '../ui/PageHeader';
import { Panel } from '../ui/Panel';
import { Field } from '../ui/Field';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Table, Td, Th } from '../ui/Table';
import { EmptyTeamArt } from '../brand/illustrations';
import { EmptyState, ErrorState, Skeleton } from '../ui/states';
import { peopleApi, type Directory, type LocationOption, type Person, type Role, type UserStatus, type ViewerCapabilities } from './api';
import { AddPersonDialog } from './AddPersonDialog';
import { PersonDialog } from './PersonDialog';
import { PersonStatus, RoleList, lastSeenText } from './display';
import { assignableRoles, viewerPermissions } from './helpers';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;
type StatusFilter = '' | UserStatus;

const NO_CAPS: ViewerCapabilities = { canCreate: false, canEdit: false, canAssignRoles: false, canViewRoles: false };

export function PeoplePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [roleId, setRoleId] = useState('');
  const [skip, setSkip] = useState(0);
  const [openPerson, setOpenPerson] = useState<Person | null>(null);
  const [adding, setAdding] = useState(false);

  // Debounce typing so each keystroke does not hit the server.
  useEffect(() => {
    const next = searchText.trim();
    if (next === q) return;
    const h = setTimeout(() => {
      setQ(next);
      setSkip(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(h);
  }, [searchText, q]);

  const fn = useCallback(
    () => peopleApi.directory({ q: q || undefined, status: status || undefined, roleId: roleId || undefined, skip, take: PAGE_SIZE }),
    [q, status, roleId, skip],
  );
  const { data, loading, error, reload } = useAsync<Directory>(fn);
  const viewer = data?.viewer ?? NO_CAPS;

  // Role catalogue (needs core.role.view) and locations (for "where" choices).
  const rolesFn = useCallback(() => peopleApi.roles(), []);
  const rolesState = useAsync<Role[]>(viewer.canViewRoles ? rolesFn : null);
  const locationsFn = useCallback(() => peopleApi.locations(), []);
  // Best effort: without location access the "where" choice is simply not offered.
  const locationsState = useAsync<LocationOption[]>(locationsFn);

  const roles = useMemo(() => (rolesState.data ? assignableRoles(rolesState.data) : null), [rolesState.data]);
  const held = useMemo(
    () => viewerPermissions(rolesState.data ?? [], (user?.roles ?? []).map((r) => r.key)),
    [rolesState.data, user],
  );
  const locations = useMemo(
    () => (locationsState.data ?? []).filter((l) => l.status === undefined || l.status === 'ACTIVE'),
    [locationsState.data],
  );

  const total = data?.total ?? 0;
  const items = data?.items ?? [];
  const firstShown = total === 0 ? 0 : skip + 1;
  const lastShown = Math.min(skip + items.length, total);
  const filtered = q !== '' || status !== '' || roleId !== '';

  const clearFilters = () => {
    setSearchText('');
    setQ('');
    setStatus('');
    setRoleId('');
    setSkip(0);
  };

  const youTag = (p: Person) =>
    p.id === user?.id ? <span className="ml-2 rounded-full bg-sunken px-2 py-0.5 text-xs text-muted">{t('people.you')}</span> : null;

  const manageButton = (p: Person, className?: string) => (
    <Button variant="secondary" className={className} onClick={() => setOpenPerson(p)} aria-label={t('people.manageName', { name: p.displayName })}>
      {t('people.manage')}
    </Button>
  );

  return (
    <div>
      <PageHeader
        title={t('people.title')}
        description={t('people.description')}
        actions={viewer.canCreate ? <Button onClick={() => setAdding(true)}>{t('people.add.action')}</Button> : undefined}
      />

      <Panel className="mb-6 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field
            label={t('people.filter.search')}
            type="search"
            placeholder={t('people.filter.searchPlaceholder')}
            value={searchText}
            maxLength={200}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Select
            label={t('people.filter.status')}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as StatusFilter);
              setSkip(0);
            }}
          >
            <option value="">{t('people.filter.allStatuses')}</option>
            <option value="ACTIVE">{t('people.status.ACTIVE')}</option>
            <option value="SUSPENDED">{t('people.status.SUSPENDED')}</option>
            <option value="PENDING">{t('people.status.PENDING')}</option>
          </Select>
          {roles && (
            <Select
              label={t('people.filter.role')}
              value={roleId}
              onChange={(e) => {
                setRoleId(e.target.value);
                setSkip(0);
              }}
            >
              <option value="">{t('people.filter.allRoles')}</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          )}
        </div>
        {filtered && (
          <Button variant="ghost" onClick={clearFilters}>
            {t('people.filter.clear')}
          </Button>
        )}
      </Panel>

      <div role="status" aria-live="polite" className="sr-only">
        {loading ? t('people.loading') : ''}
      </div>

      {error && !data ? (
        <ErrorState title={t('people.loadError')} body={error} onRetry={reload} retryLabel={t('people.retry')} />
      ) : loading && !data ? (
        <div aria-hidden className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : items.length === 0 ? (
        filtered ? (
          <EmptyState
            title={t('people.empty.title')}
            body={t('people.empty.body')}
            action={<Button variant="secondary" onClick={clearFilters}>{t('people.filter.clear')}</Button>}
          />
        ) : (
          <EmptyState
            illustration={<EmptyTeamArt />}
            title={t('people.empty.teamTitle')}
            body={t('people.empty.teamBody')}
            action={viewer.canCreate ? <Button onClick={() => setAdding(true)}>{t('people.add.action')}</Button> : undefined}
          />
        )
      ) : (
        <div className={loading ? 'opacity-60 transition-opacity' : undefined}>
          {error && (
            <p role="alert" className="mb-2 text-sm text-bad">
              {t('people.loadError')} <Button variant="ghost" onClick={reload}>{t('people.retry')}</Button>
            </p>
          )}

          {/* Phones: stacked cards. */}
          <ul className="space-y-3 sm:hidden">
            {items.map((p) => (
              <li key={p.id} className="space-y-3 nx-glass rounded-panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {p.displayName}
                      {youTag(p)}
                    </p>
                    <p className="break-all text-sm text-muted">{p.email}</p>
                  </div>
                  <PersonStatus t={t} person={p} />
                </div>
                <div className="text-sm">
                  <RoleList t={t} roles={p.roles} />
                </div>
                <p className="text-xs text-muted">
                  {t('people.col.lastSeen')}: {lastSeenText(t, p.lastLoginAt)}
                </p>
                {manageButton(p, 'w-full')}
              </li>
            ))}
          </ul>

          {/* Wider screens: table. */}
          <div className="hidden sm:block">
            <Table>
              <thead>
                <tr>
                  <Th>{t('people.col.person')}</Th>
                  <Th>{t('people.col.roles')}</Th>
                  <Th>{t('people.col.status')}</Th>
                  <Th>{t('people.col.lastSeen')}</Th>
                  <Th>
                    <span className="sr-only">{t('people.col.actions')}</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <Td>
                      <span className="font-medium">{p.displayName}</span>
                      {youTag(p)}
                      <span className="block break-all text-xs text-muted">{p.email}</span>
                    </Td>
                    <Td>
                      <RoleList t={t} roles={p.roles} />
                    </Td>
                    <Td>
                      <PersonStatus t={t} person={p} />
                    </Td>
                    <Td className="whitespace-nowrap">{lastSeenText(t, p.lastLoginAt)}</Td>
                    <Td className="text-right">{manageButton(p)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">{t('people.showing', { from: firstShown, to: lastShown, total })}</p>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={skip === 0 || loading} onClick={() => setSkip(Math.max(0, skip - PAGE_SIZE))}>
                {t('people.prev')}
              </Button>
              <Button variant="secondary" disabled={skip + PAGE_SIZE >= total || loading} onClick={() => setSkip(skip + PAGE_SIZE)}>
                {t('people.next')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <PersonDialog
        person={openPerson}
        selfId={user?.id ?? null}
        viewer={viewer}
        roles={roles}
        held={held}
        locations={locations}
        onClose={() => setOpenPerson(null)}
        onChanged={reload}
      />
      <AddPersonDialog
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={reload}
        roles={roles}
        held={held}
      />
    </div>
  );
}
