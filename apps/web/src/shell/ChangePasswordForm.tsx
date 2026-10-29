import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../auth/api';
import { useAuth } from '../auth/AuthContext';
import { validateConfirm, validatePassword } from '../people/helpers';
import { PasswordFields } from '../people/PasswordFields';
import { useSingleFlight } from '../restaurant/hooks';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';

/**
 * The password change form, shared by the account-menu dialog and the forced
 * first-sign-in screen. On success the server ends every session, so the user
 * signs in again with the new password.
 */
export function ChangePasswordForm({ onCancel, extra }: { onCancel?: () => void; extra?: React.ReactNode }) {
  const { t } = useTranslation();
  const { endSessionAfterPasswordChange } = useAuth();
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
    <form onSubmit={submit} className="space-y-4">
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
      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        {extra}
        {onCancel && <Button variant="secondary" onClick={onCancel}>{t('setup.cancel')}</Button>}
        <Button type="submit" loading={busy}>{t('account.password.submit')}</Button>
      </div>
    </form>
  );
}
