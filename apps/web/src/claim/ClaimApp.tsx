import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { validateConfirm, validatePassword } from '../people/helpers';
import { PasswordFields } from '../people/PasswordFields';
import { Button } from '../ui/Button';
import { claimTokenFromHash } from './path';

/** Same base the staff app uses. Duplicated on purpose: the owner's page must not import the auth code. */
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

const LINK_PRIMARY = 'nx-primary inline-flex min-h-11 items-center justify-center rounded-control px-4 text-sm font-semibold text-on-accent';
const LINK_SECONDARY = 'inline-flex min-h-11 items-center justify-center rounded-control border border-white/10 bg-white/[0.04] px-4 text-sm hover:border-accent/40';

type View =
  | { kind: 'form' }
  | { kind: 'done'; businessName: string; email: string }
  | { kind: 'invalid' };

/**
 * The owner's page to choose a password (/set-password#t=<token>), opened from the link we sent. Rendered by App.tsx
 * outside the auth providers and the website router. The token is read from the URL fragment and the fragment is
 * removed from the address bar at once, so it is not left in history or shown on screen. It is never logged and never
 * sent anywhere except the one redeem call. No third-party scripts run on this page.
 */
export default function ClaimApp() {
  const { t } = useTranslation();
  // Read once, then clear: a refresh shows the "link not valid" state instead of reusing a leftover fragment.
  const token = useRef<string | null>(null);
  if (token.current === null && typeof window !== 'undefined') {
    token.current = claimTokenFromHash(window.location.hash);
  }
  const [view, setView] = useState<View>(token.current ? { kind: 'form' } : { kind: 'invalid' });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = t('claim.pageTitle');
    window.history.replaceState(null, '', window.location.pathname);
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex,nofollow,noarchive';
    document.head.appendChild(robots);
    return () => robots.remove();
  }, [t]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !token.current) return;
    setShowErrors(true);
    setError('');
    if (validatePassword(password) !== null || validateConfirm(password, confirm) !== null) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/public/claim/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        body: JSON.stringify({ token: token.current, password }),
      });
      if (res.ok) {
        const body = (await res.json()) as { email?: string; businessName?: string };
        token.current = null;
        setView({ kind: 'done', businessName: body.businessName ?? '', email: body.email ?? '' });
        return;
      }
      if (res.status === 429) {
        setError(t('claim.errors.rateLimited'));
      } else if (res.status === 400 || res.status === 404 || res.status === 410) {
        // Expired, already used, replaced by a newer link, or never valid: nothing the owner can fix on this page.
        token.current = null;
        setView({ kind: 'invalid' });
      } else {
        setError(t('claim.errors.failed'));
      }
    } catch {
      setError(t('claim.errors.offline'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-4 py-6 text-ink">
      <section className="nx-glass w-[min(30rem,100%)] space-y-4 rounded-panel p-6" aria-labelledby="claim-title">
        <h1 id="claim-title" className="text-2xl font-semibold">
          {t('claim.title')}
        </h1>

        {view.kind === 'form' ? (
          <form onSubmit={submit} noValidate className="space-y-4">
            <p className="text-sm text-muted">{t('claim.intro')}</p>
            <PasswordFields
              password={password}
              confirm={confirm}
              onPassword={setPassword}
              onConfirm={setConfirm}
              showErrors={showErrors}
              disabled={busy}
              label={t('claim.password')}
              confirmLabel={t('claim.confirm')}
            />
            <p role="alert" className="text-sm text-bad">
              {error}
            </p>
            <Button type="submit" loading={busy}>
              {t('claim.submit')}
            </Button>
          </form>
        ) : null}

        {view.kind === 'done' ? (
          <div className="space-y-4" role="status">
            <p>{view.businessName ? t('claim.done', { name: view.businessName }) : t('claim.doneNoName')}</p>
            {view.email ? <p className="text-sm text-muted">{t('claim.signInWith', { email: view.email })}</p> : null}
            <a href="/login" className={LINK_PRIMARY}>
              {t('claim.signIn')}
            </a>
          </div>
        ) : null}

        {view.kind === 'invalid' ? (
          <div className="space-y-4" role="alert">
            <p>{t('claim.invalid')}</p>
            <a href="/login" className={LINK_SECONDARY}>
              {t('claim.signIn')}
            </a>
          </div>
        ) : null}
      </section>
    </main>
  );
}
