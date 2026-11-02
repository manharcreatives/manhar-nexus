import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { AlertCircle, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
import { Sheet } from './ui';
import { formatBill } from '../format';
import { ApiError } from '../api';
import { isBillFinal, isBillPaid } from '../status';
import { T } from '../strings';
import type { BillState, PayIntent } from '../types';

export interface PaySheetProps {
  open: boolean;
  onClose: () => void;
  getIntent: () => Promise<PayIntent>;
  bill: BillState | null;
  currency: string;
}

const UPI_OK = /^upi:\/\/pay\?/i;

export function PaySheet({ open, onClose, getIntent, bill, currency }: PaySheetProps) {
  const [intent, setIntent] = useState<PayIntent | null>(null);
  const [svg, setSvg] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const paid = isBillPaid(bill);
  const due = bill?.dueMinor ?? 0;
  const final = isBillFinal(bill);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const i = await getIntent();
      setIntent(i);
      const markup = await QRCode.toString(i.qrPayload || i.upiUri, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
      setSvg(markup);
    } catch (e) {
      // 409 BILL_NOT_READY: no finalised bill (yet) or already paid. 409 UPI_UNAVAILABLE / anything else: ask the waiter.
      setErr(e instanceof ApiError && e.code === 'BILL_NOT_READY' ? (paid ? T.payAlready : T.payBillNotReady) : T.payFailed);
    } finally {
      setLoading(false);
    }
  }, [getIntent, paid]);

  // Fetch when opened; fetch again if the amount due changed under us (a new order or a part payment).
  useEffect(() => {
    if (open && final && (!intent || intent.amountMinor !== due)) void load();
  }, [open, due, final]);
  useEffect(() => {
    if (!open) {
      setIntent(null);
      setSvg('');
    }
  }, [open]);

  return (
    <Sheet open={open} onClose={onClose} title={T.payTitle} className="gm-pay">
      {paid ? (
        <div className="gm-paid" role="status">
          <CheckCircle2 size={44} aria-hidden="true" />
          <p>{T.payDone}</p>
        </div>
      ) : !final ? (
        <p className="gm-empty">{due > 0 ? T.payNeedBill : T.payNothing}</p>
      ) : (
        <div className="gm-payview">
          <p className="gm-eyebrow">{T.payAmount}</p>
          <p className="gm-pay__amt tabular">{formatBill(intent?.amountMinor ?? due, currency)}</p>
          <div className="gm-qr" aria-busy={loading}>
            {svg && intent && UPI_OK.test(intent.upiUri) ? (
              <div className="gm-qr__code" role="img" aria-label={`${T.payScan}. ${formatBill(intent.amountMinor, currency)}`} dangerouslySetInnerHTML={{ __html: svg }} />
            ) : loading ? (
              <Loader2 className="gm-spin" size={28} aria-label="Loading" />
            ) : null}
          </div>
          {err ? (
            <p className="gm-alert" role="alert"><AlertCircle size={16} aria-hidden="true" /> {err} <button type="button" className="gm-link-btn" onClick={() => void load()}>{T.retry}</button></p>
          ) : null}
          <p className="gm-lede">{T.payScan}</p>
          {intent && UPI_OK.test(intent.upiUri) ? (
            <a className="gm-cta gm-press" href={intent.upiUri}><ExternalLink size={17} aria-hidden="true" /> <span>{T.payOpen}</span></a>
          ) : null}
          {intent?.reference ? (
            <p className="gm-pay__ref"><span>{T.payRef}</span> <code className="ticket-no">{intent.reference}</code></p>
          ) : null}
          <p className="gm-note" role="status"><Loader2 size={14} className="gm-spin" aria-hidden="true" /> {T.payWaiting}</p>
          <p className="gm-fine">{T.payHonest}</p>
        </div>
      )}
    </Sheet>
  );
}

export default PaySheet;
