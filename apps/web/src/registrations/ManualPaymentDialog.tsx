import { useId, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { BILLING_CYCLES, PLAN_PRICES, PRICED_PLAN_KEYS, quotePlan, type BillingCycleKey, type PricedPlanKey, type Quote } from '@nexus/shared';
import { errorMessage } from '../commercial/helpers';
import { FormError } from '../commercial/Shared';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Dialog } from '../ui/Dialog';
import { Field } from '../ui/Field';
import { Select } from '../ui/Select';
import { MANUAL_METHODS, formatRupees, recordManualPayment, type ManualPaymentBody, type ManualPaymentMethod, type PaymentLink, type RegistrationRequest } from './api';
import { parseRupees } from './PaymentLinkDialog';

const isPriced = (key: string): key is PricedPlanKey => (PRICED_PLAN_KEYS as readonly string[]).includes(key);
const isCycle = (key: string): key is BillingCycleKey => (BILLING_CYCLES as readonly string[]).includes(key);
const today = (): string => new Date().toISOString().slice(0, 10);

function ReviewRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
      <dt className="text-muted">{label}</dt>
      <dd className={strong ? 'text-base font-semibold tabular-nums' : 'break-all text-right'}>{value}</dd>
    </div>
  );
}

/**
 * Money that arrived outside Cashfree (UPI, bank transfer, cash). The server prices it from the plan, writes a PAID
 * payment marked as manual with the reference, and starts the account exactly like an online payment would.
 */
