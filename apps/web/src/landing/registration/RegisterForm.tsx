import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components';
import {
  BUSINESS_KIND_OPTIONS,
  CONSENT_SEGMENTS,
  CONSENT_SMALL_PRINT,
  DEFAULT_FORM_VALUES,
  FAILURE_MESSAGES,
  normalizeIndianMobile,
  FOUNDING_OFFER,
  REGISTRATION_FIELDS,
  SUBMIT_LABEL,
  SUBMIT_LOADING_LABEL,
  SUBMIT_MICROCOPY,
  toRegistrationPayload,
  validateRegistration,
  type BeginMode,
  type BusinessKind,
  type RegistrationErrors,
  type RegistrationFieldName,
  type RegistrationFormValues,
} from '../content';
import { useRegistrationIntent } from '../hooks/useRegistrationIntent';
import { foundingState } from '../pricing/pricingMath';
import { emitBuddy } from './buddy/store';
import { Field } from './Field';
import { FallbackActions } from './FallbackActions';
import { submitRegistration, type SubmitFailureKind, type SubmitOptions } from './submit';
import { RegistrationTicket } from './Ticket';
import { fieldId, formatMobileDisplay, orderedErrors, sanitizeOutlets, sanitizePhoneInput, validateField } from './validation';

/** Everything the visitor types. Plan and billing cycle live in the shared intent store, not here. */
interface FormState {
  restaurantName: string;
  contactName: string;
  phone: string;
  email: string;
  city: string;
  businessKind: BusinessKind;
  outlets: string;
  begin: BeginMode;
  code: string;
  message: string;
  consent: boolean;
  updates: boolean;
  /** Honeypot. Humans never see or fill it. */
  website: string;
}

type Phase = 'editing' | 'submitting' | 'success';
type Failure = { kind: SubmitFailureKind } | null;

const FAILURE_TEXT: Readonly<Record<SubmitFailureKind, string>> = {
  'rate-limit': FAILURE_MESSAGES['rate-limit'],
  network: FAILURE_MESSAGES.network,
  server: FAILURE_MESSAGES.server,
  validation: 'Some details did not pass our checks. Please review the highlighted fields and send again.',
};

function initialState(offerOpen: boolean): FormState {
  const d = DEFAULT_FORM_VALUES;
  return {
    restaurantName: d.restaurantName,
    contactName: d.contactName,
    phone: d.phone,
    email: d.email,
    city: d.city,
    businessKind: d.businessKind,
    outlets: d.outlets,
    begin: d.begin,
    code: offerOpen ? FOUNDING_OFFER.code : d.code,
    message: d.message,
    consent: d.consent,
    updates: d.updates,
    website: d.website,
  };
}

export interface RegisterFormProps {
  /** Test seam: override fetch / base URL / timeout. */
  submitOptions?: SubmitOptions;
}

/**
 * The registration form (Tier 1: POST to the API; Tier 0: prefilled WhatsApp / email). Validates on blur and on
 * submit, focuses an error summary on failure, includes a honeypot and a time-trap timestamp, and swaps to a
 * ticket-style confirmation with the reference code. Plan and billing cycle come from (and write back to) the
 * shared registration intent so the Pricing buttons prefill it.
 */
