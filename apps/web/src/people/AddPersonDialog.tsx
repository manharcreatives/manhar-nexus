import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Checkbox } from '../ui/Checkbox';
import { useToast } from '../ui/Toast';
import { peopleApi, type Role } from './api';
import { describeRole } from './display';
import { PasswordFields } from './PasswordFields';
import { canGrantRole, classifyPeopleError, validateEmail, validateName, validateNewPerson } from './helpers';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** Assignable roles, or null when the viewer cannot list roles. */
  roles: Role[] | null;
  held: Set<string>;
}

const EMPTY = { displayName: '', email: '', password: '', confirm: '' };

export function AddPersonDialog({ open, onClose, onCreated, roles, held }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [roleKeys, setRoleKeys] = useState<string[]>([]);
  const [touched, setTouched] = useState({ displayName: false, email: false });
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  const reset = () => {
    setForm(EMPTY);
    setRoleKeys([]);
    setTouched({ displayName: false, email: false });
    setSubmitted(false);
    setFormError(null);
    setEmailTaken(null);
  };
  const close = () => {
    if (inFlight.current) return;
    reset();
    onClose();
  };

  const nameErr = validateName(form.displayName);
  const emailErr = validateEmail(form.email);
  const emailIsTaken = emailTaken !== null && emailTaken === form.email.trim().toLowerCase();

  const submit = async () => {
    if (inFlight.current) return;
    setSubmitted(true);
    setFormError(null);
    if (!validateNewPerson(form).ok || emailIsTaken) return;
    inFlight.current = true;
    setSubmitting(true);
    try {
      const name = form.displayName.trim();
      await peopleApi.create({
        displayName: name,
        email: form.email.trim(),
        password: form.password,
        roleKeys: roleKeys.length > 0 ? roleKeys : undefined,
      });
      toast.show(t('people.add.done', { name }));
      reset();
      onCreated();
      onClose();
    } catch (err) {
      const key = classifyPeopleError(err);
      if (key === 'emailTaken') setEmailTaken(form.email.trim().toLowerCase());
      else setFormError(t(`people.err.${key}`));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const set = (k: keyof typeof EMPTY) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t('people.add.title')}
      className="sm:w-[36rem]"
      footer={
        <>
          <Button variant="secondary" disabled={submitting} onClick={close}>
            {t('people.cancel')}
          </Button>
          <Button loading={submitting} onClick={() => void submit()}>
            {t('people.add.submit')}
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p className="text-sm text-muted">{t('people.add.intro')}</p>
        <Field
          label={t('people.add.name')}
          autoComplete="off"
          value={form.displayName}
          maxLength={200}
          disabled={submitting}
          onChange={(e) => set('displayName')(e.target.value)}
          onBlur={() => setTouched((s) => ({ ...s, displayName: true }))}
          error={(submitted || touched.displayName) && nameErr ? t(`people.err.name.${nameErr}`) : null}
        />
        <Field
          label={t('people.add.email')}
          type="email"
          inputMode="email"
          autoComplete="off"
          value={form.email}
          disabled={submitting}
          onChange={(e) => set('email')(e.target.value)}
          onBlur={() => setTouched((s) => ({ ...s, email: true }))}
          hint={t('people.add.emailHint')}
          error={
            emailIsTaken
              ? t('people.err.emailTaken')
              : (submitted || touched.email) && emailErr
                ? t(`people.err.email.${emailErr}`)
                : null
          }
        />
        <PasswordFields
          password={form.password}
          confirm={form.confirm}
          onPassword={set('password')}
          onConfirm={set('confirm')}
          showErrors={submitted}
          disabled={submitting}
          label={t('people.add.password')}
          confirmLabel={t('people.add.confirm')}
          hint={t('people.add.passwordHint')}
        />

        <fieldset className="space-y-2" disabled={submitting}>
          <legend className="text-sm font-medium">{t('people.add.roles')}</legend>
          {roles === null ? (
            <p className="text-sm text-muted">{t('people.add.rolesUnavailable')}</p>
          ) : (
            <>
              <p className="text-sm text-muted">{t('people.add.rolesHint')}</p>
              <ul className="divide-y divide-line/60 rounded-control border border-line">
                {roles.map((r) => {
                  const grantable = canGrantRole(r, held);
                  const descId = `add-role-${r.key}`;
                  return (
                    <li key={r.id} className="px-3 py-2">
                      <Checkbox
                        label={r.name}
                        checked={roleKeys.includes(r.key)}
                        disabled={!grantable}
                        aria-describedby={descId}
                        onChange={(e) =>
                          setRoleKeys((ks) => (e.target.checked ? [...ks, r.key] : ks.filter((k) => k !== r.key)))
                        }
                      />
                      <p id={descId} className="-mt-2 pl-8 text-xs text-muted">
                        {describeRole(t, r)}
                        {!grantable && <span className="block text-warn">{t('people.access.beyond')}</span>}
                      </p>
                    </li>
                  );
                })}
              </ul>
              {roleKeys.length === 0 && <p className="text-sm text-muted">{t('people.add.noRoleWarning')}</p>}
            </>
          )}
        </fieldset>

        {formError && (
          <p role="alert" className="text-sm text-bad">
            {formError}
          </p>
        )}
        {/* Lets Enter submit from any field. */}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}
