import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';
import type { ApiError } from './api';
import { brand } from '../lib/brand';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import * as Icons from '../ui/icons';

/** Maps an auth error to a user-facing i18n key (no server text leakage). */
function messageKey(err: ApiError): string {
  if (err.status === 429) return 'auth.rateLimited';
  if (err.status === 403) return 'auth.accountSuspended';
  if (err.status === 401) {
    return /locked/i.test(err.message) ? 'auth.accountLocked' : 'auth.invalidCredentials';
  }
  return 'auth.genericError';
}

export function LoginScreen({ notice }: { notice?: string | null }) {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (submitting) return;
    setErrorKey(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setErrorKey(messageKey(err as ApiError));
    } finally {
      setSubmitting(false);
    }
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState('CapsLock'));

  return (
    <div className="grid min-h-screen w-full bg-paper lg:grid-cols-[1.1fr_1fr]">
      <aside className="hidden flex-col justify-between bg-ink p-12 text-paper lg:flex">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid size-9 place-items-center rounded-control bg-accent font-display text-xl font-semibold text-surface"
          >
            {brand.name.charAt(0)}
          </span>
          <span className="font-display text-xl font-semibold">{brand.name}</span>
        </div>
        <div>
          <p className="max-w-md font-display text-5xl font-semibold leading-[1.05]">{t('auth.heroLine')}</p>
          <p className="mt-5 max-w-sm text-base text-paper/70">{t('auth.heroBody')}</p>
        </div>
        <p className="text-sm text-paper/50">{t('auth.heroFootnote')}</p>
      </aside>

      <main className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-control bg-accent font-display text-lg font-semibold text-surface"
            >
              {brand.name.charAt(0)}
            </span>
            <span className="font-display text-lg font-semibold">{brand.name}</span>
          </div>
          <h1 className="text-3xl font-semibold">{t('auth.signInTitle')}</h1>
          <p className="mt-1.5 text-sm text-muted">{t('auth.signInSubtitle')}</p>

          {notice && (
            <p role="status" className="mt-5 rounded-control bg-warn-soft px-3 py-2 text-sm text-warn">
              {t(`auth.${notice}`)}
            </p>
          )}

          <form className="mt-7 space-y-5" onSubmit={onSubmit} noValidate={false}>
            <Field
              label={t('auth.email')}
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Field
              label={t('auth.password')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyUp={onKey}
              onKeyDown={onKey}
              hint={capsLock ? t('auth.capsLock') : undefined}
              adornment={
                <button
                  type="button"
                  className="grid size-9 place-items-center rounded-control text-muted hover:bg-sunken"
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((s) => !s)}
                >
                  {showPassword ? <Icons.EyeOff className="size-4" /> : <Icons.Eye className="size-4" />}
                </button>
              }
            />

            {errorKey && (
              <p role="alert" className="rounded-control bg-bad-soft px-3 py-2 text-sm text-bad">
                {t(errorKey)}
              </p>
            )}

            <Button type="submit" size="lg" loading={submitting} className="w-full">
              {submitting ? t('auth.signingIn') : t('auth.signIn')}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