export function RegisterForm({ submitOptions }: RegisterFormProps) {
  const intent = useRegistrationIntent();
  const [now] = useState(() => new Date());
  const [state, setState] = useState<FormState>(() => initialState(foundingState(now) === 'open'));
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [showSummary, setShowSummary] = useState(false);
  const [summaryTick, setSummaryTick] = useState(0);
  const [phase, setPhase] = useState<Phase>('editing');
  const [failure, setFailure] = useState<Failure>(null);
  const [reference, setReference] = useState('');
  const startedAt = useRef(Date.now());
  const summaryRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // "Book a live demo" elsewhere on the page sets begin=demo in the shared intent; mirror it into the select.
  useEffect(() => {
    setState((s) => {
      if (intent.begin === 'demo') return s.begin === 'demo' ? s : { ...s, begin: 'demo' };
      return s.begin === 'demo' ? { ...s, begin: 'pay-and-start' } : s;
    });
  }, [intent.begin]);

  useEffect(() => {
    if (summaryTick > 0) summaryRef.current?.focus();
  }, [summaryTick]);

  const values: RegistrationFormValues = useMemo(
    () => ({ ...state, planKey: intent.plan, billingCycle: intent.cycle }),
    [state, intent.plan, intent.cycle],
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setState((s) => ({ ...s, [key]: value }));
  };

  /** Re-check one field after a change, but only to CLEAR an existing error early (errors appear on blur/submit). */
  const clearIfFixed = (name: RegistrationFieldName, next: RegistrationFormValues): void => {
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const message = validateField(name, next);
      if (message) return { ...prev, [name]: message };
      const { [name]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const onText =
    (name: 'restaurantName' | 'contactName' | 'phone' | 'email' | 'city' | 'code' | 'message') =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      const value = e.target.value;
      set(name, value);
      clearIfFixed(name, { ...values, [name]: value });
    };

  const onBlur = (name: RegistrationFieldName, patch?: Partial<RegistrationFormValues>): void => {
    const next = { ...values, ...patch };
    const message = validateField(name, next);
    setErrors((prev) => {
      if (message) return { ...prev, [name]: message };
      const { [name]: _removed, ...rest } = prev;
      return rest;
    });
    // Tell Manhar Bot how it went (a field the visitor never filled in is not worth a cheer).
    if (message) emitBuddy({ type: 'invalid', field: name });
    else if (name !== 'consent' && String(next[name as keyof RegistrationFormValues] ?? '').trim() !== '') emitBuddy({ type: 'valid', field: name });
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (phase === 'submitting') return;
    const found = validateRegistration(values);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setShowSummary(true);
      setSummaryTick((t) => t + 1);
      emitBuddy({ type: 'failure', kind: 'validation' });
      return;
    }
    setErrors({});
    setShowSummary(false);
    setFailure(null);
    setPhase('submitting');
    emitBuddy({ type: 'submit' });
    const result = await submitRegistration(toRegistrationPayload(values, startedAt.current), submitOptions);
    if (!mounted.current) return;
    if (result.ok) {
      setReference(result.referenceCode);
      setPhase('success');
      emitBuddy({ type: 'success', referenceCode: result.referenceCode });
      return;
    }
    setFailure({ kind: result.kind });
    emitBuddy({ type: 'failure', kind: result.kind });
    if (result.fieldErrors) {
      setErrors(result.fieldErrors);
      setShowSummary(true);
      setSummaryTick((t) => t + 1);
    }
    setPhase('editing');
  };

  const reset = (): void => {
    setState(initialState(foundingState(new Date()) === 'open'));
    setErrors({});
    setShowSummary(false);
    setFailure(null);
    setReference('');
    startedAt.current = Date.now();
    setPhase('editing');
  };

  const summary = orderedErrors(errors);
  const submitting = phase === 'submitting';

  const focusField = (name: RegistrationFieldName) => (e: ReactMouseEvent<HTMLAnchorElement>): void => {
    e.preventDefault();
    const el = document.getElementById(fieldId(name));
    el?.focus();
    el?.scrollIntoView?.({ block: 'center' });
  };

  return (
    <div className="lp-reg-card">
      {/* Persistent live region: the confirmation is announced when it appears. */}
      <div role="status" aria-live="polite" className="lp-reg-live">
        {phase === 'success' ? (
          <RegistrationTicket
            contactName={state.contactName.trim()}
            restaurantName={state.restaurantName.trim()}
            referenceCode={reference}
            begin={state.begin}
            onReset={reset}
          />
        ) : null}
      </div>

      {phase !== 'success' ? (
        <form
          className="lp-reg-form"
          noValidate
          aria-busy={submitting}
          aria-labelledby="register-title"
          onSubmit={(e) => void onSubmit(e)}
        >
          <p className="lp-reg-form__note">Fields marked * are required.</p>

          {showSummary && summary.length > 0 ? (
            <div ref={summaryRef} role="alert" tabIndex={-1} className="lp-reg-summary">
              <p className="lp-reg-summary__title">
                {summary.length === 1 ? 'One thing needs your attention.' : `${summary.length} things need your attention.`}
              </p>
              <ul>
                {summary.map((item) => (
                  <li key={item.name}>
                    <a href={`#${fieldId(item.name)}`} onClick={focusField(item.name)}>
                      {item.message}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="lp-reg-grid">
            <Field name="restaurantName" error={errors.restaurantName}>
              {(a) => (
                <input
                  {...a}
                  className="lp-input"
                  type="text"
                  autoComplete="organization"
                  maxLength={REGISTRATION_FIELDS.restaurantName.maxLength}
                  placeholder={REGISTRATION_FIELDS.restaurantName.placeholder}
                  value={state.restaurantName}
                  onChange={onText('restaurantName')}
                  onFocus={() => emitBuddy({ type: 'focus', field: 'restaurantName' })}
                  onBlur={() => onBlur('restaurantName')}
                />
              )}
            </Field>
            <Field name="contactName" error={errors.contactName}>
              {(a) => (
                <input
                  {...a}
                  className="lp-input"
                  type="text"
                  autoComplete="name"
                  maxLength={REGISTRATION_FIELDS.contactName.maxLength}
                  placeholder={REGISTRATION_FIELDS.contactName.placeholder}
                  value={state.contactName}
                  onChange={onText('contactName')}
                  onFocus={() => emitBuddy({ type: 'focus', field: 'contactName' })}
                  onBlur={() => onBlur('contactName')}
                />
              )}
            </Field>
            <Field name="phone" error={errors.phone}>
              {(a) => (
                <input
                  {...a}
                  className="lp-input"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={REGISTRATION_FIELDS.phone.maxLength}
                  placeholder={REGISTRATION_FIELDS.phone.placeholder}
                  value={state.phone}
                  onChange={(e) => {
                    const value = sanitizePhoneInput(e.target.value);
                    set('phone', value);
                    clearIfFixed('phone', { ...values, phone: value });
                    emitBuddy({ type: 'typing', field: 'phone', digits: value.replace(/D/g, '').length, valid: normalizeIndianMobile(value) !== null });
                  }}
                  onFocus={() => emitBuddy({ type: 'focus', field: 'phone' })}
                  onBlur={() => {
                    const display = formatMobileDisplay(state.phone);
                    if (display !== state.phone) set('phone', display);
                    onBlur('phone', { phone: display });
                  }}
                />
              )}
            </Field>
            <Field name="email" error={errors.email}>
              {(a) => (
                <input
                  {...a}
                  className="lp-input"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={REGISTRATION_FIELDS.email.maxLength}
                  placeholder={REGISTRATION_FIELDS.email.placeholder}
                  value={state.email}
                  onChange={onText('email')}
                  onFocus={() => emitBuddy({ type: 'focus', field: 'email' })}
                  onBlur={() => onBlur('email')}
                />
              )}
            </Field>
            <Field name="city" error={errors.city}>
              {(a) => (
                <input
                  {...a}
                  className="lp-input"
                  type="text"
                  autoComplete="address-level2"
                  maxLength={REGISTRATION_FIELDS.city.maxLength}
                  placeholder={REGISTRATION_FIELDS.city.placeholder}
                  value={state.city}
                  onChange={onText('city')}
                  onFocus={() => emitBuddy({ type: 'focus', field: 'city' })}
                  onBlur={() => onBlur('city')}
                />
              )}
            </Field>
            <Field name="businessKind" error={errors.businessKind}>
              {(a) => (
                <select
                  {...a}
                  className="lp-select"
                  autoComplete="off"
                  value={state.businessKind}
                  onFocus={() => emitBuddy({ type: 'focus', field: 'businessKind' })}
                  onChange={(e) => {
                    set('businessKind', e.target.value as BusinessKind);
                    emitBuddy({ type: 'valid', field: 'businessKind' });
                  }}
                >
                  {BUSINESS_KIND_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field
              name="outlets"
              error={errors.outlets}
            >
              {(a) => (
                <input
                  {...a}
                  className="lp-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  maxLength={3}
                  placeholder={REGISTRATION_FIELDS.outlets.placeholder}
                  value={state.outlets}
                  onChange={(e) => {
                    const value = sanitizeOutlets(e.target.value);
                    set('outlets', value);
                    clearIfFixed('outlets', { ...values, outlets: value });
                  }}
                  onFocus={() => emitBuddy({ type: 'focus', field: 'outlets' })}
                  onBlur={() => onBlur('outlets')}
                />
              )}
            </Field>
          </div>

          <Field name="message" error={errors.message} className="lp-field--wide">
            {(a) => (
              <textarea
                {...a}
                className="lp-textarea"
                rows={4}
                maxLength={REGISTRATION_FIELDS.message.maxLength}
                placeholder={REGISTRATION_FIELDS.message.placeholder}
                value={state.message}
                onChange={onText('message')}
                onFocus={() => emitBuddy({ type: 'focus', field: 'message' })}
              />
            )}
          </Field>

          {/* Honeypot: off-screen, not focusable by keyboard, hidden from assistive tech. Humans never touch it. */}
          <div className="lp-reg-hp" aria-hidden="true">
            <label htmlFor="reg-website">Website (leave this empty)</label>
            <input
              id="reg-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
              value={state.website}
              onChange={(e) => set('website', e.target.value)}
            />
          </div>

          <div className="lp-check">
            <input
              id={fieldId('consent')}
              name="consent"
              type="checkbox"
              checked={state.consent}
              aria-required="true"
              aria-invalid={Boolean(errors.consent)}
              aria-describedby={errors.consent ? `${fieldId('consent')}-error` : undefined}
              onChange={(e) => {
                set('consent', e.target.checked);
                clearIfFixed('consent', { ...values, consent: e.target.checked });
                emitBuddy({ type: 'consent', checked: e.target.checked });
              }}
              onFocus={() => emitBuddy({ type: 'focus', field: 'consent' })}
              onBlur={() => onBlur('consent')}
            />
            <label htmlFor={fieldId('consent')}>
              {CONSENT_SEGMENTS.map((seg, i) =>
                seg.href ? (
                  <a key={i} href={seg.href} target="_blank" rel="noopener noreferrer" className="lp-link">
                    {seg.text}
                    <span className="lp-visually-hidden"> (opens in a new tab)</span>
                  </a>
                ) : (
                  <span key={i}>{seg.text}</span>
                ),
              )}{' '}
              <span className="lp-field__req" aria-hidden="true">
                *
              </span>
            </label>
          </div>
          {errors.consent ? (
            <p id={`${fieldId('consent')}-error`} className="lp-field-error">
              {errors.consent}
            </p>
          ) : null}

          {failure ? (
            <div role="alert" className="lp-reg-failure">
              <p>{FAILURE_TEXT[failure.kind]}</p>
              <FallbackActions values={values} />
            </div>
          ) : null}

          <Button type="submit" size="lg" block arrow disabled={submitting} aria-busy={submitting} className="lp-reg-submit">
            {submitting ? SUBMIT_LOADING_LABEL : SUBMIT_LABEL}
          </Button>
          <p className="lp-reg-form__fine">
            {SUBMIT_MICROCOPY} {CONSENT_SMALL_PRINT}{' '}
            <Link to="/privacy" className="lp-link" target="_blank" rel="noopener noreferrer">
              Privacy Policy<span className="lp-visually-hidden"> (opens in a new tab)</span>
            </Link>
          </p>
        </form>
      ) : null}
    </div>
  );
}