export function ManualPaymentDialog({
  request,
  onClose,
  onDone,
}: {
  request: RegistrationRequest;
  onClose: () => void;
  onDone: (payment: PaymentLink) => void;
}) {
  const { t } = useTranslation();
  const formId = useId();
  const [planKey, setPlanKey] = useState<PricedPlanKey | ''>(isPriced(request.planKey) ? request.planKey : '');
  const [cycle, setCycle] = useState<BillingCycleKey>(isCycle(request.billingCycle) ? request.billingCycle : 'yearly');
  const [launchPack, setLaunchPack] = useState(false);
  const [method, setMethod] = useState<ManualPaymentMethod>('UPI');
  const [reference, setReference] = useState('');
  const [paidOn, setPaidOn] = useState(today());
  const [different, setDifferent] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<ManualPaymentBody | null>(null);

  const quote: Quote | null = useMemo(() => {
    if (planKey === '') return null;
    try {
      return quotePlan({ planKey, cycle, offerDate: new Date(request.createdAt), launchPack });
    } catch {
      return null;
    }
  }, [planKey, cycle, launchPack, request.createdAt]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const next: Record<string, string> = {};
    if (planKey === '') next.plan = t('registrations.payment.pickPlan');
    if (reference.trim().length < 3) next.reference = t('registrations.manual.referenceInvalid');
    const rupees = different ? parseRupees(amount) : null;
    if (different && rupees === null) next.amount = t('registrations.payment.amountInvalid');
    if (different && reason.trim().length < 3) next.reason = t('registrations.payment.reasonInvalid');
    setErrors(next);
    if (Object.keys(next).length > 0 || planKey === '') return;
    // Money is recorded only after the operator has read it back once (who, how much, how, what happens next).
    setReview({
      planKey,
      cycle,
      launchPack,
      method,
      reference: reference.trim(),
      paidOn,
      ...(different && rupees !== null ? { amountRupees: rupees, overrideReason: reason.trim() } : {}),
    });
  }

  async function confirm() {
    if (busy || !review) return;
    setBusy(true);
    setError(null);
    try {
      onDone(await recordManualPayment(request.id, review));
    } catch (err) {
      setReview(null);
      setError(errorMessage(err, t('registrations.manual.failed')));
    } finally {
      setBusy(false);
    }
  }

  /** What the owner pays according to the server's quote, or the typed amount when it differs. */
  const reviewAmount = review?.amountRupees !== undefined ? review.amountRupees * 100 : quote?.totalPaise ?? 0;

  return (
    <Dialog
      open
      onClose={() => !busy && onClose()}
      title={t('registrations.manual.title', { name: request.restaurantName })}
      className="w-[min(34rem,calc(100vw-2rem))]"
      footer={
        review ? (
          <>
            <Button variant="secondary" onClick={() => setReview(null)} disabled={busy}>
              {t('registrations.manual.back')}
            </Button>
            <Button onClick={() => void confirm()} loading={busy}>
              {t('registrations.manual.confirm')}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              {t('onboarding.cancel')}
            </Button>
            <Button type="submit" form={formId} loading={busy}>
              {t('registrations.manual.review')}
            </Button>
          </>
        )
      }
    >
      {review ? (
        <div className="space-y-4" aria-live="polite">
          <p className="text-sm text-muted">{t('registrations.manual.reviewIntro')}</p>
          <dl className="nx-glass space-y-2 rounded-panel px-4 py-3 text-sm">
            <ReviewRow label={t('registrations.manual.reviewRestaurant')} value={`${request.restaurantName} · ${request.referenceCode}`} />
            <ReviewRow label={t('registrations.manual.reviewOwner')} value={`${request.contactName} · ${request.email}`} />
            <ReviewRow label={t('registrations.manual.reviewPlan')} value={`${PLAN_PRICES[review.planKey as PricedPlanKey].name} · ${t(`registrations.payment.cycle.${review.cycle}`)}`} />
            <ReviewRow label={t('registrations.manual.reviewAmount')} value={`₹${formatRupees(reviewAmount)}`} strong />
            <ReviewRow label={t('registrations.manual.reviewHow')} value={`${t(`registrations.manual.method.${review.method}`)} · ${review.reference} · ${review.paidOn}`} />
          </dl>
          <p className="rounded-control border border-warn/40 bg-warn/10 px-3 py-2 text-sm">{t('registrations.manual.reviewWarning', { email: request.email })}</p>
          <FormError message={error} />
        </div>
      ) : null}
      <form id={formId} onSubmit={submit} noValidate className={review ? 'hidden' : 'space-y-4'}>
        <p className="text-sm text-muted">{t('registrations.manual.intro')}</p>
        <div className="grid grid-cols-2 gap-3">
          <Select label={t('registrations.payment.planLabel')} value={planKey} error={errors.plan} onChange={(e) => setPlanKey(e.target.value as PricedPlanKey | '')}>
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
        <Checkbox label={t('registrations.payment.launchPack')} checked={launchPack} onChange={(e) => setLaunchPack(e.target.checked)} />
        {quote ? (
          <dl className="nx-glass space-y-1 rounded-panel px-4 py-3 text-sm" aria-label={t('registrations.payment.breakdown')}>
            {quote.lines.map((l) => (
              <div key={l.label} className="flex justify-between gap-4">
                <dt className="text-muted">{l.label}</dt>
                <dd className="tabular-nums">{l.amountPaise < 0 ? `−₹${formatRupees(-l.amountPaise)}` : `₹${formatRupees(l.amountPaise)}`}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 border-t border-white/10 pt-1 font-medium">
              <dt>{t('registrations.manual.expected')}</dt>
              <dd className="tabular-nums">₹{formatRupees(quote.totalPaise)}</dd>
            </div>
          </dl>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Select label={t('registrations.manual.methodLabel')} value={method} onChange={(e) => setMethod(e.target.value as ManualPaymentMethod)}>
            {MANUAL_METHODS.map((m) => (
              <option key={m} value={m}>
                {t(`registrations.manual.method.${m}`)}
              </option>
            ))}
          </Select>
          <Field label={t('registrations.manual.paidOn')} type="date" value={paidOn} max={today()} onChange={(e) => setPaidOn(e.target.value)} />
        </div>
        <Field
          label={t('registrations.manual.referenceLabel')}
          hint={t('registrations.manual.referenceHint')}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          error={errors.reference}
          maxLength={120}
          autoComplete="off"
        />
        <Checkbox label={t('registrations.manual.different')} checked={different} onChange={(e) => setDifferent(e.target.checked)} />
        {different ? (
          <>
            <Field label={t('registrations.payment.amountLabel')} hint={t('registrations.manual.amountHint')} value={amount} onChange={(e) => setAmount(e.target.value)} error={errors.amount} inputMode="decimal" autoComplete="off" />
            <Field label={t('registrations.payment.reasonLabel')} hint={t('registrations.payment.reasonHint')} value={reason} onChange={(e) => setReason(e.target.value)} error={errors.reason} maxLength={200} autoComplete="off" />
          </>
        ) : null}
        <FormError message={error} />
      </form>
    </Dialog>
  );
}
