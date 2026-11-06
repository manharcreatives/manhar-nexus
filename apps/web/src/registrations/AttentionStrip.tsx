import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { getAttention, provisionRegistration, type Attention } from './api';

/**
 * The cases a person must look at: the account job failed (with its safe reason and a retry), or money arrived but
 * there is still no account. Hidden when there is nothing to do, so a quiet day shows nothing.
 */
export function AttentionStrip({ onCreate, onChanged, refreshKey }: { onCreate: (registrationId: string) => void; onChanged: () => void; refreshKey?: number }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [data, setData] = useState<Attention | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  async function retry(registrationId: string) {
    setBusyId(registrationId);
    try {
      const res = await provisionRegistration(registrationId, {});
      toast.show(t(res.status === 'FAILED' ? 'registrations.attention.retryFailed' : 'registrations.attention.retried'));
    } catch {
      toast.show(t('registrations.attention.retryFailed'));
    } finally {
      setBusyId(null);
      await load();
      onChanged();
    }
  }

  if (!data || (data.failedProvisioning.length === 0 && data.paidNotConverted.length === 0)) return null;

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
            <Button variant="secondary" loading={busyId === f.registrationId} onClick={() => void retry(f.registrationId)}>
              {t('registrations.attention.retry')}
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
      </ul>
    </section>
  );
}
