import { useId, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { BILLING_CYCLES, PLAN_PRICES, PRICED_PLAN_KEYS, quotePlan, type BillingCycleKey, type PricedPlanKey, type Quote } from '@nexus/shared';
import { FormError } from '../commercial/Shared';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Field } from '../ui/Field';
import { Select } from '../ui/Select';
import { createPaymentLink, formatRupees, isOpenLink, paymentMessage, whatsappUrl, type PaymentLink, type RegistrationRequest } from './api';

/** Errors the user can act on (not configured, Cashfree refused, already paid) are shown as the server wrote them. */
function messageOf(err: unknown, fallback: string): string {
  const e = err as { status?: number; message?: string } | null;
  return e && [400, 409, 422, 502, 503].includes(e.status ?? 0) && e.message ? e.message : fallback;
}

/** The amount typed, in rupees, or null when it is not a positive number with at most two decimals. */
export function parseRupees(input: string): number | null {
  const text = input.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const n = Number(text);
  return n > 0 && n <= 1_000_000 ? n : null;
}

const isPriced = (key: string): key is PricedPlanKey => (PRICED_PLAN_KEYS as readonly string[]).includes(key);
const isCycle = (key: string): key is BillingCycleKey => (BILLING_CYCLES as readonly string[]).includes(key);

