import { useEffect, useRef, useState } from 'react';
import { Button, Icon, SectionLink } from '../components';
import { buildWhatsAppUrl, registrationSuccess, type BeginMode } from '../content';
import { copyText } from '../sectionsC/clipboard';
import { Copy, MessageCircle } from '../sectionsC/icons';
import { nextSteps } from './nextSteps';

export interface TicketProps {
  contactName: string;
  restaurantName: string;
  referenceCode: string;
  begin: BeginMode;
  onReset: () => void;
}

/**
 * Confirmation, styled as a kitchen ticket with a stamp. The stamp says RECEIVED, never PAID: the API only
 * confirms that the request was stored; no money has moved.
 */
export function RegistrationTicket({ contactName, restaurantName, referenceCode, begin, onReset }: TicketProps) {
  const success = registrationSuccess(contactName, referenceCode);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const steps = nextSteps(begin);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: false });
  }, []);

  useEffect(() => {
    if (copied === 'idle') return;
    const t = window.setTimeout(() => setCopied('idle'), 2800);
    return () => window.clearTimeout(t);
  }, [copied]);

  const onCopy = async (): Promise<void> => {
    setCopied((await copyText(referenceCode)) ? 'done' : 'failed');
  };

  return (
    <div className="lp-ticket">
      <div className="lp-ticket__main">
        <span className="lp-stamp" aria-hidden="true">
          RECEIVED
        </span>
        <h3 ref={headingRef} tabIndex={-1} className="lp-ticket__title">
          {success.title}
        </h3>
        <p className="lp-ticket__lead">
          {success.lead}
          <strong>{success.reference}</strong>
          {success.tail}
        </p>
        <h4 className="lp-ticket__next">What happens next</h4>
        <ol className="lp-ticket__steps">
          {steps.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </div>
      <div className="lp-ticket__stub">
        <p className="lp-ticket__label">{success.referenceLabel}</p>
        <p className="lp-ticket__ref" data-testid="reference-code">
          {referenceCode}
        </p>
        <Button variant="secondary" size="sm" onClick={() => void onCopy()}>
          <Icon icon={Copy} size={16} /> Copy reference
        </Button>
        <span className="lp-ticket__copied" aria-live="polite">
          {copied === 'done' ? 'Reference copied.' : copied === 'failed' ? 'Could not copy. Select the code and press Ctrl+C.' : ''}
        </span>
      </div>
      <div className="lp-ticket__actions">
        <Button href={buildWhatsAppUrl({ restaurantName, contactName }, referenceCode)} external variant="primary">
          <Icon icon={MessageCircle} size={18} /> Message us on WhatsApp
          <span className="lp-visually-hidden"> (opens in a new tab)</span>
        </Button>
        {success.secondary.map((l) => (
          <SectionLink key={l.href} to={l.href.replace(/^\/#/, '')} className="lp-link">
            {l.text}
          </SectionLink>
        ))}
        <Button variant="ghost" size="sm" onClick={onReset}>
          Register another restaurant
        </Button>
      </div>
      <p className="lp-ticket__hint">{success.secondaryHint}</p>
    </div>
  );
}
