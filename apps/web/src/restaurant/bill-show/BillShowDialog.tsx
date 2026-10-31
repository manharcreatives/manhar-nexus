import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { ErrorState, Skeleton } from '../../ui/states';
import { useLiveRefresh } from '../../realtime/RealtimeProvider';
import { describeError } from '../errors';
import { BillBody } from './BillBody';
import { PaymentQrBody } from './PaymentQrBody';
import { billShowApi, type BillView } from './billShowApi';
import type { BillShowCaps } from './permissions';
import { useRemote } from './useRemote';

export type BillShowView = 'bill' | 'qr';

/**
 * The waiter's customer-facing "Show bill" / "Show payment QR" screen. Both read only; the cashier generates the bill and
 * payments are recorded through the normal checkout flow (see `onRecordPayment`).
 */
export function BillShowDialog({
  sessionId,
  tableCode,
  initialView,
  caps,
  onClose,
  onRecordPayment,
  onPaid,
}: {
  sessionId: string;
  tableCode: string;
  initialView: BillShowView;
  caps: BillShowCaps;
  onClose: () => void;
  /** Opens the existing checkout dialog on UPI. Only offered to roles that may record payments. */
  onRecordPayment?: () => void;
  onPaid?: () => void;
}) {
  const { t } = useTranslation();
  const [view, setView] = useState<BillShowView>(initialView);
  const fetchBill = useCallback(() => billShowApi.forSession(sessionId), [sessionId]);
  const { state, reload } = useRemote<BillView>(fetchBill);
  // The bill can change under the guest's eyes (paid, voided); refresh on invoice/payment events and the shared safety-net poll.
  useLiveRefresh(['invoices', 'payments'], reload, view === 'bill');
  const data = state.data;
  const ready = data?.state === 'READY' ? data.bill : null;

  const showQr = caps.canShowPaymentQr && ready !== null && !ready.paid;

  const footer = (
    <>
      <Button variant="secondary" size="lg" onClick={onClose}>
        {t('restaurant.common.close')}
      </Button>
      {view === 'bill' && data && (
        <Button variant="secondary" size="lg" onClick={reload}>
          {t('restaurant.common.refresh')}
        </Button>
      )}
      {view === 'bill' && showQr && (
        <Button size="lg" onClick={() => setView('qr')}>
          {t('billShow.showQr')}
        </Button>
      )}
      {view === 'qr' && caps.canShowBill && (
        <Button size="lg" onClick={() => setView('bill')}>
          {t('billShow.showBill')}
        </Button>
      )}
    </>
  );

  return (
    <Dialog
      open
      onClose={onClose}
      title={view === 'qr' ? t('billShow.qrTitle', { code: tableCode }) : t('billShow.title', { code: tableCode })}
      className="w-[min(46rem,calc(100vw-1rem))]!"
      footer={footer}
    >
      <div aria-live="polite">
        {!data && state.status === 'loading' && (
          <div role="status" aria-label={t('billShow.loading')} className="space-y-3">
            <Skeleton className="mx-auto h-9 w-2/3" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="mx-auto h-16 w-1/2" />
          </div>
        )}

        {!data && state.status === 'error' && (
          <ErrorState
            title={t('billShow.errorTitle')}
            body={describeError(state.error, t, 'billShow.errorBody')}
            onRetry={reload}
            retryLabel={t('restaurant.common.retry')}
          />
        )}

        {data && data.state !== 'READY' && (
          <div role="status" className="rounded-panel border border-dashed border-line px-6 py-12 text-center">
            <p className="font-display text-xl font-semibold">{data.state === 'NO_BILL' ? t('billShow.noBillTitle') : t('billShow.notFinalisedTitle')}</p>
            <p className="mx-auto mt-2 max-w-sm text-base text-ink-2">{data.state === 'NO_BILL' ? t('billShow.noBillBody') : t('billShow.notFinalisedBody')}</p>
          </div>
        )}

        {data && ready && view === 'bill' && (
          <>
            {state.status === 'error' && (
              <p role="alert" className="mb-3 rounded-control bg-warn-soft px-3 py-2 text-sm text-warn">
                {t('billShow.staleError')}
              </p>
            )}
            <BillBody view={data} bill={ready} />
          </>
        )}

        {data && ready && view === 'qr' && (
          <PaymentQrBody
            invoiceId={ready.invoiceId}
            caps={caps}
            onRecordPayment={onRecordPayment}
            onBack={caps.canShowBill ? () => setView('bill') : undefined}
            onChanged={onPaid}
          />
        )}
      </div>
    </Dialog>
  );
}
