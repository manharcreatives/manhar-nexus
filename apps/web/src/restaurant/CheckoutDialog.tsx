import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Skeleton, ErrorState } from '../ui/states';
import { LedgerFigure } from '../ui/LedgerFigure';
import { Stamp } from '../ui/Stamp';
import { useToast } from '../ui/Toast';
import { cn } from '../lib/cn';
import { describeError } from './errors';
import { useSingleFlight } from './hooks';
import { Field } from '../ui/Field';
import { parseMoney } from '../lib/money';
import { type GuestSession, type Invoice, type Payment, checkoutApi, formatMinorUnits } from './api';
import { paymentApi, type PaymentRecord } from './checkout/paymentApi';
import { PaymentKeyRing, classifyPayments, isConflict, isUnknownOutcome, type CheckoutMethod as Method } from './checkout/paymentFlow';

type Phase = 'loading' | 'review' | 'paid' | 'error';
const METHODS: Method[] = ['CASH', 'UPI'];
type Notice = { tone: 'info' | 'ok'; text: string };

export function CheckoutDialog({
  session,
  tableCode,
  onDone,
  onCancel,
  initialMethod = 'CASH',
}: {
  session: GuestSession;
  tableCode: string;
  /** Which method starts selected (the waiter's "payment QR" screen opens checkout on UPI). */
  initialMethod?: Method;
  /** `closeTable` is true when the cashier chose to close the table after payment. */
  onDone: (closeTable: boolean) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [method, setMethod] = useState<Method>(initialMethod);
  const [phase, setPhase] = useState<Phase>('loading');
  const [loadError, setLoadError] = useState('');
  const [payError, setPayError] = useState('');
  const [cashText, setCashText] = useState('');
  const [utr, setUtr] = useState('');
  const [pending, setPending] = useState<Payment | PaymentRecord | null>(null);
  const [changeDue, setChangeDue] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  // The last write got no answer (dropped connection / 5xx): we do not know whether it was recorded.
  const [uncertain, setUncertain] = useState(false);
  const [confirmChange, setConfirmChange] = useState(false);
  const [alreadyRecorded, setAlreadyRecorded] = useState<PaymentRecord | null>(null);
  const loader = useSingleFlight();
  const payer = useSingleFlight();
  // One idempotency key per payment INTENT (invoice + method + amount + cash tendered). A retry after a dropped
  // response reuses it and so replays the original payment; a cancelled attempt retires it (see paymentFlow.ts).
  const keys = useRef(new PaymentKeyRing());

  /** Reads what the server already holds for this bill. `null` = could not find out (no permission or offline). */
  const readRecorded = useCallback(async (invoiceId: string) => {
    try {
      return classifyPayments(await paymentApi.list(invoiceId));
    } catch {
      return null;
    }
  }, []);

  /** Shows a payment that already exists instead of creating another one. Returns true when it took over the screen. */
  const adopt = useCallback(
    (recorded: NonNullable<Awaited<ReturnType<typeof readRecorded>>>, source: 'resume' | 'conflict' | 'check'): boolean => {
      if (recorded.kind === 'captured') {
        setPending(null);
        setConfirmChange(false);
        setUncertain(false);
        setChangeDue(recorded.payment.changeMinorUnits ?? 0);
        setAlreadyRecorded(recorded.payment);
        setPhase('paid');
        return true;
      }
      if (recorded.kind === 'pending') {
        const m: Method = recorded.payment.method === 'CASH' ? 'CASH' : 'UPI';
        setPending(recorded.payment);
        setMethod(m);
        setUncertain(false);
        setPayError('');
        setNotice({
          tone: 'info',
          text: t(source === 'resume' ? 'restaurant.checkout.resumedNotice' : 'restaurant.checkout.recordedNotice', {
            amount: formatMinorUnits(recorded.payment.amountMinorUnits),
          }),
        });
        return true;
      }
      return false;
    },
    [t],
  );

  const { run: runLoad } = loader;
  const loadInvoice = useCallback(
    () =>
      runLoad(async () => {
        setPhase('loading');
        setLoadError('');
        try {
          const inv = await checkoutApi.getOrCreateInvoice(session.id);
          if (inv.status === 'VOID') {
            setLoadError(t('restaurant.checkout.invoiceVoid'));
            setPhase('error');
            return;
          }
          const ready = inv.status === 'FINALISED' || inv.status === 'PAID' ? inv : await checkoutApi.finalise(inv.id);
          setInvoice(ready);
          setPhase(ready.status === 'PAID' ? 'paid' : 'review');
          // A payment may already exist (dialog closed mid-way, another device, a lost response): show it, never duplicate it.
          if (ready.status === 'FINALISED') {
            const recorded = await readRecorded(ready.id);
            if (recorded) adopt(recorded, 'resume');
          }
        } catch (err) {
          setLoadError(describeError(err, t, 'restaurant.errors.loadInvoice'));
          setPhase('error');
        }
      }),
    [runLoad, session.id, t, readRecorded, adopt],
  );

  useEffect(() => {
    void loadInvoice();
  }, [loadInvoice]);

  /** Asks the server what is recorded and adopts it. Returns 'adopted' | 'none' | 'unknown'. */
  async function checkRecorded(source: 'conflict' | 'check'): Promise<'adopted' | 'none' | 'unknown'> {
    if (!invoice) return 'unknown';
    const recorded = await readRecorded(invoice.id);
    if (!recorded) return 'unknown';
    return adopt(recorded, source) ? 'adopted' : 'none';
  }

  async function pay() {
    if (!invoice) return;
    setPayError('');
    setNotice(null);
    const total = invoice.grandTotalMinorUnits;
    let cashReceived: number | undefined;
    if (method === 'CASH') {
      const tendered = cashText.trim() === '' ? total : parseMoney(cashText);
      if (tendered === null || tendered < total) {
        setPayError(t('restaurant.checkout.cashShort'));
        return;
      }
      cashReceived = tendered;
    }
    if (method === 'UPI' && pending && utr.trim() === '') {
      setPayError(t('restaurant.checkout.utrRequired'));
      return;
    }
    await payer.run(async () => {
      try {
        // After a lost response, look before writing again: the earlier attempt may have landed.
        if (uncertain && (await checkRecorded('check')) === 'adopted') return;
        if (method === 'UPI' && pending) {
          await checkoutApi.capture(pending.id, utr.trim());
        } else {
          const created = await checkoutApi.pay(
            invoice.id,
            method,
            total,
            keys.current.keyFor({ invoiceId: invoice.id, method, amountMinorUnits: total, cashReceivedMinorUnits: cashReceived }),
            cashReceived ? { cashReceivedMinorUnits: cashReceived } : {},
          );
          if (method === 'UPI' && created.status !== 'CAPTURED') {
            setPending(created);
            setUncertain(false);
            return;
          }
          if (cashReceived) setChangeDue(cashReceived - total);
        }
        setUncertain(false);
        toast.show(t('restaurant.checkout.paidToast', { amount: formatMinorUnits(total) }));
        setPhase('paid');
      } catch (err) {
        if (isUnknownOutcome(err)) {
          // Retrying is safe: same intent, same idempotency key, and the capture of a UTR is idempotent too.
          setUncertain(true);
        } else if (isConflict(err)) {
          const r = await checkRecorded('conflict');
          if (r !== 'adopted') setPayError(describeError(err, t, 'restaurant.errors.payment'));
        } else {
          setPayError(describeError(err, t, 'restaurant.errors.payment'));
        }
      }
    });
  }

  /** Switches between methods. Typed cash / UTR are kept; a recorded UPI request needs the explicit flow below. */
  function chooseMethod(m: Method) {
    if (m === method || payer.busy || pending) return;
    setMethod(m);
    setPayError('');
    setNotice(null);
  }

  async function changeAfterUncertainty() {
    await payer.run(async () => {
      setPayError('');
      const r = await checkRecorded('check');
      if (r === 'none') {
        setUncertain(false);
        setNotice({ tone: 'info', text: t('restaurant.checkout.nothingRecorded') });
      } else if (r === 'unknown') {
        setPayError(t('restaurant.checkout.checkFailed'));
      }
    });
  }

  /** Cancels the pending UPI request (after the cashier confirmed the guest has not paid) and returns to method choice. */
  async function cancelPendingAndChange() {
    if (!pending || !invoice) return;
    await payer.run(async () => {
      setPayError('');
      try {
        await paymentApi.cancel(pending.id);
        keys.current.retireMethod(pending.method === 'CASH' ? 'CASH' : 'UPI');
        setPending(null);
        setConfirmChange(false);
        setUncertain(false);
        setMethod('CASH');
        setNotice({ tone: 'info', text: utr.trim() ? t('restaurant.checkout.switchedKeptNotice') : t('restaurant.checkout.switchedNotice') });
      } catch (err) {
        // Whatever went wrong, the server is the truth: look at it.
        const recorded = await readRecorded(invoice.id);
        if (recorded?.kind === 'captured') {
          adopt(recorded, 'check');
          setNotice({ tone: 'ok', text: t('restaurant.checkout.cancelRaced') });
        } else if (recorded?.kind === 'none') {
          keys.current.retireMethod('UPI');
          setPending(null);
          setConfirmChange(false);
          setMethod('CASH');
          setNotice({ tone: 'info', text: t('restaurant.checkout.switchedNotice') });
        } else {
          setPayError(isUnknownOutcome(err) || recorded === null ? t('restaurant.checkout.cancelUnknown') : describeError(err, t, 'restaurant.errors.payment'));
        }
      }
    });
  }

  const footer =
    phase === 'review' && invoice ? (
      <>
        <Button variant="secondary" size="lg" onClick={onCancel} disabled={payer.busy}>
          {pending ? t('restaurant.common.close') : t('restaurant.common.cancel')}
        </Button>
        <Button size="lg" loading={payer.busy} disabled={confirmChange} onClick={() => void pay()}>
          {payer.busy
            ? t('restaurant.checkout.processing')
            : method === 'UPI'
              ? pending
                ? t('restaurant.checkout.confirmUpi')
                : t('restaurant.checkout.startUpi')
              : t('restaurant.checkout.collect', { amount: formatMinorUnits(invoice.grandTotalMinorUnits) })}
        </Button>
      </>
    ) : phase === 'paid' ? (
      <>
        <Button variant="secondary" size="lg" onClick={() => onDone(false)}>
          {t('restaurant.checkout.later')}
        </Button>
        <Button size="lg" onClick={() => onDone(true)}>
          {t('restaurant.checkout.closeTable')}
        </Button>
      </>
    ) : (
      <Button variant="secondary" size="lg" onClick={onCancel}>
        {t('restaurant.common.close')}
      </Button>
    );

  return (
    <Dialog
      open
      onClose={onCancel}
      title={t('restaurant.checkout.title', { code: tableCode })}
      className="w-[min(40rem,calc(100vw-1rem))]!"
      footer={footer}
      closeOnBackdrop={!payer.busy}
    >
      <div aria-live="polite">
        {phase === 'loading' && (
          <div role="status" aria-label={t('restaurant.checkout.loading')} className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-2/3" />
          </div>
        )}

        {phase === 'error' && (
          <ErrorState
            title={t('restaurant.checkout.loadErrorTitle')}
            body={loadError}
            onRetry={() => void loadInvoice()}
            retryLabel={t('restaurant.common.retry')}
          />
        )}

        {phase === 'paid' && invoice && (
          <div className="relative overflow-hidden rounded-panel border border-ok/25 bg-ok-soft/55 px-6 pt-9 pb-8 text-center">
            <Stamp size="lg" label={t('restaurant.checkout.paidStamp')} className="bg-surface/70" />
            <p className="mt-5 font-display text-2xl font-semibold text-ok">{t('restaurant.checkout.paidTitle')}</p>
            <p className="mt-3">
              <LedgerFigure minor={invoice.grandTotalMinorUnits} rule="double" className="text-[2.75rem]" />
            </p>
            <p className="mx-auto mt-4 max-w-xs text-sm text-ink">
              {alreadyRecorded
                ? t('restaurant.checkout.alreadyPaidBody', { method: t(`restaurant.checkout.methods.${alreadyRecorded.method === 'CASH' ? 'CASH' : 'UPI'}`) })
                : t('restaurant.checkout.paidBody')}
            </p>
            {changeDue > 0 && (
              <p className="tabular mt-3 inline-block rounded-control bg-surface px-3 py-1.5 text-lg font-semibold">
                {t('restaurant.checkout.changeGiven', { amount: formatMinorUnits(changeDue) })}
              </p>
            )}
          </div>
        )}

        {phase === 'review' && invoice && (
          <div className="space-y-5">
            <div className="nx-stub rounded-panel border border-line bg-white/[0.03] [--stub-bg:var(--color-surface)]">
              <ul aria-label={t('restaurant.checkout.item')} className="max-h-[30dvh] space-y-2 overflow-y-auto px-4 pt-4 pb-3">
                {invoice.lines.map((line) => (
                  <li key={line.id} className="flex items-baseline gap-2 text-base">
                    <span className="tabular w-7 shrink-0 font-semibold">{line.quantity}×</span>
                    <span className="min-w-0">
                      {line.itemNameSnapshot}
                      {line.variantNameSnapshot && <span className="block text-xs text-muted">{line.variantNameSnapshot}</span>}
                    </span>
                    <span aria-hidden className="mb-1 min-w-4 flex-1 self-end border-b border-dotted border-muted/45" />
                    <span className="tabular shrink-0">{formatMinorUnits(line.lineTotalMinorUnits)}</span>
                  </li>
                ))}
              </ul>
              <div className="nx-tear" />
              <dl className="tabular space-y-1 px-4 pt-3 pb-4 text-sm">
                <div className="flex justify-between text-muted">
                  <dt>{t('restaurant.checkout.subtotal')}</dt>
                  <dd>{formatMinorUnits(invoice.subtotalMinorUnits)}</dd>
                </div>
                <div className="flex justify-between text-muted">
                  <dt>{t('restaurant.checkout.tax')}</dt>
                  <dd>{formatMinorUnits(invoice.totalTaxMinorUnits)}</dd>
                </div>
                <div className="flex items-end justify-between gap-4 pt-3">
                  <dt className="eyebrow pb-1.5">{t('restaurant.checkout.grandTotal')}</dt>
                  <dd>
                    <LedgerFigure minor={invoice.grandTotalMinorUnits} rule="double" className="text-[2.5rem]" />
                  </dd>
                </div>
              </dl>
            </div>

            {notice && (
              <p
                role="status"
                className={cn(
                  'rounded-control border px-3 py-2 text-sm',
                  notice.tone === 'ok' ? 'border-ok/30 bg-ok-soft text-ink' : 'border-info/30 bg-info-soft text-ink',
                )}
              >
                {notice.text}
              </p>
            )}

            <fieldset disabled={payer.busy || pending !== null}>
              <legend className="mb-2 text-sm font-medium">{t('restaurant.checkout.method')}</legend>
              <div className="grid grid-cols-2 gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={method === m}
                    onClick={() => chooseMethod(m)}
                    className={cn(
                      'nx-press flex min-h-12 items-center justify-center gap-2 rounded-control border text-base font-medium disabled:opacity-50',
                      method === m
                        ? 'border-accent bg-accent-soft text-accent-strong shadow-[inset_0_0_0_1px_var(--color-accent)]'
                        : 'border-white/10 bg-white/[0.03] hover:border-accent/40',
                    )}
                  >
                    <span aria-hidden className={cn('size-2 rounded-full border-2 border-current', method === m && 'bg-current')} />
                    {t(`restaurant.checkout.methods.${m}`)}
                  </button>
                ))}
              </div>
            </fieldset>

            {method === 'CASH' && (
              <div>
                <Field
                  label={t('restaurant.checkout.cashReceived')}
                  inputMode="decimal"
                  autoComplete="off"
                  value={cashText}
                  placeholder={(invoice.grandTotalMinorUnits / 100).toFixed(2)}
                  onChange={(e) => setCashText(e.target.value)}
                  disabled={payer.busy}
                />
                {parseMoney(cashText) !== null && (parseMoney(cashText) ?? 0) > invoice.grandTotalMinorUnits && (
                  <p className="tabular mt-1.5 text-sm font-medium text-ok">
                    {t('restaurant.checkout.changeDue', { amount: formatMinorUnits((parseMoney(cashText) ?? 0) - invoice.grandTotalMinorUnits) })}
                  </p>
                )}
              </div>
            )}

            {method === 'UPI' && pending && (
              <div className="rounded-panel border border-info/30 bg-info-soft p-4">
                <p className="font-display text-lg font-semibold text-info">{t('restaurant.checkout.upiPendingTitle')}</p>
                <p className="mb-3 mt-1 text-sm">{t('restaurant.checkout.upiPendingBody', { amount: formatMinorUnits(invoice.grandTotalMinorUnits) })}</p>
                <Field
                  label={t('restaurant.checkout.utr')}
                  autoComplete="off"
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                  disabled={payer.busy}
                />
                {!confirmChange ? (
                  <Button variant="ghost" className="mt-3 -ml-2" disabled={payer.busy} onClick={() => setConfirmChange(true)}>
                    {t('restaurant.checkout.changeMethod')}
                  </Button>
                ) : (
                  <div role="group" aria-label={t('restaurant.checkout.changeConfirmTitle')} className="mt-3 rounded-control border border-warn/40 bg-warn-soft p-3">
                    <p className="text-sm font-semibold text-warn">{t('restaurant.checkout.changeConfirmTitle')}</p>
                    <p className="mt-1 text-sm text-ink">{t('restaurant.checkout.changeConfirmBody', { amount: formatMinorUnits(invoice.grandTotalMinorUnits) })}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="secondary" data-autofocus disabled={payer.busy} onClick={() => setConfirmChange(false)}>
                        {t('restaurant.checkout.changeKeep')}
                      </Button>
                      <Button variant="danger" loading={payer.busy} onClick={() => void cancelPendingAndChange()}>
                        {payer.busy ? t('restaurant.checkout.changing') : t('restaurant.checkout.changeYes')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!pending && utr.trim() !== '' && method === 'UPI' && (
              <p className="text-sm text-muted">{t('restaurant.checkout.utrKept', { utr: utr.trim() })}</p>
            )}

            {uncertain && (
              <div role="alert" className="rounded-control border border-warn/40 bg-warn-soft p-3">
                <p className="text-sm font-semibold text-warn">{t('restaurant.checkout.uncertainTitle')}</p>
                <p className="mt-1 text-sm text-ink">{t('restaurant.checkout.uncertainBody')}</p>
                <Button variant="secondary" className="mt-3" loading={payer.busy} onClick={() => void changeAfterUncertainty()}>
                  {payer.busy ? t('restaurant.checkout.checking') : t('restaurant.checkout.checkStatus')}
                </Button>
              </div>
            )}

            <p role="alert" className="text-sm text-bad">
              {payError}
            </p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
