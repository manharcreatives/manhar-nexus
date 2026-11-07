import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { getAttention, type Attention } from './api';

/**
 * The cases a person must look at: the account job failed (with its safe reason and a retry), money arrived but
 * there is still no account, a payment of the wrong amount, or money on a closed request. Hidden when there is
 * nothing to do, so a quiet day shows nothing. It reloads whenever `refreshKey` changes (after any dialog closes).
 */
export function AttentionStrip({
  onCreate,
  onRetry,
  onAccept,
  refreshKey,
}: {
  /** Open the account dialog for a paid request with no account. */
  onCreate: (registrationId: string) => void;
  /** Open the account dialog to resume a failed job (the owner email can be corrected there). */
  onRetry: (registrationId: string) => void;
  /** Open the "accept as paid" dialog for a mismatched payment. */
  onAccept: (registrationId: string) => void;
  refreshKey?: number;
}) {
  const { t } = useTranslation();
  const [data, setData] = useState<Attention | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await getAttention());
    } catch {
      // A failed check must not break the page; keep whatever we last knew.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const closed = data?.paidClosed ?? [];
  const mismatch = data?.mismatch ?? [];
  if (!data || (data.failedProvisioning.length === 0 && data.paidNotConverted.length === 0 && closed.length === 0 && mismatch.length === 0)) return null;

  return (
    <section aria-label={t('registrations.attention.title')} className="mb-4 rounded-panel border border-bad/40 bg-bad/10 p-4">
      <h2 className="text-base font-semibold">{t('registrations.attention.title')}</h2>
      <ul className="mt-2 space-y-2 text-sm">
        {data.failedProvisioning.map((f) => (
          <li key={`f-${f.registrationId}`} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {t('registrations.attention.failed', { name: f.restaurantName })}
              {f.currentStep ? <span className="block text-xs text-muted">{t('registrations.attention.failedStep', { step: f.currentStep })}</span> : null}
              {f.lastError ? <span className="block text-xs text-muted">{f.lastError}</span> : null}
            </span>
            <Button variant="secondary" onClick={() => onRetry(f.registrationId)}>
              {t('registrations.attention.retry')}
            </Button>
          </li>
        ))}
        {mismatch.map((m) => (
          <li key={`m-${m.registrationId}`} className="flex flex-wrap items-center justify-between gap-2">
            <span>{t('registrations.attention.mismatch', { name: m.restaurantName })}</span>
            <Button variant="secondary" onClick={() => onAccept(m.registrationId)}>
              {t('registrations.attention.accept')}
            </Button>
          </li>
        ))}
        {data.paidNotConverted.map((p) => (
          <li key={`p-${p.registrationId}`} className="flex flex-wrap items-center justify-between gap-2">
            <span>{t('registrations.attention.paid', { name: p.restaurantName })}</span>
            <Button variant="secondary" onClick={() => onCreate(p.registrationId)}>
              {t('registrations.attention.create')}
            </Button>
          </li>
        ))}
        {closed.map((c) => (
          <li key={`c-${c.registrationId}`}>{t('registrations.attention.paidClosed', { name: c.restaurantName })}</li>
        ))}
      </ul>
    </section>
  );
}
