import { useEffect, useRef, useState } from 'react';
import { Button, Icon, SectionLink } from '../components';
import { buildWhatsAppUrl, registrationSuccess, type BeginMode } from '../content';
import { copyText } from '../sectionsC/clipboard';
import { Copy, MessageCircle } from '../sectionsC/icons';
import { nextSteps } from './nextSteps';
import { CLAIM_COPY, CLAIM_MAX_POLLS, CLAIM_POLL_MS, issueClaim, recallPayerSecret, rememberPayerSecret, setPasswordHref } from './claim';
import { fetchPayAvailable, fetchPaid, PAY_COPY, PAYABLE_PLANS, priceLine, requestPayLink } from './payNow';
import type { SubmitOptions } from './submit';

export interface TicketProps {
  contactName: string;
  restaurantName: string;
  referenceCode: string;
  begin: BeginMode;
  /** The email they registered with: with the reference code it proves the request is theirs when paying. */
  email?: string;
  planKey?: string;
  billingCycle?: string;
  /** Same network options as the form (tests inject fetch). */
  payOptions?: SubmitOptions;
  onReset: () => void;
}

/**
 * Confirmation, styled as a kitchen ticket with a stamp. The stamp says RECEIVED, never PAID: the API only
 * confirms that the request was stored; no money has moved.
 */
export function RegistrationTicket({ contactName, restaurantName, referenceCode, begin, email, planKey, billingCycle, payOptions, onReset }: TicketProps) {
  const success = registrationSuccess(contactName, referenceCode);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const steps = nextSteps(begin);
  const who = { referenceCode, email: (email ?? '').trim().toLowerCase() };
  const payable = who.email !== '' && PAYABLE_PLANS.includes(planKey ?? '');
  // Computed once at registration time (the server judges the Founding offer by the same date).
  const [price] = useState(() => priceLine(planKey, billingCycle));
  const [payAvailable, setPayAvailable] = useState(false);
  const [payState, setPayState] = useState<'idle' | 'busy' | 'checking' | 'paid' | 'notYet' | 'contactUs' | 'failed'>('idle');
  // After paying: the account is built on the server, then the owner claims it with a one-time set-password link.
  const [claim, setClaim] = useState<{ state: 'idle' | 'pending' | 'ready' | 'later' | 'timedOut'; token?: string }>({ state: 'idle' });

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: false });
  }, []);

  // Offer "Pay now" only when the server says online payment is on (it is off until the owner switches it on).
  useEffect(() => {
    if (!payable) return;
    let live = true;
    void fetchPayAvailable(payOptions).then((on) => {
      if (live) setPayAvailable(on);
    });
    return () => {
      live = false;
    };
  }, [payable]);

  useEffect(() => {
    if (payState !== 'paid') return;
    const secret = recallPayerSecret(referenceCode);
    if (!secret) {
      setClaim({ state: 'later' });
      return;
    }
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const tick = async (): Promise<void> => {
      attempts += 1;
      const result = await issueClaim(who, secret, payOptions);
      if (!live) return;
      if (result.kind === 'ready') return setClaim({ state: 'ready', token: result.token });
      if (result.kind === 'unknown') return setClaim({ state: 'later' });
      if (attempts >= CLAIM_MAX_POLLS) return setClaim({ state: 'timedOut' });
      setClaim({ state: 'pending' });
      timer = setTimeout(() => void tick(), CLAIM_POLL_MS);
    };
    setClaim({ state: 'pending' });
    void tick();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [payState]);

  useEffect(() => {
    if (copied === 'idle') return;
    const t = window.setTimeout(() => setCopied('idle'), 2800);
    return () => window.clearTimeout(t);
  }, [copied]);

  const onCopy = async (): Promise<void> => {
    setCopied((await copyText(referenceCode)) ? 'done' : 'failed');
  };

  const onPay = async (): Promise<void> => {
    if (payState === 'busy') return;
    setPayState('busy');
    const result = await requestPayLink(who, payOptions);
    if (result.kind === 'link') {
      if (result.payerSecret) rememberPayerSecret(referenceCode, result.payerSecret);
      window.location.assign(result.link.linkUrl);
      return;
    }
    setPayState(result.kind === 'paid' ? 'paid' : result.kind === 'contact-us' ? 'contactUs' : 'failed');
  };

  const onCheck = async (): Promise<void> => {
    setPayState('checking');
    const paid = await fetchPaid(who, payOptions);
    setPayState(paid ? 'paid' : 'notYet');
  };

  const payMessage =
    payState === 'paid' ? PAY_COPY.paid : payState === 'notYet' ? PAY_COPY.notYet : payState === 'contactUs' ? PAY_COPY.contactUs : payState === 'failed' ? PAY_COPY.failed : '';

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
      {payable && payAvailable ? (
        <div className="lp-ticket__pay" data-testid="pay-now">
          {payState !== 'paid' && price ? (
            <p className="lp-ticket__price" data-testid="pay-price">
              {price}
            </p>
          ) : null}
          {payState !== 'paid' ? (
            <Button variant="primary" onClick={() => void onPay()} disabled={payState === 'busy'}>
              {payState === 'busy' ? PAY_COPY.busy : PAY_COPY.button}
            </Button>
          ) : null}
          {payState !== 'paid' ? (
            <Button variant="ghost" size="sm" onClick={() => void onCheck()} disabled={payState === 'checking'}>
              {payState === 'checking' ? PAY_COPY.checking : PAY_COPY.check}
            </Button>
          ) : null}
          <p className="lp-ticket__hint" role="status" aria-live="polite">
            {payMessage || PAY_COPY.later}
          </p>
          {payState === 'paid' && claim.state !== 'idle' ? (
            <div className="lp-ticket__claim" data-testid="claim" role="status" aria-live="polite">
              {claim.state === 'pending' ? <p>{CLAIM_COPY.pending}</p> : null}
              {claim.state === 'later' ? <p>{CLAIM_COPY.later}</p> : null}
              {claim.state === 'timedOut' ? <p>{CLAIM_COPY.timedOut}</p> : null}
              {claim.state === 'ready' && claim.token ? (
                <>
                  <p>{CLAIM_COPY.ready}</p>
                  <Button variant="primary" onClick={() => window.location.assign(setPasswordHref(claim.token as string))}>
                    {CLAIM_COPY.button}
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
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
