import { useState } from 'react';
import { Button } from '../components';
import { CLAIM_COPY, PAY_RETURN_PATH, clearLastReference, recallLastReference } from './claim';

/**
 * Shown above the form when this browser registered recently (say the visitor pressed Back from the payment page and
 * landed on an empty form). It keeps the reference visible and leads to /pay/return, which checks the payment and
 * opens the account. No name, email or phone is read from storage: only the reference code.
 */
export function ResumeBanner() {
  const [code, setCode] = useState<string | null>(() => recallLastReference());
  if (!code) return null;
  return (
    <div className="lp-resume" role="region" aria-label={CLAIM_COPY.resumeTitle(code)} data-testid="resume-banner">
      <p className="lp-resume__title">{CLAIM_COPY.resumeTitle(code)}</p>
      <p className="lp-resume__body">{CLAIM_COPY.resumeBody}</p>
      <div className="lp-resume__actions">
        <Button href={`${PAY_RETURN_PATH}?code=${encodeURIComponent(code)}`} variant="primary" size="sm">
          {CLAIM_COPY.resumeCheck}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            clearLastReference();
            setCode(null);
          }}
        >
          {CLAIM_COPY.resumeDismiss}
        </Button>
      </div>
    </div>
  );
}
