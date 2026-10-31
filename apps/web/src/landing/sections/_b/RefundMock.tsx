import { Link2, Undo2 } from 'lucide-react';

/**
 * A small device-style illustration for the Trust section: a refund is a NEW, visible, linked entry; the paid
 * Checkout stays exactly as it was. Pure HTML/CSS (no raster), decorative (aria-hidden) with a visible caption.
 * Local to SECTIONS-B because it has to show a refund reversal, which the shared Checkout mockup does not.
 */
export function RefundMock() {
  return (
    <figure className="lp-rm">
      <div className="lp-rm__device" aria-hidden="true">
        <div className="lp-rm__bar lp-mono">
          <span>Bills</span>
          <span className="lp-rm__paid">Paid</span>
        </div>
        <div className="lp-rm__rows">
          <div className="lp-rm__row">
            <span className="lp-rm__k lp-mono">Original Checkout</span>
            <span className="lp-rm__v">Stays as paid. Never edited.</span>
          </div>
          <div className="lp-rm__link">
            <Link2 size={14} strokeWidth={2} focusable="false" />
            <span className="lp-mono">Linked to the entry before it</span>
          </div>
          <div className="lp-rm__row lp-rm__row--new">
            <span className="lp-rm__k lp-mono">
              <Undo2 size={13} strokeWidth={2.25} focusable="false" /> Refund
            </span>
            <span className="lp-rm__v">New entry. Reason required: wrong dish.</span>
            <span className="lp-rm__cap lp-mono">Capped at what was paid</span>
          </div>
        </div>
        <div className="lp-rm__foot">
          <span className="lp-rm__verify lp-mono">Verify</span>
          <span className="lp-rm__hint lp-mono">Activity History</span>
        </div>
      </div>
      <figcaption className="lp-rm__caption">
        Illustration: a refund is a new, visible entry with a reason. The paid Checkout stays exactly as it was.
      </figcaption>
    </figure>
  );
}
