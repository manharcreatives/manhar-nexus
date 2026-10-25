import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { billsApi, type InvoiceDetail, type Payment } from './api';
import {
  canVoid,
  classifyBillError,
  minorToInput,
  nextRefundAttempt,
  refundableMinor,
  refundedTotal,
  validateRefundAmount,
  type RefundAttempt,
} from './helpers';
import { StatusBadge } from './StatusBadge';
import { useAsync } from '../reports/useAsync';
import { formatMoney } from '../lib/money';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Textarea } from '../ui/Textarea';
import { Skeleton } from '../ui/states';
import { StatusPill } from '../ui/StatusPill';
import { useToast } from '../ui/Toast';

interface Props {
  invoiceId: string | null;
  onClose: () => void;
  /** Called after a refund or void so the list can refresh. */
  onChanged: () => void;
}

type Mode = { kind: 'view' } | { kind: 'refund'; paymentId: string; confirming: boolean } | { kind: 'void'; confirming: boolean };

const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '');

export function BillDetailDialog({ invoiceId, onClose, onChanged }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>({ kind: 'view' });
  const [amountText, setAmountText] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Synchronous guard: state updates are async, so a fast double-click could
  // otherwise slip a second request through before `submitting` re-renders.
  const inFlight = useRef(false);
  // One idempotency key per refund attempt (payment + amount): kept across
  // retries so an unknown outcome is replayed, not refunded twice; cleared on
  // success, and replaced automatically when the amount or payment changes.
  const refundAttempt = useRef<RefundAttempt | null>(null);

  const load = useCallback(
    () => (invoiceId ? Promise.all([billsApi.invoice(invoiceId), billsApi.payments(invoiceId)]) : Promise.reject(new Error('no id'))),
    [invoiceId],
  );
  const { data, loading, error, reload } = useAsync<[InvoiceDetail, Payment[]]>(invoiceId ? load : null);
  const invoice = data?.[0];
  const payments = data?.[1] ?? [];

  const resetForm = () => {
    setMode({ kind: 'view' });
    setAmountText('');
    setReason('');
    setFormError(null);
  };
  const close = () => {
    if (inFlight.current) return;
    resetForm();
    onClose();
  };

  const errText = (err: unknown) => t(`bills.err.${classifyBillError(err)}`);

  const startRefund = (p: Payment) => {
    setAmountText(minorToInput(refundableMinor(p)));
    setReason('');
    setFormError(null);
    setMode({ kind: 'refund', paymentId: p.id, confirming: false });
  };

  const activePayment = mode.kind === 'refund' ? payments.find((p) => p.id === mode.paymentId) : undefined;
  const remaining = activePayment ? refundableMinor(activePayment) : 0;
  const amountCheck = validateRefundAmount(amountText, remaining);
  const amountError =
    amountText.trim() !== '' && !amountCheck.ok
      ? t(`bills.refund.amountErr.${amountCheck.reason}`, { max: formatMoney(remaining, invoice?.currencyCode) })
      : null;

  const reviewRefund = () => {
    if (!amountCheck.ok) {
      setFormError(t(`bills.refund.amountErr.${amountCheck.reason}`, { max: formatMoney(remaining, invoice?.currencyCode) }));
      return;
    }
    if (reason.trim() === '') {
      setFormError(t('bills.reasonRequired'));
      return;
    }
    setFormError(null);
    if (mode.kind === 'refund') setMode({ ...mode, confirming: true });
  };

  const submitRefund = async () => {
    if (inFlight.current || mode.kind !== 'refund' || !activePayment || !amountCheck.ok) return;
    inFlight.current = true;
    setSubmitting(true);
    setFormError(null);
    const attempt = nextRefundAttempt(refundAttempt.current, activePayment.id, amountCheck.minor, () => crypto.randomUUID());
    refundAttempt.current = attempt;
    try {
      const refund = await billsApi.refund(activePayment.id, {
        amountMinorUnits: amountCheck.minor,
        reason: reason.trim(),
        idempotencyKey: attempt.key,
      });
      refundAttempt.current = null;
      toast.show(
        refund.status === 'PENDING'
          ? t('bills.refund.donePending', { amount: formatMoney(amountCheck.minor, invoice?.currencyCode) })
          : t('bills.refund.done', { amount: formatMoney(amountCheck.minor, invoice?.currencyCode) }),
        refund.status === 'PENDING' ? 'info' : 'ok',
      );
      resetForm();
      reload();
      onChanged();
    } catch (err) {
      // The outcome may be unknown (e.g. network drop): re-read the real refund
      // state before letting the user try again, so we never double-refund.
      setFormError(errText(err));
      setMode({ ...mode, confirming: false });
      reload();
      onChanged();
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const reviewVoid = () => {
    if (reason.trim() === '') {
      setFormError(t('bills.reasonRequired'));
      return;
    }
    setFormError(null);
    setMode({ kind: 'void', confirming: true });
  };

  const submitVoid = async () => {
    if (inFlight.current || !invoice) return;
    inFlight.current = true;
    setSubmitting(true);
    setFormError(null);
    try {
      await billsApi.voidInvoice(invoice.id, { reason: reason.trim(), expectedVersion: invoice.version });
      toast.show(t('bills.void.done'));
      resetForm();
      reload();
      onChanged();
    } catch (err) {
      setFormError(errText(err));
      setMode({ kind: 'void', confirming: false });
      reload();
      onChanged();
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const title = invoice
    ? invoice.invoiceNumber
      ? t('bills.detail.title', { number: invoice.invoiceNumber })
      : t('bills.detail.titleDraft')
    : t('bills.detail.titleLoading');

  const fmt = (n: number) => formatMoney(n, invoice?.currencyCode);

  // ----- footer ---------------------------------------------------------
  let footer: React.ReactNode = <Button variant="secondary" onClick={close}>{t('bills.close')}</Button>;
  if (mode.kind === 'refund') {
    footer = mode.confirming ? (
      <>
        <Button variant="secondary" disabled={submitting} onClick={() => setMode({ ...mode, confirming: false })}>
          {t('bills.back')}
        </Button>
        <Button variant="danger" loading={submitting} onClick={() => void submitRefund()}>
          {t('bills.refund.confirm', { amount: amountCheck.ok ? fmt(amountCheck.minor) : '' })}
        </Button>
      </>
    ) : (
      <>
        <Button variant="secondary" onClick={resetForm}>{t('bills.cancel')}</Button>
        <Button onClick={reviewRefund}>{t('bills.review')}</Button>
      </>
    );
  } else if (mode.kind === 'void') {
    footer = mode.confirming ? (
      <>
        <Button variant="secondary" disabled={submitting} onClick={() => setMode({ kind: 'void', confirming: false })}>
          {t('bills.back')}
        </Button>
        <Button variant="danger" loading={submitting} onClick={() => void submitVoid()}>
          {t('bills.void.confirm')}
        </Button>
      </>
    ) : (
      <>
        <Button variant="secondary" onClick={resetForm}>{t('bills.cancel')}</Button>
        <Button onClick={reviewVoid}>{t('bills.review')}</Button>
      </>
    );
  }

  return (
    <Dialog open={invoiceId !== null} onClose={close} title={title} footer={footer} className="sm:w-[40rem]">
      {loading && !data && (
        <div aria-hidden className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24" />
          <Skeleton className="h-16" />
        </div>
      )}
      {error && !data && (
        <div role="alert" className="space-y-3">
          <p className="text-sm text-bad">{t('bills.detail.loadError')}</p>
          <Button variant="secondary" onClick={reload}>{t('bills.retry')}</Button>
        </div>
      )}

      {invoice && mode.kind === 'view' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={invoice.status} />
            {invoice.paidAt && <span className="text-sm text-muted">{t('bills.detail.paidAt', { time: fmtTime(invoice.paidAt) })}</span>}
            {invoice.voidedAt && <span className="text-sm text-muted">{t('bills.detail.voidedAt', { time: fmtTime(invoice.voidedAt) })}</span>}
          </div>
          {invoice.voidReason && <p className="text-sm">{t('bills.detail.voidReason', { reason: invoice.voidReason })}</p>}

          <section aria-labelledby="bill-items" className="space-y-2">
            <h3 id="bill-items" className="text-sm font-semibold">{t('bills.detail.items')}</h3>
            {invoice.lines.length === 0 ? (
              <p className="text-sm text-muted">{t('bills.detail.noLines')}</p>
            ) : (
              <ul className="divide-y divide-line/60 rounded-control border border-line">
                {invoice.lines.map((l) => (
                  <li key={l.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0">
                      {l.quantity} x {l.itemNameSnapshot}
                      {l.variantNameSnapshot ? ` (${l.variantNameSnapshot})` : ''}
                      {l.modifiersSummary && <span className="block text-xs text-muted">{l.modifiersSummary}</span>}
                    </span>
                    <span className="tabular shrink-0">{fmt(l.lineTotalMinorUnits)}</span>
                  </li>
                ))}
              </ul>
            )}
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-muted">{t('bills.detail.subtotal')}</dt><dd className="tabular">{fmt(invoice.subtotalMinorUnits)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">{t('bills.detail.tax')}</dt><dd className="tabular">{fmt(invoice.totalTaxMinorUnits)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>{t('bills.detail.total')}</dt><dd className="tabular">{fmt(invoice.grandTotalMinorUnits)}</dd></div>
            </dl>
          </section>

          <section aria-labelledby="bill-pay" className="space-y-2">
            <h3 id="bill-pay" className="text-sm font-semibold">{t('bills.detail.payments')}</h3>
            {payments.length === 0 && <p className="text-sm text-muted">{t('bills.detail.noPayments')}</p>}
            <ul className="space-y-3">
              {payments.map((p) => {
                const refundable = refundableMinor(p);
                return (
                  <li key={p.id} className="space-y-2 rounded-control border border-line p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {t(`bills.method.${p.method}`, { defaultValue: p.method })} - {formatMoney(p.amountMinorUnits, p.currencyCode)}
                      </span>
                      <StatusPill tone={p.status === 'CAPTURED' ? 'ok' : p.status === 'PENDING' ? 'warn' : 'neutral'}>
                        {t(`bills.paymentStatus.${p.status}`, { defaultValue: p.status })}
                      </StatusPill>
                    </div>
                    {p.referenceCode && <p className="text-muted">{t('bills.detail.reference', { ref: p.referenceCode })}</p>}
                    {p.refunds.length > 0 && (
                      <div>
                        <p className="font-medium">
                          {t('bills.detail.refundedSoFar', { amount: formatMoney(refundedTotal(p.refunds), p.currencyCode) })}
                        </p>
                        <ul className="mt-1 space-y-1 text-muted">
                          {p.refunds.map((r) => (
                            <li key={r.id}>
                              {formatMoney(r.amountMinorUnits, p.currencyCode)} - {t(`bills.refundStatus.${r.status}`, { defaultValue: r.status })} - {r.reason}
                              <span className="block text-xs">{fmtTime(r.createdAt)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {refundable > 0 ? (
                      <Button variant="secondary" onClick={() => startRefund(p)}>
                        {t('bills.refund.action', { amount: formatMoney(refundable, p.currencyCode) })}
                      </Button>
                    ) : p.status === 'CAPTURED' ? (
                      <p className="text-muted">{t('bills.refund.fullyRefunded')}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>

          {canVoid(invoice.status) && (
            <section className="space-y-2">
              <p className="text-sm text-muted">{t('bills.void.help')}</p>
              <Button
                variant="secondary"
                onClick={() => {
                  setReason('');
                  setFormError(null);
                  setMode({ kind: 'void', confirming: false });
                }}
              >
                {t('bills.void.action')}
              </Button>
            </section>
          )}
          {invoice.status === 'PAID' && <p className="text-sm text-muted">{t('bills.void.paidHint')}</p>}
        </div>
      )}

      {invoice && mode.kind === 'refund' && activePayment && (
        <div className="space-y-4">
          {!mode.confirming ? (
            <>
              <p className="text-sm text-muted">
                {t('bills.refund.intro', {
                  method: t(`bills.method.${activePayment.method}`, { defaultValue: activePayment.method }),
                  max: fmt(remaining),
                })}
              </p>
              <Field
                label={t('bills.refund.amount')}
                inputMode="decimal"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                error={amountError}
                hint={t('bills.refund.amountHint', { max: fmt(remaining) })}
                disabled={submitting}
              />
              <Textarea
                label={t('bills.reason')}
                value={reason}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
                disabled={submitting}
              />
            </>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="font-medium">
                {t('bills.refund.confirmBody', { amount: amountCheck.ok ? fmt(amountCheck.minor) : '' })}
              </p>
              <p className="text-muted">{t('bills.refund.reasonLabel', { reason })}</p>
              {activePayment.method === 'UPI' && <p className="text-muted">{t('bills.refund.upiNote')}</p>}
              <p className="text-muted">{t('bills.refund.irreversible')}</p>
            </div>
          )}
          {formError && <p role="alert" className="text-sm text-bad">{formError}</p>}
        </div>
      )}

      {invoice && mode.kind === 'void' && (
        <div className="space-y-4">
          {!mode.confirming ? (
            <>
              <p className="text-sm text-muted">{t('bills.void.intro')}</p>
              <Textarea label={t('bills.reason')} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} disabled={submitting} />
            </>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="font-medium">{t('bills.void.confirmBody')}</p>
              <p className="text-muted">{t('bills.refund.reasonLabel', { reason })}</p>
            </div>
          )}
          {formError && <p role="alert" className="text-sm text-bad">{formError}</p>}
        </div>
      )}
    </Dialog>
  );
}
