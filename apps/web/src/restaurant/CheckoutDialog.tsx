import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Skeleton, ErrorState } from '../ui/states';
import { Table, Td, Th } from '../ui/Table';
import { useToast } from '../ui/Toast';
import { cn } from '../lib/cn';
import { describeError } from './errors';
import { useSingleFlight } from './hooks';
import { type GuestSession, type Invoice, checkoutApi, formatMinorUnits } from './api';

type Method = 'CASH' | 'UPI' | 'CARD';
type Phase = 'loading' | 'review' | 'paid' | 'error';
const METHODS: Method[] = ['CASH', 'UPI', 'CARD'];

export function CheckoutDialog({
  session,
  tableCode,
  onDone,
  onCancel,
}: {
  session: GuestSession;
  tableCode: string;
  /** `closeTable` is true when the cashier chose to close the table after payment. */
  onDone: (closeTable: boolean) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [method, setMethod] = useState<Method>('CASH');
  const [phase, setPhase] = useState<Phase>('loading');
  const [loadError, setLoadError] = useState('');
  const [payError, setPayError] = useState('');
  const loader = useSingleFlight();
  const payer = useSingleFlight();
  // One idempotency key per payment attempt (reset when the method changes),
  // so a retry after a dropped response can never capture the money twice.
  const payKey = useRef(crypto.randomUUID());

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
        } catch (err) {
          setLoadError(describeError(err, t, 'restaurant.errors.loadInvoice'));
          setPhase('error');
        }
      }),
    [runLoad, session.id, t],
  );

  useEffect(() => {
    void loadInvoice();
  }, [loadInvoice]);

  async function pay() {
    if (!invoice) return;
    setPayError('');
    await payer.run(async () => {
      try {
        await checkoutApi.pay(invoice.id, method, invoice.grandTotalMinorUnits, payKey.current);
        toast.show(t('restaurant.checkout.paidToast', { amount: formatMinorUnits(invoice.grandTotalMinorUnits) }));
        setPhase('paid');
      } catch (err) {
        setPayError(describeError(err, t, 'restaurant.errors.payment'));
      }
    });
  }

  function chooseMethod(m: Method) {
    if (m === method) return;
    setMethod(m);
    payKey.current = crypto.randomUUID();
  }

  const footer =
    phase === 'review' && invoice ? (
      <>
        <Button variant="secondary" size="lg" onClick={onCancel} disabled={payer.busy}>
          {t('restaurant.common.cancel')}
        </Button>
        <Button size="lg" loading={payer.busy} onClick={() => void pay()}>
          {payer.busy
            ? t('restaurant.checkout.processing')
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
          <div className="rounded-panel bg-ok-soft px-6 py-8 text-center">
            <p className="font-display text-2xl font-semibold text-ok">{t('restaurant.checkout.paidTitle')}</p>
            <p className="tabular mt-2 font-display text-3xl font-semibold">{formatMinorUnits(invoice.grandTotalMinorUnits)}</p>
            <p className="mt-2 text-sm text-ink">{t('restaurant.checkout.paidBody')}</p>
          </div>
        )}

        {phase === 'review' && invoice && (
          <div className="space-y-5">
            <div className="max-h-[32dvh] overflow-y-auto">
              <Table>
                <thead>
                  <tr>
                    <Th>{t('restaurant.checkout.item')}</Th>
                    <Th numeric>{t('restaurant.checkout.qty')}</Th>
                    <Th numeric>{t('restaurant.checkout.total')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.map((line) => (
                    <tr key={line.id}>
                      <Td>
                        {line.itemNameSnapshot}
                        {line.variantNameSnapshot && <span className="block text-xs text-muted">{line.variantNameSnapshot}</span>}
                      </Td>
                      <Td numeric>{line.quantity}</Td>
                      <Td numeric>{formatMinorUnits(line.totalMinorUnits)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            <dl className="tabular space-y-1 text-sm">
              <div className="flex justify-between text-muted">
                <dt>{t('restaurant.checkout.subtotal')}</dt>
                <dd>{formatMinorUnits(invoice.subtotalMinorUnits)}</dd>
              </div>
              <div className="flex justify-between text-muted">
                <dt>{t('restaurant.checkout.tax')}</dt>
                <dd>{formatMinorUnits(invoice.taxMinorUnits)}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-line pt-2">
                <dt className="font-medium">{t('restaurant.checkout.grandTotal')}</dt>
                <dd className="font-display text-3xl font-semibold">{formatMinorUnits(invoice.grandTotalMinorUnits)}</dd>
              </div>
            </dl>

            <fieldset disabled={payer.busy}>
              <legend className="mb-2 text-sm font-medium">{t('restaurant.checkout.method')}</legend>
              <div className="grid grid-cols-3 gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={method === m}
                    onClick={() => chooseMethod(m)}
                    className={cn(
                      'min-h-12 rounded-control border-2 text-base font-medium transition-colors disabled:opacity-50',
                      method === m ? 'border-accent bg-accent-soft text-accent-strong' : 'border-line bg-surface hover:bg-sunken',
                    )}
                  >
                    {t(`restaurant.checkout.methods.${m}`)}
                  </button>
                ))}
              </div>
            </fieldset>

            <p role="alert" className="text-sm text-bad">
              {payError}
            </p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
