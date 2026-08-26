import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';
import type { ApiError } from './api';

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
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
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

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <span aria-hidden className="inline-block h-7 w-7 rounded-md bg-blue-700" />
          <span className="text-lg font-semibold tracking-tight">{t('app.name')}</span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{t('auth.signInTitle')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('auth.signInSubtitle')}</p>

        {notice && (
          <p role="status" className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {t(`auth.${notice}`)}
          </p>
        )}

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{t('auth.email')}</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{t('auth.password')}</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>

          {errorKey && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {t(errorKey)}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {submitting ? t('auth.signingIn') : t('auth.signIn')}
          </button>
        </form>
      </div>
    </div>
  );
}
