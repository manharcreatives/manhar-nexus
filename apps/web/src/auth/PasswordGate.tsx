import { useTranslation } from 'react-i18next';
import { Wordmark } from '../brand/Wordmark';
import { ChangePasswordForm } from '../shell/ChangePasswordForm';
import { Button } from '../ui/Button';
import { useAuth } from './AuthContext';

/** Shown instead of the app while the account still has a temporary password. */
export function PasswordGate() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="nx-glass w-full max-w-md rounded-panel p-6 sm:p-8">
        <Wordmark size="md" />
        <p className="eyebrow nx-eyebrow-dot mt-8 mb-2">{t('account.gate.eyebrow')}</p>
        <h1 className="text-[1.75rem] leading-tight font-semibold">{t('account.gate.title')}</h1>
        <p className="mt-2 mb-6 text-sm text-muted">{t('account.gate.body', { email: user?.email ?? '' })}</p>
        <ChangePasswordForm
          extra={
            <Button variant="ghost" onClick={() => void signOut()} className="mr-auto">
              {t('shell.signOut')}
            </Button>
          }
        />
      </div>
    </main>
  );
}
