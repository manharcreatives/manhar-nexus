import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../auth/api';
import { useAuth } from '../auth/AuthContext';
import { validateConfirm, validatePassword } from '../people/helpers';
import { PasswordFields } from '../people/PasswordFields';
import { useSingleFlight } from '../restaurant/hooks';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Field } from '../ui/Field';

/** Self-service password change. On success every session ends, so the user signs in again. */
export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { endSessionAfterPasswordChange } = useAuth();
  const formId = useId();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState('');
  const { busy, run } = useSingleFlight();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setShowErrors(true);
    setError('');
    if (!current) return setError(t('account.password.currentRequired'));
    if (validatePassword(password) !== null || validateConfirm(password, confirm) !== null) return;
    if (password === current) return setError(t('account.password.same'));
    await run(async () => {
      try {
        await api('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: current, newPassword: password }) });
        endSessionAfterPasswordChange();
      } catch (err) {
        const status = (err as { status?: number } | null)?.status;
        setError(status === 400 ? t('account.password.wrongCurrent') : status === 429 ? t('auth.rateLimited') : t('account.password.failed'));
      }
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('account.password.title')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t('setup.cancel')}</Button>
          <Button type="submit" form={formId} loading={busy}>{t('account.password.submit')}</Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted">{t('account.password.intro')}</p>
        <Field label={t('account.password.current')} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus data-autofocus />
        <PasswordFields
          password={password}
          confirm={confirm}
          onPassword={setPassword}
          onConfirm={setConfirm}
          showErrors={showErrors}
          disabled={busy}
          label={t('account.password.new')}
          confirmLabel={t('account.password.confirm')}
        />
        <p role="alert" className="text-sm text-bad">{error}</p>
      </form>
    </Dialog>
  );
}
