import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PLAN_PRICES, PRICED_PLAN_KEYS, type PricedPlanKey } from '@nexus/shared';
import { FormError } from '../commercial/Shared';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Select } from '../ui/Select';
import { formatRupees, whatsappUrl, type RegistrationRequest } from './api';
import {
  authorisationUrl,
  autopayMessage,
  cancelSubscription,
  createSubscription,
  isLiveSubscription,
  listSubscriptions,
  refreshSubscription,
  type Subscription,
} from './subscriptionApi';

function messageOf(err: unknown, fallback: string): string {
  const e = err as { status?: number; message?: string } | null;
  return e && [400, 409, 422, 502, 503].includes(e.status ?? 0) && e.message ? e.message : fallback;
}

const isPriced = (key: string): key is PricedPlanKey => (PRICED_PLAN_KEYS as readonly string[]).includes(key);

/** Staff: send the owner a UPI AutoPay mandate link for the monthly plan, watch it, cancel it. */
export function AutopayDialog({ request, onClose }: { request: RegistrationRequest; onClose: () => void }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Subscription[] | null>(null);
  const [planKey, setPlanKey] = useState<PricedPlanKey | ''>(isPriced(request.planKey) ? request.planKey : '');
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listSubscriptions(request.id));
    } catch (err) {
      setItems([]);
      setError(messageOf(err, t('registrations.autopay.loadFailed')));
    }
  }, [request.id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const live = (items ?? []).filter(isLiveSubscription);
  const waiting = live.some((s) => s.status === 'INITIALIZED');
  const blocked = live.some((s) => s.status !== 'INITIALIZED');

  async function run(key: string, work: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    setError(null);
    setNote(null);
    try {
      await work();
      await load();
    } catch (err) {
      setError(messageOf(err, t('registrations.autopay.failed')));
    } finally {
      setBusy(null);
    }
  }

  const create = () =>
    run('create', async () => {
      await createSubscription(request.id, { ...(planKey ? { planKey } : {}), ...(replaceOpen ? { replaceOpen: true } : {}) });
      setReplaceOpen(false);
    });

  const check = (s: Subscription) =>
    run(s.id, async () => {
      const { outcome } = await refreshSubscription(request.id, s.id);
      setNote(t(outcome === 'updated' ? 'registrations.autopay.checkedUpdated' : 'registrations.autopay.checkedSame'));
    });

  const cancel = (s: Subscription) => run(s.id, async () => void (await cancelSubscription(request.id, s.id)));

  function copy(url: string, id: string) {
    void navigator.clipboard?.writeText(url).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1800);
    });
  }

  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      title={t('registrations.autopay.title', { name: request.restaurantName })}
      className="w-[min(36rem,calc(100vw-2rem))]"
      footer={<Button onClick={onClose}>{t('registrations.payment.done')}</Button>}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">{t('registrations.autopay.intro')}</p>

        {items === null ? <p className="text-sm text-muted">{t('auth.loading')}</p> : null}

        {(items ?? []).length > 0 ? (
          <ul className="space-y-2" aria-label={t('registrations.autopay.listLabel')}>
            {(items ?? []).map((s) => {
              const url = authorisationUrl(s);
              return (
                <li key={s.id} className="space-y-2 rounded-control bg-white/[0.04] px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      ₹{formatRupees(s.amountPaise)} {t('registrations.autopay.perMonth')} · {PLAN_PRICES[s.planKey as PricedPlanKey]?.name ?? s.planKey}
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{t(`registrations.autopay.status.${s.status}`, { defaultValue: s.status })}</span>
                  </div>
                  {s.lastChargeStatus ? (
                    <p className="text-xs text-muted">{t('registrations.autopay.lastCharge', { status: t(`registrations.autopay.charge.${s.lastChargeStatus}`, { defaultValue: s.lastChargeStatus }), date: new Date(s.lastChargeAt ?? s.createdAt).toLocaleDateString() })}</p>
                  ) : null}
                  {s.lastChargeStatus === 'AMOUNT_MISMATCH' ? <p className="text-xs text-amber-300">{t('registrations.autopay.mismatch')}</p> : null}
                  <div className="flex flex-wrap items-center gap-3">
                    {url ? (
                      <>
                        <button type="button" className="underline" onClick={() => copy(url, s.id)}>
                          {copied === s.id ? t('registrations.payment.copied') : t('registrations.payment.copy')}
                        </button>
                        <a className="underline" href={whatsappUrl(request.phone, autopayMessage(request, url, s.amountPaise, formatRupees))} target="_blank" rel="noopener noreferrer">
                          {t('registrations.payment.whatsapp')}
                        </a>
                      </>
                    ) : null}
                    {isLiveSubscription(s) ? (
                      <>
                        <button type="button" className="underline disabled:opacity-50" disabled={busy !== null} onClick={() => void check(s)}>
                          {t('registrations.autopay.check')}
                        </button>
                        <button type="button" className="underline disabled:opacity-50" disabled={busy !== null} onClick={() => void cancel(s)}>
                          {t('registrations.autopay.cancel')}
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : items !== null ? (
          <p className="text-sm text-muted">{t('registrations.autopay.none')}</p>
        ) : null}

        {items !== null && !blocked ? (
          <div className="space-y-3 border-t border-white/10 pt-3">
            {!isPriced(request.planKey) ? (
              <Select label={t('registrations.payment.planLabel')} value={planKey} onChange={(e) => setPlanKey(e.target.value as PricedPlanKey | '')}>
                <option value="">{t('registrations.payment.planChoose')}</option>
                {PRICED_PLAN_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {PLAN_PRICES[k].name}
                  </option>
                ))}
              </Select>
            ) : null}
            {waiting ? (
              <label className="flex items-start gap-2 rounded-control border border-amber-400/30 bg-amber-400/10 p-3 text-sm">
                <input type="checkbox" className="mt-1" checked={replaceOpen} onChange={(e) => setReplaceOpen(e.target.checked)} />
                <span>{t('registrations.autopay.replace')}</span>
              </label>
            ) : null}
            <Button onClick={() => void create()} loading={busy === 'create'} disabled={(waiting && !replaceOpen) || (!isPriced(request.planKey) && planKey === '')}>
              {t('registrations.autopay.create')}
            </Button>
          </div>
        ) : null}
        {blocked ? <p className="text-sm text-muted">{t('registrations.autopay.blocked')}</p> : null}

        {note ? <p className="text-sm text-muted">{note}</p> : null}
        <FormError message={error} />
      </div>
    </Dialog>
  );
}
