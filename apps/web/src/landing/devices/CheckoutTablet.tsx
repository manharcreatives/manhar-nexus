import { DeviceFrame, type DeviceProps } from './DeviceFrame';

export interface CheckoutTabletProps extends DeviceProps {
  /** Show the settled state with the PAID stamp (default) or the "Collect" state before payment. */
  paid?: boolean;
}

const LINES = [
  { name: 'Masala Dosa', sub: 'Full', qty: 2, total: '₹280.00' },
  { name: 'Paneer Tikka', sub: 'Full', qty: 1, total: '₹260.00' },
  { name: 'Filter Coffee', sub: '', qty: 2, total: '₹120.00' },
] as const;

/**
 * Checkout for Table 7: lines with GST grouped by rate (5% here), Cash / UPI tender, change worked out,
 * and the PAID stamp once settled. Real strings from the app (Item / Qty / Total, Total due, Payment method,
 * Change given, Close table). Sample data.
 */
export function CheckoutTablet({ className, animate = false, decorative = false, label, paid = true }: CheckoutTabletProps) {
  return (
    <DeviceFrame
      kind="tablet"
      className={className}
      animate={animate}
      decorative={decorative}
      label={
        label ??
        (paid
          ? 'Checkout preview: Table 7 bill of ₹693.00 including 5% GST, paid in cash with change given, stamped PAID. Sample data.'
          : 'Checkout preview: Table 7 bill of ₹693.00 including 5% GST with Cash and UPI payment options. Sample data.')
      }
    >
      <div className="lp-co">
        <div className="lp-co__bar">
          <p className="lp-co__title">Check out · Table 7</p>
          <p className="lp-co__meta">4 guests · Guest Session</p>
        </div>
        <div className="lp-co__body">
          <div className="lp-co__pane lp-co__pane--paper">
            <div className="lp-co__th">
              <span>Item</span>
              <span>Qty</span>
              <span>Total</span>
            </div>
            {LINES.map((l) => (
              <div key={l.name} className="lp-co__row">
                <span>
                  {l.name}
                  {l.sub ? <small>{l.sub}</small> : null}
                </span>
                <span>{l.qty}</span>
                <span>{l.total}</span>
              </div>
            ))}
            <div className="lp-co__sum">
              <div>
                <span>Subtotal</span>
                <span>₹660.00</span>
              </div>
              <div>
                <span>GST 5%</span>
                <span>₹33.00</span>
              </div>
              <div className="lp-co__due">
                <span>Total due</span>
                <span>₹693.00</span>
              </div>
            </div>
          </div>
          <div className="lp-co__pane">
            {paid ? (
              <>
                <p className="lp-co__label">Payment received</p>
                <div className="lp-co__stampwrap">
                  <span className="lp-stamp">Paid</span>
                </div>
                <div className="lp-co__field">
                  <span>Cash</span>
                  <span>₹700.00</span>
                </div>
                <p className="lp-co__change">Change given: ₹7.00</p>
                <div className="lp-co__btns">
                  <p className="lp-co__btn">Close table</p>
                  <p className="lp-co__btn lp-co__btn--ghost">Keep table open</p>
                </div>
              </>
            ) : (
              <>
                <p className="lp-co__label">Payment method</p>
                <div className="lp-co__seg">
                  <p className="lp-co__tender lp-co__tender--on">Cash</p>
                  <p className="lp-co__tender">UPI</p>
                </div>
                <div className="lp-co__field">
                  <small>Cash received</small>
                  <span>₹700.00</span>
                </div>
                <p className="lp-co__change">Change to give: ₹7.00</p>
                <div className="lp-co__btns">
                  <p className="lp-co__btn">Collect ₹693.00</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </DeviceFrame>
  );
}
