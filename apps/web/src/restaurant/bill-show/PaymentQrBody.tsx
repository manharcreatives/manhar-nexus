import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { QrSvg } from '../../qr/QrSvg';
import { LedgerFigure } from '../../ui/LedgerFigure';
import { Skeleton } from '../../ui/states';
import { formatMoney } from '../../lib/money';
import { Stamp } from '../../ui/Stamp';
import { Button } from '../../ui/Button';
import { useLiveRefresh } from '../../realtime/RealtimeProvider';
import { describeError } from '../errors';
import { billShowApi, type PaymentQrReason, type PaymentQrView } from './billShowApi';
import type { BillShowCaps } from './permissions';
import { UpiSetupForm } from './UpiSetupForm';
import { useRemote } from './useRemote';
import { Smartphone } from './icons';

const REASON_KEYS: Record<PaymentQrReason, string> = {
  NOT_FINALISED: 'billShow.qr.reasons.NOT_FINALISED',
  PAID: 'billShow.qr.reasons.PAID',
  VOID: 'billShow.qr.reasons.VOID',
  UPI_NOT_CONFIGURED: 'billShow.qr.reasons.UPI_NOT_CONFIGURED',
  UPI_INVALID: 'billShow.qr.reasons.UPI_INVALID',
};

/**
 * Customer-facing UPI payment screen: a large, high-contrast QR built (server side) from the restaurant's UPI ID and the
 * bill's exact payable amount, the amount and bill reference in plain words, and a deep link for the guest's own phone.
 * It only DISPLAYS; the payment is recorded by staff through the normal checkout flow ("Mark as collected").
 */
