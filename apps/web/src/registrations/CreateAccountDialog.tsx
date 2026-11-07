import { useId, useState, type FormEvent } from 'react';
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
import { ClaimLinkButtons } from './ClaimLinkButtons';
import { isPaid, provisionRegistration, type ProvisionBody, type ProvisionResult, type RegistrationRequest } from './api';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function CopyButton({ value, label, onCopied }: { value: string; label: string; onCopied?: () => void }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      aria-label={label}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          onCopied?.();
          setTimeout(() => setCopied(false), 1800);
        });
      }}
    >
      {copied ? t('provision.copied') : t('provision.copy')}
    </Button>
  );
}

/**
 * One click creates the restaurant account on the server as a resumable job. The server reports every step, so a
 * failure shows exactly where it stopped and Retry continues from there (nothing is created twice).
 */
export function CreateAccountDialog({
  request,
  onClose,
  onDone,
  onOpenChecklist,
}: {
  request: RegistrationRequest;
  onClose: () => void;
  /** The account exists and the request is converted (called before the password is shown). */
  onDone: (businessId: string) => void;
  onOpenChecklist?: (businessId: string) => void;
}) {
  const { t } = useTranslation();
  const formId = useId();
  const paid = isPaid(request);
  const [name, setName] = useState(request.restaurantName);
  const [locationName, setLocationName] = useState('Main Location');
  const [ownerName, setOwnerName] = useState(request.contactName);
  const [ownerEmail, setOwnerEmail] = useState(request.email);
  const [pilot, setPilot] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ProvisionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The temporary password is shown once. Closing before it was copied (or a set-password link was made) asks first.
  const [saved, setSaved] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);

  const failed = result?.status === 'FAILED';
  const done = result?.status === 'DONE';

  async function run(body: ProvisionBody) {
    setBusy(true);
    setError(null);
    try {
      const res = await provisionRegistration(request.id, body);
      setResult(res);
      if (res.status === 'DONE') {
        if (res.businessId) onDone(res.businessId);
      }
    } catch (err) {
      setError(errorMessage(err, t('registrations.account.failedGeneric')));
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t('provision.errors.name');
    if (!locationName.trim()) next.location = t('provision.errors.location');
    if (!ownerName.trim()) next.ownerName = t('provision.errors.ownerName');
    if (!EMAIL.test(ownerEmail.trim())) next.email = t('provision.errors.email');
    if (!paid && !pilot) next.pilot = t('registrations.account.needsPaymentOrPilot');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setStarted(true);
    void run({
      name: name.trim(),
      locationName: locationName.trim(),
      ownerName: ownerName.trim(),
      ownerEmail: ownerEmail.trim().toLowerCase(),
      ...(paid ? {} : { allowUnpaid: true }),
    });
  }

  const needsAck = done && !!result?.credentials && !saved;

  /** Esc and the backdrop close a native dialog before React can stop it, so re-open it (new key) with the warning shown. */
  function requestClose() {
    if (busy) return;
    if (needsAck) {
      setConfirmClose(true);
      setDialogKey((k) => k + 1);
      return;
    }
    onClose();
  }

  const stepLabel = (id: string) =>
    id.startsWith('module:') ? t('registrations.account.step.module', { name: t(`provision.module.${id.slice(7)}`) }) : t(`registrations.account.step.${id}`);

  // While the first request is in flight we only know the plan; show the usual steps as pending.
  const steps = result?.steps ?? [];

  const footer = !started ? (
    <>
      <Button variant="secondary" onClick={onClose}>{t('onboarding.cancel')}</Button>
      <Button type="submit" form={formId}>{t('registrations.account.create')}</Button>
    </>
  ) : done ? (
    <>
      <Button variant="secondary" onClick={requestClose}>{t('provision.done')}</Button>
      {result?.businessId && onOpenChecklist ? <Button onClick={() => onOpenChecklist(result.businessId as string)}>{t('provision.openChecklist')}</Button> : null}
    </>
  ) : busy ? null : (
    <>
      <Button variant="secondary" onClick={onClose}>{t('provision.closeAnyway')}</Button>
      <Button
        onClick={() => void run({ ownerEmail: ownerEmail.trim().toLowerCase(), ...(paid ? {} : { allowUnpaid: true }) })}
      >
        {t('registrations.account.retry')}
      </Button>
    </>
  );

  return (
    <Dialog
      key={dialogKey}
      open
      onClose={requestClose}
      title={done ? t('registrations.account.readyTitle', { name: request.restaurantName }) : t('registrations.account.title', { name: request.restaurantName })}
      className="w-[min(38rem,calc(100vw-2rem))]"
      footer={footer}
    >
      {!started ? (
        <form id={formId} onSubmit={submit} noValidate className="space-y-5">
          <p className="text-sm text-muted">{t('registrations.account.intro')}</p>
          <p className="rounded-control bg-white/[0.05] px-3 py-2 text-sm">{paid ? t('registrations.account.paidNote') : t('registrations.account.unpaidNote')}</p>
          <Field label={t('provision.name')} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoFocus data-autofocus />
          <Field label={t('provision.location')} hint={t('provision.locationHint')} value={locationName} onChange={(e) => setLocationName(e.target.value)} error={errors.location} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('provision.ownerName')} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} error={errors.ownerName} autoComplete="off" />
            <Field label={t('provision.ownerEmail')} type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} error={errors.email} autoComplete="off" />
          </div>
          {!paid ? (
            <div>
              <Checkbox label={t('registrations.account.pilot')} checked={pilot} onChange={(e) => setPilot(e.target.checked)} />
              {errors.pilot ? <p className="mt-1 text-sm text-bad">{errors.pilot}</p> : null}
            </div>
          ) : null}
        </form>
      ) : done && result?.credentials ? (
        <div className="space-y-5">
          <p className="text-sm text-muted">{t('registrations.account.readyBody')}</p>
          <dl className="nx-glass divide-y divide-white/[0.07] rounded-panel text-sm">
            {[
              [t('provision.signInAt'), window.location.origin],
              [t('provision.ownerEmail'), result.credentials.email],
              [t('provision.password'), result.credentials.password],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <dt className="eyebrow">{label}</dt>
                  <dd className="ticket-no mt-1 break-all text-base text-ink">{value}</dd>
                </div>
                <CopyButton value={value as string} label={`${t('provision.copy')} ${label}`} onCopied={() => setSaved(true)} />
              </div>
            ))}
          </dl>
          <p className="rounded-control bg-warn/12 px-3 py-2 text-sm text-warn">{t('registrations.account.shownOnce')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <ClaimLinkButtons request={request} onIssued={() => setSaved(true)} />
          </div>
          {confirmClose && needsAck ? (
            <div role="alert" className="space-y-2 rounded-control border border-bad/40 bg-bad/10 p-3 text-sm">
              <p>{t('registrations.account.closeWarning')}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setConfirmClose(false)}>{t('registrations.account.goBack')}</Button>
                <Button variant="ghost" onClick={onClose}>{t('provision.closeAnyway')}</Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : done ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">{t('registrations.account.alreadyDone')}</p>
          <p className="text-sm text-muted">{t('registrations.account.lost')}</p>
          <Button variant="secondary" loading={busy} onClick={() => void run({ reissuePassword: true })}>
            {t('registrations.account.reissue')}
          </Button>
          <FormError message={error} />
        </div>
      ) : (
        <div>
          <p className="mb-4 text-sm text-muted">{failed ? t('registrations.account.stopped') : t('registrations.account.working')}</p>
          <ol aria-live="polite" className="space-y-2">
            {steps.map((s) => (
              <li key={s.id} className={cn('flex items-center gap-3 text-sm', s.state === 'pending' && 'text-muted')}>
                <span aria-hidden className="grid size-6 shrink-0 place-items-center">
                  {s.state === 'failed' ? <Icons.X className="size-4 text-bad" /> : s.state === 'done' ? <Icons.Check className="size-4 text-accent-strong" /> : s.state === 'running' ? <Spinner /> : <span className="size-1.5 rounded-full bg-white/20" />}
                </span>
                <span className={cn(s.state === 'failed' && 'text-bad')}>{stepLabel(s.id)}</span>
              </li>
            ))}
          </ol>
          {busy && steps.length === 0 ? <div className="flex items-center gap-3 text-sm text-muted"><Spinner />{t('registrations.account.working')}</div> : null}
          {failed && result?.failedStep === 'owner' ? (
            <div className="mt-4">
              <Field label={t('registrations.account.fixEmail')} type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} autoComplete="off" />
            </div>
          ) : null}
          <div className="mt-4">
            <FormError message={failed ? result?.error ?? null : error} />
          </div>
        </div>
      )}
    </Dialog>
  );
}
