import { useCallback, useEffect, useState, type ReactNode } from 'react';
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
  onView,
  refreshKey,
}: {
  /** Scroll to the request the row is about (so the operator sees it in context before acting). */
  onView?: (registrationId: string) => void;
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
  const [showAll, setShowAll] = useState(false);

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

  /** One row: what happened, the request's reference code, a jump to its card, and the one action that fixes it. */
  const row = (key: string, id: string, ref: string | undefined, text: ReactNode, action?: ReactNode) => (
    <li key={key} className="flex flex-wrap items-center justify-between gap-2">
      <span className="min-w-0">
        {text}
        {ref ? <span className="ticket-no ml-2 text-xs text-muted">{ref}</span> : null}
      </span>
      <span className="flex flex-wrap items-center gap-2">
        {onView ? (
          <button type="button" className="inline-flex min-h-11 items-center px-2 text-sm underline" onClick={() => onView(id)}>
            {t('registrations.attention.view')}
          </button>
        ) : null}
        {action}
      </span>
    </li>
  );
  const rows = [
    ...data.failedProvisioning.map((f) =>
      row(
        `f-${f.registrationId}`,
        f.registrationId,
        f.referenceCode,
        <>
          {t('registrations.attention.failed', { name: f.restaurantName })}
          {f.currentStep ? <span className="block text-xs text-muted">{t('registrations.attention.failedStep', { step: f.currentStep })}</span> : null}
          {f.lastError ? <span className="block text-xs text-muted">{f.lastError}</span> : null}
        </>,
        <Button variant="secondary" onClick={() => onRetry(f.registrationId)}>
          {t('registrations.attention.retry')}
        </Button>,
      ),
    ),
    ...mismatch.map((m) =>
      row(
        `m-${m.registrationId}`,
        m.registrationId,
        m.referenceCode,
        t('registrations.attention.mismatch', { name: m.restaurantName }),
        <Button variant="secondary" onClick={() => onAccept(m.registrationId)}>
          {t('registrations.attention.accept')}
        </Button>,
      ),
    ),
    ...data.paidNotConverted.map((p) =>
      row(
        `p-${p.registrationId}`,
        p.registrationId,
        p.referenceCode,
        t('registrations.attention.paid', { name: p.restaurantName }),
        <Button variant="secondary" onClick={() => onCreate(p.registrationId)}>
          {t('registrations.attention.create')}
        </Button>,
      ),
    ),
    ...closed.map((c) => row(`c-${c.registrationId}`, c.registrationId, c.referenceCode, t('registrations.attention.paidClosed', { name: c.restaurantName }))),
  ];
  const LIMIT = 5;
  const visible = showAll ? rows : rows.slice(0, LIMIT);

  return (
    <section aria-label={t('registrations.attention.title')} className="mb-4 rounded-panel border border-bad/40 bg-bad/10 p-4">
      <h2 className="text-base font-semibold">{t('registrations.attention.title')}</h2>
      <ul className="mt-2 space-y-2 text-sm">{visible}</ul>
      {rows.length > LIMIT ? (
        <button type="button" className="mt-2 min-h-11 text-sm underline" onClick={() => setShowAll((s) => !s)}>
          {showAll ? t('registrations.attention.showLess') : t('registrations.attention.showMore', { count: rows.length - LIMIT })}
        </button>
      ) : null}
    </section>
  );
}
