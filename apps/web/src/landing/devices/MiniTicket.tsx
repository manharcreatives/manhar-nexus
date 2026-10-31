import type { CSSProperties } from 'react';
import { cx } from '../components/cx';
import '../styles/devices.css';

export interface MiniTicketLine {
  qty: number;
  name: string;
  /** Portion or Add-on, shown muted under the line. */
  sub?: string;
}

export interface MiniTicketProps {
  /** e.g. '0412' */
  number: string;
  /** e.g. 'Table 7' */
  table: string;
  lines?: readonly MiniTicketLine[];
  /** Status chip text, e.g. 'Waiting 02 min'. */
  status?: string;
  /** Bill total, e.g. '₹693.00' (renders the total row). */
  total?: string;
  /** Stamp text, e.g. 'Paid'. */
  stamp?: string;
  className?: string;
  style?: CSSProperties;
}

/** Ticket stub with the notch + perforation motif, mono numbers. Decorative: the parent decides the a11y story. */
export function MiniTicket({ number, table, lines = [], status, total, stamp, className, style }: MiniTicketProps) {
  return (
    <div className={cx('lp-tk', 'lp-tk--mini', className)} style={style}>
      <div className="lp-tk__head">
        <span>
          <b>No.</b> {number}
        </span>
        <span>{table}</span>
      </div>
      <div className="lp-tk__body">
        {lines.map((l) => (
          <div key={l.name}>
            <div className="lp-tk__line">
              <span className="lp-tk__q">{l.qty}×</span>
              <span>{l.name}</span>
            </div>
            {l.sub ? <div className="lp-tk__sub">{l.sub}</div> : null}
          </div>
        ))}
        {total ? (
          <div className="lp-tk__total">
            <span>Total</span>
            <span>{total}</span>
          </div>
        ) : null}
      </div>
      {status ? (
        <div className="lp-tk__foot">
          <span className="lp-tk__time">{status}</span>
        </div>
      ) : null}
      {stamp ? (
        <span className="lp-tk__stampwrap">
          <span className="lp-stamp">{stamp}</span>
        </span>
      ) : null}
    </div>
  );
}
