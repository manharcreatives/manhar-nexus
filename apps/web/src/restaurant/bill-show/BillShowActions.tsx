import { Suspense, lazy, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { CheckoutDialog } from '../CheckoutDialog';
import type { GuestSession } from '../api';
import type { BillShowView } from './BillShowDialog';
import { useBillShowCaps } from './permissions';

// The bill / QR screens (and the QR encoder they pull in) load on first use, keeping the main bundle lean.
const BillShowDialog = lazy(() => import('./BillShowDialog').then((m) => ({ default: m.BillShowDialog })));

/**
 * "Show bill" and "Show payment QR" for a table's session panel, each shown only to roles that hold the matching
 * permission. "Mark as collected" on the QR screen hands over to the existing CheckoutDialog (UPI preselected), so
 * recording a payment has exactly one code path.
 */
export function BillShowActions({
  session,
  tableCode,
  disabled,
  onPaymentDone,
}: {
  session: GuestSession;
  tableCode: string;
  /** True while there is nothing billable yet (no sent order). */
  disabled?: boolean;
  /** Same contract as CheckoutDialog.onDone: `closeTable` is true when the cashier chose to close the table. */
  onPaymentDone?: (closeTable: boolean) => void;
}) {
  const { t } = useTranslation();
  const caps = useBillShowCaps();
  const [open, setOpen] = useState<BillShowView | null>(null);
  const [recording, setRecording] = useState(false);

  if (!caps.canShowBill && !caps.canShowPaymentQr) return null;

  return (
    <>
      {caps.canShowBill && (
        <Button variant="secondary" size="lg" disabled={disabled} onClick={() => setOpen('bill')}>
          {t('billShow.showBill')}
        </Button>
      )}
      {caps.canShowPaymentQr && (
        <Button variant="secondary" size="lg" disabled={disabled} onClick={() => setOpen('qr')}>
          {t('billShow.showQr')}
        </Button>
      )}
      {open && !recording && (
        <Suspense fallback={null}>
          <BillShowDialog
            sessionId={session.id}
            tableCode={tableCode}
            initialView={open}
            caps={caps}
            onClose={() => setOpen(null)}
            onRecordPayment={caps.canRecordPayment ? () => setRecording(true) : undefined}
          />
        </Suspense>
      )}
      {recording && (
        <CheckoutDialog
          session={session}
          tableCode={tableCode}
          initialMethod="UPI"
          onCancel={() => {
            setRecording(false);
            setOpen(null);
            onPaymentDone?.(false);
          }}
          onDone={(closeTable) => {
            setRecording(false);
            setOpen(null);
            onPaymentDone?.(closeTable);
          }}
        />
      )}
    </>
  );
}