export function PaymentQrBody({
  invoiceId,
  caps,
  onRecordPayment,
  onBack,
  onChanged,
}: {
  invoiceId: string;
  caps: BillShowCaps;
  onRecordPayment?: () => void;
  onBack?: () => void;
  /** Called when the payment turned out to be paid (so the table list can refresh). */
  onChanged?: () => void;
}) {
  const { t } = useTranslation();
  const fetchQr = useCallback(() => billShowApi.paymentQr(invoiceId), [invoiceId]);
  const { state, reload } = useRemote<PaymentQrView>(fetchQr);
  // Realtime payment/invoice events plus the shared safety-net poll flip "Waiting" to "Paid" without a tap.
  useLiveRefresh(['payments', 'invoices'], reload, state.data ? !state.data.paid : true);
  const q = state.data;
  const paid = q?.paid === true;
  useEffect(() => {
    if (paid) onChanged?.();
  }, [paid, onChanged]);

  if (!q) {
    if (state.status === 'error') {
      return (
        <div role="alert" className="py-8 text-center">
          <p className="text-lg font-semibold text-bad">{t('billShow.qr.errorTitle')}</p>
          <p className="mx-auto mt-1 max-w-sm text-base">{describeError(state.error, t, 'billShow.qr.errorBody')}</p>
          <div className="mt-4 flex justify-center gap-2">
            {onBack && (
              <Button variant="secondary" onClick={onBack}>
                {t('billShow.back')}
              </Button>
            )}
            <Button onClick={reload}>{t('restaurant.common.retry')}</Button>
          </div>
        </div>
      );
    }
    return (
      <div role="status" aria-label={t('billShow.loading')} className="flex flex-col items-center gap-4 py-6">
        <Skeleton className="size-72" />
        <Skeleton className="h-10 w-48" />
      </div>
    );
  }

  const amount = <LedgerFigure minor={q.amountMinorUnits} currency={q.currencyCode} rule="double" className="text-[3.25rem] leading-none sm:text-[4.25rem]" />;

  if (q.paid) {
    return (
      <div className="rounded-panel border border-ok/25 bg-ok-soft/55 px-6 py-9 text-center" role="status">
        <Stamp size="lg" label={t('billShow.paidStamp')} className="bg-surface/70" />
        <p className="mt-5 font-display text-2xl font-semibold text-ok">{t('billShow.qr.receivedTitle')}</p>
        <p className="mt-3">{amount}</p>
        <p className="mx-auto mt-4 max-w-xs text-base">{t('billShow.qr.receivedBody')}</p>
      </div>
    );
  }

  if (!q.ready || !q.upi) {
    const reason = q.reason ?? 'UPI_INVALID';
    return (
      <div role="status" className="rounded-panel border border-dashed border-line px-6 py-10 text-center">
        <p className="font-display text-xl font-semibold">{t('billShow.qr.unavailableTitle')}</p>
        <p className="mx-auto mt-2 max-w-sm text-base text-ink-2">{t(REASON_KEYS[reason])}</p>
        {reason === 'UPI_NOT_CONFIGURED' && caps.canConfigureUpi && <UpiSetupForm onSaved={reload} />}
        {(reason === 'UPI_NOT_CONFIGURED' || reason === 'UPI_INVALID') && !caps.canConfigureUpi && (
          <p className="mx-auto mt-3 max-w-sm text-sm text-muted">{t('billShow.qr.askManager')}</p>
        )}
        {reason === 'UPI_INVALID' && caps.canConfigureUpi && (
          <Link to="/config" className="mt-3 inline-block text-sm font-medium text-accent-strong underline underline-offset-2">
            {t('billShow.qr.openConfig')}
          </Link>
        )}
        {onBack && (
          <div className="mt-5">
            <Button variant="secondary" onClick={onBack}>
              {t('billShow.back')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  const upi = q.upi;
  return (
    <div className="space-y-5 text-center">
      <div>
        <p className="eyebrow">{t('billShow.qr.amountLabel')}</p>
        <p className="mt-1">{amount}</p>
      </div>

      <div className="mx-auto w-fit rounded-panel bg-white p-3 shadow-[0_0_0_1px_rgb(255_255_255/0.12),0_18px_50px_-18px_rgb(0_0_0/0.8)]">
        <QrSvg text={upi.uri} label={t('billShow.qr.qrLabel', { amount: formatMoney(q.amountMinorUnits, q.currencyCode) })} className="block size-[min(19rem,72vw)]" />
      </div>
      <p className="mx-auto max-w-xs text-base text-ink-2">{t('billShow.qr.scanHint')}</p>

      <dl className="mx-auto grid max-w-sm grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-panel border border-line bg-white/[0.025] px-4 py-3 text-left text-base">
        <dt className="text-muted">{t('billShow.qr.payee')}</dt>
        <dd className="font-medium break-words">{upi.payeeName}</dd>
        <dt className="text-muted">{t('billShow.qr.upiId')}</dt>
        <dd className="tabular font-medium break-all">{upi.vpa}</dd>
        {q.reference && (
          <>
            <dt className="text-muted">{t('billShow.qr.reference')}</dt>
            <dd className="tabular font-medium break-all">{q.reference}</dd>
          </>
        )}
        {q.tableCode && (
          <>
            <dt className="text-muted">{t('billShow.table')}</dt>
            <dd className="font-medium">{q.tableCode}</dd>
          </>
        )}
      </dl>

      <a
        href={upi.uri}
        className="nx-press nx-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-6 text-base font-semibold"
      >
        <Smartphone aria-hidden className="size-5" />
        {t('billShow.qr.openApp')}
      </a>

      <div role="status" aria-live="polite" className="mx-auto flex max-w-sm items-center justify-center gap-2.5 rounded-control border border-info/30 bg-info-soft px-4 py-3 text-base">
        <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-info motion-safe:animate-pulse" />
        {q.paymentPending ? t('billShow.qr.pendingConfirm') : t('billShow.qr.waiting')}
      </div>

      {state.status === 'error' && <p role="alert" className="text-sm text-warn">{t('billShow.qr.staleError')}</p>}

      {caps.canRecordPayment && onRecordPayment ? (
        <div>
          <Button size="lg" variant="secondary" onClick={onRecordPayment}>
            {t('billShow.qr.markCollected')}
          </Button>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted">{t('billShow.qr.markCollectedHint')}</p>
        </div>
      ) : (
        <p className="mx-auto max-w-xs text-sm text-muted">{t('billShow.qr.cashierConfirms')}</p>
      )}
    </div>
  );
}
