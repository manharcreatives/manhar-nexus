import { useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage } from '../commercial/helpers';
import { FormError } from '../commercial/Shared';
import { cn } from '../lib/cn';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Dialog } from '../ui/Dialog';
import { Field } from '../ui/Field';
import * as Icons from '../ui/icons';
import { Spinner } from '../ui/Spinner';
import { CORE_MODULES, OPTIONAL_MODULES, generatePassword, orderModules, runProvision, stepsFor, type ProvisionInput, type StepId } from './provision';

type Phase = 'form' | 'running' | 'done';
type Status = 'pending' | 'running' | 'done';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function CopyButton({ value, label }: { value: string; label: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      aria-label={label}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        });
      }}
    >
      {copied ? <Icons.Check className="size-4" aria-hidden /> : null}
      {copied ? t('provision.copied') : t('provision.copy')}
    </Button>
  );
}

/**
 * One dialog that gives a new restaurant its own workspace: business, first
 * location, owner login and the modules it paid for. Retry resumes at the step
 * that failed, so a network blip never leaves a half-created restaurant twice.
 */
export function NewRestaurantDialog({ onClose, onOpenChecklist }: { onClose: () => void; onOpenChecklist: (businessId: string) => void }) {
  const { t } = useTranslation();
  const formId = useId();
  const [phase, setPhase] = useState<Phase>('form');
  const [name, setName] = useState('');
  const [locationName, setLocationName] = useState('Main Location');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [password, setPassword] = useState(() => generatePassword());
  const [showPw, setShowPw] = useState(false);
  const [extras, setExtras] = useState<string[]>([...OPTIONAL_MODULES]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [failedStep, setFailedStep] = useState<StepId | null>(null);
  const state = useRef<{ businessId?: string; done: Set<StepId>; failed?: StepId }>({ done: new Set() });
  const inputRef = useRef<ProvisionInput | null>(null);

  async function execute() {
    const input = inputRef.current;
    if (!input) return;
    setPhase('running');
    setSubmitError(null);
    setFailedStep(null);
    try {
      const id = await runProvision(input, state.current, (step, status) => setStatuses((s) => ({ ...s, [step]: status })));
      setBusinessId(id);
      setPhase('done');
    } catch (err) {
      setFailedStep(state.current.failed ?? null);
      setSubmitError(errorMessage(err, t('provision.errors.failed')));
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t('provision.errors.name');
    if (!locationName.trim()) next.location = t('provision.errors.location');
    if (!ownerName.trim()) next.ownerName = t('provision.errors.ownerName');
    if (!EMAIL.test(ownerEmail.trim())) next.email = t('provision.errors.email');
    if (password.length < 8) next.password = t('provision.errors.password');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    inputRef.current = { name, locationName, ownerName, ownerEmail, ownerPassword: password, modules: orderModules(extras) };
    setStatuses({});
    state.current = { done: new Set() };
    void execute();
  }

  const input = inputRef.current;
  const steps = input ? stepsFor(input) : [];
  const stepLabel = (s: StepId) => (s.startsWith('module:') ? t('provision.step.module', { name: t(`provision.module.${s.slice(7)}`) }) : t(`provision.step.${s}`));
  const running = phase === 'running' && failedStep === null;

  const footer =
    phase === 'form' ? (
      <>
        <Button variant="secondary" onClick={onClose}>{t('onboarding.cancel')}</Button>
        <Button type="submit" form={formId}>{t('provision.create')}</Button>
      </>
    ) : phase === 'running' ? (
      failedStep ? (
        <>
          <Button variant="secondary" onClick={onClose}>{t('provision.closeAnyway')}</Button>
          <Button onClick={() => void execute()}>{t('provision.retry')}</Button>
        </>
      ) : null
    ) : (
      <>
        <Button variant="secondary" onClick={onClose}>{t('provision.done')}</Button>
        {businessId && <Button onClick={() => onOpenChecklist(businessId)}>{t('provision.openChecklist')}</Button>}
      </>
    );

  return (
    <Dialog open onClose={() => !running && onClose()} title={phase === 'done' ? t('provision.readyTitle', { name }) : t('provision.title')} className="w-[min(38rem,calc(100vw-2rem))]" footer={footer}>
      {phase === 'form' && (
        <form id={formId} onSubmit={submit} noValidate className="space-y-5">
          <p className="text-sm text-muted">{t('provision.intro')}</p>
          <Field label={t('provision.name')} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoFocus data-autofocus />
          <Field label={t('provision.location')} hint={t('provision.locationHint')} value={locationName} onChange={(e) => setLocationName(e.target.value)} error={errors.location} />

          <fieldset className="space-y-4 rounded-control border border-white/10 p-4">
            <legend className="px-1 text-sm font-medium">{t('provision.ownerLegend')}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('provision.ownerName')} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} error={errors.ownerName} autoComplete="off" />
              <Field label={t('provision.ownerEmail')} type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} error={errors.email} autoComplete="off" />
            </div>
            <Field
              label={t('provision.password')}
              hint={t('provision.passwordHint')}
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              autoComplete="new-password"
              adornment={
                <button type="button" onClick={() => setShowPw((v) => !v)} aria-pressed={showPw} aria-label={showPw ? t('auth.hidePassword') : t('auth.showPassword')} className="grid size-9 place-items-center rounded-control text-muted hover:bg-white/[0.06]">
                  {showPw ? <Icons.EyeOff className="size-4" /> : <Icons.Eye className="size-4" />}
                </button>
              }
            />
            <Button variant="ghost" onClick={() => setPassword(generatePassword())}>{t('provision.regenerate')}</Button>
          </fieldset>

          <fieldset>
            <legend className="mb-1 text-sm font-medium">{t('provision.modulesLegend')}</legend>
            <p className="mb-2 text-sm text-muted">{t('provision.modulesHint')}</p>
            <ul>
              {CORE_MODULES.map((m) => (
                <li key={m}>
                  <Checkbox label={`${t(`provision.module.${m}`)} · ${t('provision.included')}`} checked disabled readOnly />
                </li>
              ))}
              {OPTIONAL_MODULES.map((m) => (
                <li key={m}>
                  <Checkbox label={t(`provision.module.${m}`)} checked={extras.includes(m)} onChange={(e) => setExtras((cur) => (e.target.checked ? [...cur, m] : cur.filter((x) => x !== m)))} />
                </li>
              ))}
            </ul>
          </fieldset>
        </form>
      )}

      {phase === 'running' && (
        <div>
          <p className="mb-4 text-sm text-muted">{failedStep ? t('provision.stopped') : t('provision.working')}</p>
          <ol aria-live="polite" className="space-y-2">
            {steps.map((s) => {
              const st: Status = statuses[s] ?? 'pending';
              const bad = failedStep === s;
              return (
                <li key={s} className={cn('flex items-center gap-3 text-sm', st === 'pending' && !bad && 'text-muted')}>
                  <span aria-hidden className="grid size-6 shrink-0 place-items-center">
                    {bad ? <Icons.X className="size-4 text-bad" /> : st === 'done' ? <Icons.Check className="size-4 text-accent-strong" /> : st === 'running' ? <Spinner /> : <span className="size-1.5 rounded-full bg-white/20" />}
                  </span>
                  <span className={cn(bad && 'text-bad')}>{stepLabel(s)}</span>
                </li>
              );
            })}
          </ol>
          <div className="mt-4">
            <FormError message={submitError} />
          </div>
        </div>
      )}

      {phase === 'done' && input && (
        <div className="space-y-5">
          <p className="text-sm text-muted">{t('provision.readyBody')}</p>
          <dl className="nx-glass divide-y divide-white/[0.07] rounded-panel text-sm">
            {[
              [t('provision.signInAt'), window.location.origin],
              [t('provision.ownerEmail'), input.ownerEmail.trim().toLowerCase()],
              [t('provision.password'), input.ownerPassword],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <dt className="eyebrow">{label}</dt>
                  <dd className="ticket-no mt-1 break-all text-base text-ink">{value}</dd>
                </div>
                <CopyButton value={value} label={`${t('provision.copy')} ${label}`} />
              </div>
            ))}
          </dl>
          <p className="rounded-control bg-warn/12 px-3 py-2 text-sm text-warn">{t('provision.shownOnce')}</p>
        </div>
      )}
    </Dialog>
  );
}
