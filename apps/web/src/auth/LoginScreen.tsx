import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';
import type { ApiError } from './api';
import { Wordmark } from '../brand/Wordmark';
import { brand } from '../lib/brand';
import { LedgerFigure } from '../ui/LedgerFigure';
import { Stamp } from '../ui/Stamp';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Field } from '../ui/Field';
import * as Icons from '../ui/icons';
import { formatMoney } from '../lib/money';

/** Maps an auth error to a user-facing i18n key (no server text leakage). */
function messageKey(err: ApiError): string {
  if (err.status === 429) return 'auth.rateLimited';
  if (err.status === 403) return 'auth.accountSuspended';
  if (err.status === 401) {
    return /locked/i.test(err.message) ? 'auth.accountLocked' : 'auth.invalidCredentials';
  }
  return 'auth.genericError';
}

/** The hero line with its last word set in the italic, in ember. */
function HeroLine({ text }: { text: string }) {
  const cut = text.trimEnd().lastIndexOf(' ');
  const head = cut > 0 ? text.slice(0, cut) : '';
  const tail = cut > 0 ? text.slice(cut + 1) : text;
  return (
    <p
      className="max-w-[32rem] font-display text-[3.5rem] leading-[1.02] font-semibold tracking-[-0.02em] xl:text-[4.25rem]"
    >
      {head} <span className="bg-gradient-to-r from-accent to-[#bbf7d0] bg-clip-text text-transparent">{tail}</span>
    </p>
  );
}

/** Decorative: a paid ticket stub resting on the ledger, in the product's own components. */
function TicketVignette() {
  const { t } = useTranslation();
  const lines: Array<[number, string, number]> = [
    [2, t('auth.vignette.line1'), 56000],
    [5, t('auth.vignette.line2'), 37500],
    [3, t('auth.vignette.line3'), 42100],
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute right-14 bottom-14 hidden w-72 rotate-[2.5deg] xl:block">
      <div
        data-perforated
        className="nx-stub rounded-b-[0.75rem] bg-paper px-5 pt-5 pb-6 text-ink shadow-[0_30px_60px_-20px_rgb(0_0_0/0.7)] [--stub-bg:var(--color-ink)]"
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-lg font-semibold">{t('auth.vignette.table')}</p>
          <p className="ticket-no text-xs text-muted">{t('auth.vignette.ticket')}</p>
        </div>
        <div className="nx-tear -mx-5 mt-4 mb-3" />
        <ul className="space-y-1.5 text-sm">
          {lines.map(([q, name, minor]) => (
            <li key={name} className="flex items-baseline gap-2">
              <span className="tabular w-6 font-semibold">{q}×</span>
              <span>{name}</span>
              <span className="mb-1 flex-1 border-b border-dotted border-muted/50" />
              <span className="tabular text-muted">{formatMoney(minor)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-end justify-between border-t border-line pt-3">
          <span className="eyebrow">{t('auth.vignette.total')}</span>
          <LedgerFigure minor={135600} rule="double" className="text-[1.75rem]" />
        </div>
      </div>
      <Stamp label={t('auth.vignette.paid')} className="absolute -bottom-4 -left-7 bg-paper text-ok [animation:none]" />
    </div>
  );
}

export function LoginScreen({ notice }: { notice?: string | null }) {
  const { t } = useTranslation();
  const { signIn, tabOnlyLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (submitting) return;
    setErrorKey(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password, tabOnlyLogin ? false : remember);
    } catch (err) {
      setErrorKey(messageKey(err as ApiError));
    } finally {
      setSubmitting(false);
    }
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState('CapsLock'));

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-[1.1fr_1fr]">
      <aside className="nx-ledger-paper relative hidden overflow-hidden text-ink lg:flex lg:flex-col lg:justify-between lg:py-12 lg:pr-12 lg:pl-20">
        {/* The ledger's margin: a double ember rule down the page. */}
        <span aria-hidden className="absolute inset-y-0 left-10 w-[5px] border-x border-ember-glow/45" />
        <Wordmark on="ink" size="md" />
        <div className="relative">
          <p className="eyebrow mb-5 text-ember-glow!">{t('auth.heroEyebrow')}</p>
          <HeroLine text={t('auth.heroLine')} />
          <p className="mt-6 max-w-sm text-base leading-relaxed text-ink/72">{t('auth.heroBody')}</p>
        </div>
        <div className="flex items-end justify-between gap-6">
          <p className="text-sm text-ink/55">{brand.footnote ?? t('auth.heroFootnote')}</p>
        </div>
        <TicketVignette />
      </aside>

      <main className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Wordmark size="md" />
          </div>
          <p className="eyebrow mb-2">{t('auth.formEyebrow')}</p>
          <h1 className="text-[2rem] leading-tight font-semibold tracking-[-0.015em]">{t('auth.signInTitle')}</h1>
          <p className="mt-2 text-sm text-muted">{t('auth.signInSubtitle')}</p>

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

            {tabOnlyLogin ? (
              <p className="text-sm text-muted">{t('session.tabOnlyNote')}</p>
            ) : (
              <div>
                <Checkbox label={t('session.remember')} checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <p className="text-xs text-muted">{t('session.rememberHint')}</p>
              </div>
            )}

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
