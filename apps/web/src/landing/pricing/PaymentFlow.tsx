import { useState } from 'react';
import { Icon } from '../components';
import { FAILURE_MESSAGES, HOW, PRICING, faqsByIds } from '../content';
import { Accordion, toggleId } from '../faq/Accordion';
import { iconByName } from '../sectionsC/icons';

/**
 * “How payment works”. Honest about what exists today: the visitor registers, a person reviews the request,
 * and a Cashfree payment link is sent by WhatsApp or email. Nothing on this page takes money.
 */
export function PaymentFlow() {
  return (
    <div className="lp-extra lp-flow">
      <h3 className="lp-extra__title">How payment works</h3>
      <p className="lp-extra__lede">{PRICING.flowTitle}. Nothing is charged on this page.</p>
      <ol className="lp-flow__steps">
        {PRICING.flow.map((step) => {
          // INTEGRATION POINT: createCheckout(referenceCode) -> Cashfree payment link URL
          // Until that exists, step 02 is fulfilled by a person sending a Cashfree payment link after review.
          const isPay = step.number === '02';
          return (
            <li key={step.number} className="lp-flow__step" data-integration={isPay ? 'cashfree-subscription' : undefined}>
              <span className="lp-flow__icon">
                <Icon icon={iconByName(step.icon)} size={20} />
              </span>
              <span className="lp-num">{step.number}</span>
              <h4>{step.title}</h4>
              <p>{step.body}</p>
              {isPay ? <p className="lp-flow__interim">{FAILURE_MESSAGES.interim}</p> : null}
            </li>
          );
        })}
      </ol>
      <ul className="lp-flow__notes">
        <li>
          <strong>Yearly plans:</strong> one payment by UPI, card or net banking through a secure Cashfree payment link. We remind you
          before renewal; nothing is debited automatically.
        </li>
        <li>
          <strong>Monthly plans:</strong> UPI AutoPay. Your bank notifies you 24 hours before each debit and you can revoke it any time.
        </li>
        <li>{HOW.guaranteeLine}</li>
      </ul>
    </div>
  );
}

/** The five billing questions again, compactly, right where the visitor is thinking about money. */
export function BillingFaq() {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const items = faqsByIds(PRICING.billingFaqIds);
  if (items.length === 0) return null;
  return (
    <div className="lp-extra">
      <h3 className="lp-extra__title">{PRICING.billingFaqTitle}</h3>
      <Accordion items={items} idPrefix="pricing-faq" openIds={open} onToggle={(id) => setOpen((prev) => toggleId(prev, id))} headingLevel={4} />
    </div>
  );
}