export function PaymentLinkDialog({
  request,
  onClose,
  onCreated,
}: {
  request: RegistrationRequest;
  onClose: () => void;
  /** Called once the link exists, so the page can show it in the list. */
  onCreated: (link: PaymentLink) => void;
}) {
  const { t } = useTranslation();
  const formId = useId();
  // Start from what the visitor chose on the landing page; "not sure" and Many Doors need staff to pick.
  const [planKey, setPlanKey] = useState<PricedPlanKey | ''>(isPriced(request.planKey) ? request.planKey : '');
  const [cycle, setCycle] = useState<BillingCycleKey>(isCycle(request.billingCycle) ? request.billingCycle : 'yearly');
  const [launchPack, setLaunchPack] = useState(false);
  const [manual, setManual] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<PaymentLink | null>(null);
  const [copied, setCopied] = useState(false);

  const hasOpenLink = request.payments.some((p) => isOpenLink(p));

  // The same quote the server will make (same catalog, Founding judged at the day they registered).
  const quote: Quote | null = useMemo(() => {
    if (manual || planKey === '') return null;
    try {
      return quotePlan({ planKey, cycle, offerDate: new Date(request.createdAt), launchPack });
    } catch {
      return null;
    }
  }, [manual, planKey, cycle, launchPack, request.createdAt]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setFieldError(null);
    setReasonError(null);
    setError(null);
    let body: Parameters<typeof createPaymentLink>[1];
    if (manual) {
      const rupees = parseRupees(amount);
      if (rupees === null) {
        setFieldError(t('registrations.payment.amountInvalid'));
        return;
      }
      if (reason.trim().length < 3) {
        setReasonError(t('registrations.payment.reasonInvalid'));
        return;
      }
      body = { amountRupees: rupees, overrideReason: reason.trim() };
    } else {
      if (planKey === '') {
        setError(t('registrations.payment.pickPlan'));
        return;
      }
      body = { planKey, cycle, launchPack };
    }
    if (replaceOpen) body = { ...body, replaceOpen: true };
    setBusy(true);
    try {
      const created = await createPaymentLink(request.id, body);
      setLink(created);
      onCreated(created);
    } catch (err) {
      setError(messageOf(err, t('registrations.payment.createFailed')));
    } finally {
      setBusy(false);
    }
  }

  function copy(value: string) {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const footer = link ? (
    <Button onClick={onClose}>{t('registrations.payment.done')}</Button>
  ) : (
    <>
      <Button variant="secondary" onClick={onClose}>
        {t('onboarding.cancel')}
      </Button>
      <Button type="submit" form={formId} loading={busy}>
        {t('registrations.payment.create')}
      </Button>
    </>
  );

  return (
    <Dialog open onClose={() => !busy && onClose()} title={t('registrations.payment.title', { name: request.restaurantName })} className="w-[min(34rem,calc(100vw-2rem))]" footer={footer}>
      {link ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">{t('registrations.payment.ready', { amount: formatRupees(link.amountPaise) })}</p>
          <p className="nx-glass break-all rounded-panel px-4 py-3 text-sm">{link.linkUrl}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => copy(link.linkUrl)}>
              {copied ? t('registrations.payment.copied') : t('registrations.payment.copy')}
            </Button>
            <a
              className="inline-flex min-h-11 items-center rounded-control border border-white/10 bg-white/[0.04] px-4 text-sm hover:border-accent/40"
              href={whatsappUrl(request.phone, paymentMessage(request, link))}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('registrations.payment.whatsapp')}
            </a>
          </div>
          <p className="text-sm text-muted">{t('registrations.payment.emailed', { email: request.email })}</p>
        </div>
      ) : (
        <form id={formId} onSubmit={submit} noValidate className="space-y-4">
          <p className="text-sm text-muted">{t('registrations.payment.intro')}</p>

          {hasOpenLink ? (
            <label className="flex items-start gap-2 rounded-control border border-amber-400/30 bg-amber-400/10 p-3 text-sm">
              <input type="checkbox" className="mt-1" checked={replaceOpen} onChange={(e) => setReplaceOpen(e.target.checked)} />
              <span>{t('registrations.payment.replaceOpen')}</span>
            </label>
          ) : null}

          {manual ? (
            <>
              <Field
                label={t('registrations.payment.amountLabel')}
                hint={t('registrations.payment.amountHint')}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                error={fieldError}
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                data-autofocus
              />
              <Field
                label={t('registrations.payment.reasonLabel')}
                hint={t('registrations.payment.reasonHint')}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                error={reasonError}
                maxLength={200}
                autoComplete="off"
              />
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Select label={t('registrations.payment.planLabel')} value={planKey} onChange={(e) => setPlanKey(e.target.value as PricedPlanKey | '')}>
                  <option value="">{t('registrations.payment.planChoose')}</option>
                  {PRICED_PLAN_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {PLAN_PRICES[k].name}
                    </option>
                  ))}
                </Select>
                <Select label={t('registrations.payment.cycleLabel')} value={cycle} onChange={(e) => setCycle(e.target.value as BillingCycleKey)}>
                  {BILLING_CYCLES.map((c) => (
                    <option key={c} value={c}>
                      {t(`registrations.payment.cycle.${c}`)}
                    </option>
                  ))}
                </Select>
              </div>
              {planKey === '' ? <p className="text-sm text-muted">{t('registrations.payment.pickPlanHint', { plan: request.planKey })}</p> : null}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={launchPack} onChange={(e) => setLaunchPack(e.target.checked)} />
                {t('registrations.payment.launchPack')}
              </label>
              {quote ? (
                <dl className="nx-glass space-y-1 rounded-panel px-4 py-3 text-sm" aria-label={t('registrations.payment.breakdown')}>
                  {quote.lines.map((l) => (
                    <div key={l.label} className="flex justify-between gap-4">
                      <dt className="text-muted">{l.label}</dt>
                      <dd className="tabular-nums">{l.amountPaise < 0 ? `−₹${formatRupees(-l.amountPaise)}` : `₹${formatRupees(l.amountPaise)}`}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between gap-4 border-t border-white/10 pt-1 font-medium">
                    <dt>{t('registrations.payment.total')}</dt>
                    <dd className="tabular-nums">₹{formatRupees(quote.totalPaise)}</dd>
                  </div>
                </dl>
              ) : null}
            </>
          )}

          <button type="button" className="text-sm text-accent underline" onClick={() => setManual((m) => !m)}>
            {manual ? t('registrations.payment.usePlan') : t('registrations.payment.typeAmount')}
          </button>
          <FormError message={error} />
        </form>
      )}
    </Dialog>
  );
}
