import { useEffect, useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../auth/api';
import { useAuth } from '../auth/AuthContext';
import { applyAccent, hexToRgb } from '../lib/brand';
import { cn } from '../lib/cn';
import { describeError } from '../restaurant/errors';
import { useSingleFlight } from '../restaurant/hooks';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import * as Icons from '../ui/icons';
import { PageHeader } from '../ui/PageHeader';
import { SectionHeader } from '../ui/SectionHeader';
import { ErrorState, Skeleton } from '../ui/states';
import { Textarea } from '../ui/Textarea';
import { useToast } from '../ui/Toast';

interface BusinessProfile {
  name: string;
  legalName: string | null;
  accentColor: string | null;
  invoiceName: string | null;
  invoiceAddress: string | null;
  taxId: string | null;
}

const DEFAULT_ACCENT = '#22c55e';
const PRESETS: Array<{ key: string; hex: string }> = [
  { key: 'green', hex: '#22c55e' },
  { key: 'teal', hex: '#14b8a6' },
  { key: 'blue', hex: '#3b82f6' },
  { key: 'violet', hex: '#8b5cf6' },
  { key: 'rose', hex: '#f43f5e' },
  { key: 'orange', hex: '#f97316' },
  { key: 'amber', hex: '#f59e0b' },
];

/** Owner-only: the restaurant's display name, brand colour and the identity printed on invoices. */
export function ProfilePage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { user, refreshUser } = useAuth();
  const formId = useId();
  const [loaded, setLoaded] = useState<BusinessProfile | null>(null);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [invoiceName, setInvoiceName] = useState('');
  const [invoiceAddress, setInvoiceAddress] = useState('');
  const [taxId, setTaxId] = useState('');
  const [error, setError] = useState('');
  const { busy, run } = useSingleFlight();

  function fill(b: BusinessProfile) {
    setLoaded(b);
    setName(b.name);
    setLegalName(b.legalName ?? '');
    setAccent(b.accentColor ?? DEFAULT_ACCENT);
    setInvoiceName(b.invoiceName ?? '');
    setInvoiceAddress(b.invoiceAddress ?? '');
    setTaxId(b.taxId ?? '');
  }
  const load = () => {
    setFailed(false);
    api<BusinessProfile>('/admin/business').then(fill, () => setFailed(true));
  };
  useEffect(load, []);

  // Preview the colour live; leaving the page without saving restores the saved one.
  const saved = user?.business?.accentColor ?? null;
  useEffect(() => {
    applyAccent(hexToRgb(accent) ? accent : null);
    return () => applyAccent(saved);
  }, [accent, saved]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError(t('profile.nameRequired'));
    if (!hexToRgb(accent)) return setError(t('profile.colourInvalid'));
    await run(async () => {
      try {
        const next = await api<BusinessProfile>('/admin/business', {
          method: 'PATCH',
          body: JSON.stringify({
            name: name.trim(),
            legalName: legalName.trim() || null,
            accentColor: accent.toLowerCase() === DEFAULT_ACCENT ? null : accent,
            invoiceName: invoiceName.trim() || null,
            invoiceAddress: invoiceAddress.trim() || null,
            taxId: taxId.trim() || null,
          }),
        });
        fill(next);
        await refreshUser();
        toast.show(t('profile.saved'), 'ok');
      } catch (err) {
        setError(describeError(err, t, 'profile.failed'));
      }
    });
  }

  const header = <PageHeader eyebrow={t('setup.eyebrow')} title={t('profile.title')} description={t('profile.subtitle')} />;
  if (failed) {
    return (
      <>
        {header}
        <ErrorState title={t('setup.errors.load')} onRetry={load} retryLabel={t('setup.retry')} />
      </>
    );
  }
  if (!loaded) {
    return (
      <>
        {header}
        <Skeleton className="h-64" />
      </>
    );
  }

  return (
    <>
      {header}
      <form id={formId} onSubmit={submit} className="max-w-2xl space-y-10">
        <section aria-labelledby="prof-id">
          <SectionHeader id="prof-id" size="sm" title={t('profile.identity')} />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label={t('profile.name')} hint={t('profile.nameHint')} value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
            <Field label={t('profile.legalName')} value={legalName} onChange={(e) => setLegalName(e.target.value)} maxLength={200} />
          </div>
        </section>

        <section aria-labelledby="prof-colour">
          <SectionHeader id="prof-colour" size="sm" title={t('profile.colour')} />
          <p className="mt-3 text-sm text-muted">{t('profile.colourHint')}</p>
          <div role="radiogroup" aria-label={t('profile.colour')} className="mt-4 flex flex-wrap items-center gap-3">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                role="radio"
                aria-checked={accent.toLowerCase() === p.hex}
                aria-label={t(`profile.preset.${p.key}`)}
                onClick={() => setAccent(p.hex)}
                style={{ backgroundColor: p.hex }}
                className={cn('grid size-11 place-items-center rounded-full ring-offset-2 ring-offset-[#070a09] transition-transform hover:scale-105', accent.toLowerCase() === p.hex ? 'ring-2 ring-white' : 'ring-0')}
              >
                {accent.toLowerCase() === p.hex && <Icons.Check className="size-5 text-[#04120a]" aria-hidden />}
              </button>
            ))}
            <label className="ml-2 flex items-center gap-2 text-sm text-muted">
              {t('profile.custom')}
              <input type="color" value={hexToRgb(accent) ? accent : DEFAULT_ACCENT} onChange={(e) => setAccent(e.target.value)} className="h-11 w-14 cursor-pointer rounded-control border border-white/10 bg-transparent p-1" />
            </label>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3" aria-hidden>
            <span className="nx-primary inline-flex min-h-11 items-center rounded-control px-4 text-sm font-semibold">{t('profile.previewButton')}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/14 px-2.5 py-0.5 text-xs font-medium text-accent-strong">
              <span className="size-1.5 rounded-full bg-current" />
              {t('profile.previewPill')}
            </span>
          </div>
        </section>

        <section aria-labelledby="prof-inv">
          <SectionHeader id="prof-inv" size="sm" title={t('profile.invoice')} />
          <p className="mt-3 text-sm text-muted">{t('profile.invoiceHint')}</p>
          <div className="mt-5 space-y-4">
            <Field label={t('profile.invoiceName')} value={invoiceName} onChange={(e) => setInvoiceName(e.target.value)} maxLength={200} />
            <Textarea label={t('profile.invoiceAddress')} value={invoiceAddress} onChange={(e) => setInvoiceAddress(e.target.value)} maxLength={1000} />
            <Field label={t('profile.taxId')} hint={t('profile.taxIdHint')} value={taxId} onChange={(e) => setTaxId(e.target.value)} maxLength={50} className="ticket-no" />
          </div>
        </section>

        <p role="alert" className="text-sm text-bad">{error}</p>
        <div>
          <Button type="submit" loading={busy}>{t('setup.save')}</Button>
        </div>
      </form>
    </>
  );
}
