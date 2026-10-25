import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { useToast } from '../ui/Toast';
import { peopleApi, type LocationOption, type Person, type Role, type ViewerCapabilities } from './api';
import { AccessEditor } from './AccessEditor';
import { PasswordFields } from './PasswordFields';
import { PersonStatus, describeRole, lastSeenText, whereText } from './display';
import {
  OWNER_ROLE_KEY,
  classifyPeopleError,
  draftFromPerson,
  draftProblems,
  isOwner,
  planAccessChanges,
  planIsEmpty,
  validateConfirm,
  validateName,
  validatePassword,
  type AccessDraft,
} from './helpers';

interface Props {
  person: Person | null;
  selfId: string | null;
  viewer: ViewerCapabilities;
  roles: Role[] | null;
  held: Set<string>;
  locations: LocationOption[];
  onClose: () => void;
  /** Called after any change so the list can refresh. */
  onChanged: () => void;
}

type Mode = 'view' | 'rename' | 'access' | 'password' | 'status';

export function PersonDialog({ person, selfId, viewer, roles, held, locations, onClose, onChanged }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [current, setCurrent] = useState<Person | null>(person);
  const [mode, setMode] = useState<Mode>('view');
  const [nameText, setNameText] = useState('');
  const [draft, setDraft] = useState<AccessDraft>({});
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Synchronous guard against a fast double-click slipping a second request through.
  const inFlight = useRef(false);

  // A new person was opened: take their snapshot and start from the overview.
  useEffect(() => {
    setCurrent(person);
    setMode('view');
    setFormError(null);
  }, [person]);

  const toView = () => {
    setMode('view');
    setSubmitted(false);
    setFormError(null);
    setPassword('');
    setConfirm('');
  };
  const close = () => {
    if (inFlight.current) return;
    toView();
    onClose();
  };

  const errText = (err: unknown) => t(`people.err.${classifyPeopleError(err)}`);

  /** Re-read this person so the dialog shows what the server now holds. */
  const refresh = async (): Promise<Person | null> => {
    if (!current) return null;
    try {
      const res = await peopleApi.directory({ q: current.email, take: 10 });
      const fresh = res.items.find((p) => p.id === current.id) ?? null;
      if (fresh) setCurrent(fresh);
      return fresh;
    } catch {
      return null;
    } finally {
      onChanged();
    }
  };

  const run = async (op: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setFormError(null);
    try {
      await op();
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  if (!current) {
    return <Dialog open={false} onClose={onClose} title="">{null}</Dialog>;
  }

  const name = current.displayName;
  const isSelf = current.id === selfId;
  const ownerTarget = isOwner(current);
  const canRename = viewer.canEdit;
  const canAccess = viewer.canAssignRoles && viewer.canViewRoles && !isSelf;
  const canPassword = viewer.canEdit && !isSelf;
  const canStatus = viewer.canEdit && !isSelf && current.status !== 'PENDING';
  const suspended = current.status === 'SUSPENDED';

  // ── actions ──
  const saveName = () =>
    run(async () => {
      setSubmitted(true);
      if (validateName(nameText) !== null) return;
      try {
        await peopleApi.rename(current.id, nameText.trim());
        toast.show(t('people.rename.done'));
        await refresh();
        toView();
      } catch (err) {
        setFormError(errText(err));
      }
    });

  const problems = submitted ? draftProblems(draft) : [];
  const plan = planAccessChanges(current, draft);
  const removingOwner = ownerTarget && !Object.keys(draft).some((id) => roles?.find((r) => r.id === id)?.key === OWNER_ROLE_KEY);

  const saveAccess = () =>
    run(async () => {
      setSubmitted(true);
      if (draftProblems(draft).length > 0) return;
      if (planIsEmpty(plan)) {
        setFormError(t('people.access.noChanges'));
        return;
      }
      let done = 0;
      try {
        // Grants first, removals last, so the person is never briefly left with nothing.
        for (const body of plan.upsert) {
          await peopleApi.assignRole(current.id, body);
          done++;
        }
        for (const roleId of plan.remove) {
          await peopleApi.removeRole(current.id, roleId);
          done++;
        }
        toast.show(t('people.access.done', { name }));
        await refresh();
        toView();
      } catch (err) {
        const fresh = await refresh();
        if (done > 0) {
          if (fresh) setDraft(draftFromPerson(fresh));
          setFormError(`${t('people.access.partial')} ${errText(err)}`);
        } else {
          setFormError(errText(err));
        }
      }
    });

  const savePassword = () =>
    run(async () => {
      setSubmitted(true);
      if (validatePassword(password) !== null || validateConfirm(password, confirm) !== null) return;
      try {
        await peopleApi.resetPassword(current.id, password);
        toast.show(t('people.password.done', { name }));
        await refresh();
        toView();
      } catch (err) {
        setFormError(errText(err));
      }
    });

  const saveStatus = () =>
    run(async () => {
      try {
        await peopleApi.setStatus(current.id, suspended ? 'ACTIVE' : 'SUSPENDED');
        toast.show(t(suspended ? 'people.reactivate.done' : 'people.suspend.done', { name }));
        await refresh();
        toView();
      } catch (err) {
        setFormError(errText(err));
        await refresh();
      }
    });

  // ── layout ──
  const backAndSave = (label: string, onSave: () => void, danger = false): ReactNode => (
    <>
      <Button variant="secondary" disabled={submitting} onClick={toView}>
        {t('people.back')}
      </Button>
      <Button variant={danger ? 'danger' : 'primary'} loading={submitting} onClick={onSave}>
        {label}
      </Button>
    </>
  );

  let title = name;
  let footer: ReactNode = (
    <Button variant="secondary" onClick={close}>
      {t('people.close')}
    </Button>
  );
  let body: ReactNode;

  if (mode === 'rename') {
    title = t('people.rename.title');
    footer = backAndSave(t('people.save'), () => void saveName());
    const err = validateName(nameText);
    body = (
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void saveName();
        }}
      >
        <Field
          label={t('people.rename.label')}
          value={nameText}
          maxLength={200}
          autoFocus
          disabled={submitting}
          onChange={(e) => setNameText(e.target.value)}
          error={submitted && err ? t(`people.err.name.${err}`) : null}
        />
      </form>
    );
  } else if (mode === 'access') {
    title = t('people.access.title', { name });
    footer = backAndSave(t('people.save'), () => void saveAccess());
    body = roles ? (
      <div className="space-y-3">
        <p className="text-sm text-muted">{t('people.access.intro', { name })}</p>
        <AccessEditor
          roles={roles}
          held={held}
          locations={locations}
          draft={draft}
          onChange={setDraft}
          problems={problems}
          disabled={submitting}
        />
        {removingOwner && <p className="text-sm text-warn">{t('people.access.ownerRemoval')}</p>}
        {Object.keys(draft).length === 0 && <p className="text-sm text-muted">{t('people.access.noRoleWarning')}</p>}
      </div>
    ) : (
      <p className="text-sm text-muted">{t('people.access.rolesUnavailable')}</p>
    );
  } else if (mode === 'password') {
    title = t('people.password.title', { name });
    footer = backAndSave(t('people.password.submit'), () => void savePassword());
    body = (
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void savePassword();
        }}
      >
        <p className="text-sm text-muted">{t('people.password.intro', { name })}</p>
        <PasswordFields
          password={password}
          confirm={confirm}
          onPassword={setPassword}
          onConfirm={setConfirm}
          showErrors={submitted}
          disabled={submitting}
          label={t('people.password.label')}
          confirmLabel={t('people.password.confirm')}
        />
      </form>
    );
  } else if (mode === 'status') {
    const k = suspended ? 'reactivate' : 'suspend';
    title = t(`people.${k}.title`, { name });
    footer = backAndSave(t(`people.${k}.confirm`, { name }), () => void saveStatus(), !suspended);
    body = (
      <div className="space-y-2 text-sm">
        <p>{t(`people.${k}.body`, { name })}</p>
        {!suspended && ownerTarget && <p className="text-warn">{t('people.suspend.ownerWarning', { name })}</p>}
      </div>
    );
  } else {
    body = (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <PersonStatus t={t} person={current} />
          {isSelf && <span className="text-sm text-muted">{t('people.you')}</span>}
        </div>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted">{t('people.detail.email')}</dt>
          <dd className="break-all">{current.email}</dd>
          <dt className="text-muted">{t('people.detail.lastSeen')}</dt>
          <dd>{lastSeenText(t, current.lastLoginAt)}</dd>
          <dt className="text-muted">{t('people.detail.added')}</dt>
          <dd>{new Date(current.createdAt).toLocaleDateString()}</dd>
        </dl>
        {current.lockedUntil && (
          <p className="text-sm text-warn">
            {t('people.detail.lockedUntil', { time: new Date(current.lockedUntil).toLocaleTimeString() })}
          </p>
        )}

        <section aria-labelledby="person-access" className="space-y-2">
          <h3 id="person-access" className="text-sm font-semibold">
            {t('people.detail.access')}
          </h3>
          {current.roles.length === 0 ? (
            <p className="text-sm text-muted">{t('people.noRoles')}</p>
          ) : (
            <ul className="divide-y divide-line/60 rounded-control border border-line">
              {current.roles.map((r) => (
                <li key={r.roleId} className="px-3 py-2 text-sm">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-muted">{describeRole(t, r)}</p>
                  <p className="text-xs text-muted">{whereText(t, r)}</p>
                </li>
              ))}
            </ul>
          )}
          {ownerTarget && <p className="text-sm text-muted">{t('people.detail.ownerNote')}</p>}
        </section>

        {isSelf && (viewer.canEdit || viewer.canAssignRoles) && <p className="text-sm text-muted">{t('people.detail.selfNote')}</p>}
        {!viewer.canEdit && !viewer.canAssignRoles && <p className="text-sm text-muted">{t('people.readOnly')}</p>}

        {(canRename || canAccess || canPassword || canStatus) && (
          <div className="flex flex-wrap gap-2">
            {canRename && (
              <Button
                variant="secondary"
                onClick={() => {
                  setNameText(current.displayName);
                  setSubmitted(false);
                  setMode('rename');
                }}
              >
                {t('people.detail.editName')}
              </Button>
            )}
            {canAccess && (
              <Button
                variant="secondary"
                onClick={() => {
                  setDraft(draftFromPerson(current));
                  setSubmitted(false);
                  setFormError(null);
                  setMode('access');
                }}
              >
                {t('people.detail.changeAccess')}
              </Button>
            )}
            {canPassword && (
              <Button
                variant="secondary"
                onClick={() => {
                  setSubmitted(false);
                  setMode('password');
                }}
              >
                {t('people.detail.setPassword')}
              </Button>
            )}
            {canStatus && (
              <Button variant={suspended ? 'secondary' : 'danger'} onClick={() => setMode('status')}>
                {suspended ? t('people.detail.reactivate') : t('people.detail.suspend')}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Dialog open={person !== null} onClose={close} title={title} footer={footer} className="sm:w-[40rem]">
      {body}
      {formError && (
        <p role="alert" className="mt-4 text-sm text-bad">
          {formError}
        </p>
      )}
    </Dialog>
  );
}
