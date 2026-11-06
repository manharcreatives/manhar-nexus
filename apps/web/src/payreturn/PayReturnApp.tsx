import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { recallPayerSecret, setPasswordHref, supportWhatsAppUrl } from '../landing/registration/claim';
import { useClaimFlow } from '../landing/registration/useClaimFlow';
import { Button } from '../ui/Button';
import { referenceCodeFromSearch } from './path';

const LINK_PRIMARY = 'nx-primary inline-flex min-h-11 items-center justify-center rounded-control px-4 text-sm font-semibold text-on-accent';
const LINK_SECONDARY = 'inline-flex min-h-11 items-center justify-center rounded-control border border-white/10 bg-white/[0.04] px-4 text-sm hover:border-accent/40';

/**
 * Where Cashfree sends the owner after paying (/pay/return?code=NX-XXXXXX). The owner proves it is them with the payer
 * secret this browser kept when they pressed "Pay now" plus the last four digits of their mobile number, then gets the
 * one-time "set your password" link as soon as the account exists. Public, noindex, no third-party scripts. The token
 * goes only into the /set-password URL fragment and is never logged.
 */
export default function PayReturnApp() {
  const { t } = useTranslation();
  const code = useMemo(() => (typeof window === 'undefined' ? null : referenceCodeFromSearch(window.location.search)), []);
  const hasSecret = useMemo(() => (code ? recallPayerSecret(code) !== null : false), [code]);
  const [digits, setDigits] = useState('');
  const [asked, setAsked] = useState(false);
  const { flow, start } = useClaimFlow({ referenceCode: code ?? '', phoneLast4: digits });

  useEffect(() => {
    document.title = t('payReturn.pageTitle');
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex,nofollow,noarchive';
    document.head.appendChild(robots);
    return () => robots.remove();
  }, [t]);

  const whatsapp = supportWhatsAppUrl(t('payReturn.whatsappText', { code: code ?? '' }));
  const valid = /^\d{4}$/.test(digits);

  function submit(e: FormEvent) {
    e.preventDefault();
    setAsked(true);
    if (!valid) return;
    start();
  }

  const waiting = flow.state === 'pending';
  const showForm = hasSecret && (flow.state === 'idle' || flow.state === 'unknown');

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-4 py-6 text-ink">
      <section className="nx-glass w-[min(30rem,100%)] space-y-4 rounded-panel p-6" aria-labelledby="return-title">
        <h1 id="return-title" className="text-2xl font-semibold">
          {t('payReturn.title')}
        </h1>

        {!code ? (
          <div className="space-y-4" role="alert">
            <p>{t('payReturn.noCode')}</p>
            <a className={LINK_SECONDARY} href={whatsapp} target="_blank" rel="noopener noreferrer">
              {t('payReturn.whatsapp')}
            </a>
          </div>
        ) : !hasSecret ? (
          <div className="space-y-4" role="status">
            <p>{t('payReturn.otherDevice', { code })}</p>
            <a className={LINK_SECONDARY} href={whatsapp} target="_blank" rel="noopener noreferrer">
              {t('payReturn.whatsapp')}
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted">{t('payReturn.intro', { code })}</p>

            {showForm ? (
              <form onSubmit={submit} noValidate className="space-y-3">
                <label htmlFor="last4" className="block text-sm font-medium">
                  {t('payReturn.last4')}
                </label>
                <input
                  id="last4"
                  name="last4"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  maxLength={4}
                  value={digits}
                  onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  aria-invalid={asked && !valid ? true : undefined}
                  aria-describedby="last4-help"
                  className="min-h-11 w-32 rounded-control border border-line bg-white/[0.035] px-3 text-center text-lg tracking-widest"
                />
                <p id="last4-help" className="text-sm text-muted">
                  {t('payReturn.last4Help')}
                </p>
                {asked && !valid ? (
                  <p role="alert" className="text-sm text-bad">
                    {t('payReturn.last4Invalid')}
                  </p>
                ) : null}
                {flow.state === 'unknown' ? (
                  <p role="alert" className="text-sm text-bad">
                    {t('payReturn.noMatch')}
                  </p>
                ) : null}
                <Button type="submit">{t('payReturn.continue')}</Button>
              </form>
            ) : null}

            <div role="status" aria-live="polite" className="space-y-3">
              {waiting ? (
                <>
                  <p>{t('payReturn.pending')}</p>
                  <p className="text-sm text-muted">{t('payReturn.keepOpen')}</p>
                </>
              ) : null}
              {flow.state === 'manual' ? <p>{t('payReturn.manual')}</p> : null}
              {flow.state === 'timedOut' ? <p>{t('payReturn.timedOut')}</p> : null}
              {flow.state === 'rateLimited' ? <p>{t('payReturn.rateLimited')}</p> : null}
              {flow.state === 'ready' ? (
                <>
                  <p>{t('payReturn.ready')}</p>
                  <a className={LINK_PRIMARY} href={setPasswordHref(flow.token)}>
                    {t('payReturn.setPassword')}
                  </a>
                </>
              ) : null}
            </div>

            {flow.state === 'timedOut' || flow.state === 'rateLimited' ? (
              <Button variant="secondary" onClick={start}>
                {t('payReturn.again')}
              </Button>
            ) : null}
            {flow.state === 'manual' || flow.state === 'timedOut' || flow.state === 'rateLimited' ? (
              <a className={LINK_SECONDARY} href={whatsapp} target="_blank" rel="noopener noreferrer">
                {t('payReturn.whatsapp')}
              </a>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
