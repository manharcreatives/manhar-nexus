import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COMMERCIAL_TONE, errorMessage } from '../commercial/helpers';
import { FormError } from '../commercial/Shared';
import { cn } from '../lib/cn';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Panel } from '../ui/Panel';
import { StatusPill } from '../ui/StatusPill';
import { Textarea } from '../ui/Textarea';
import { ErrorState, Skeleton } from '../ui/states';
import { useToast } from '../ui/Toast';
import {
  completeStep,
  getOnboarding,
  ONBOARDING_STEPS,
  updateOnboardingNotes,
  validateOnboarding,
  type OnboardingProgress,
  type OnboardingStep,
  type ValidationResult,
} from './api';

interface Props {
  businessId: string;
  onBack: () => void;
}

/** Steps whose completion is backed by a checkable fact about the business. */
const STEP_CHECK: Partial<Record<OnboardingStep, keyof Omit<ValidationResult, 'issues'>>> = {
  LOCATION_ADDED: 'hasLocation',
  MODULES_SELECTED: 'hasActiveModule',
  BRANDING_SET: 'hasBranding',
  USERS_PROVISIONED: 'hasNonOwnerUser',
};

const CHECK_KEYS: (keyof Omit<ValidationResult, 'issues'>)[] = [
  'hasLocation',
  'hasActiveModule',
  'hasNonOwnerUser',
  'hasBranding',
];

export function OnboardingWizard({ businessId, onBack }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [busyStep, setBusyStep] = useState<OnboardingStep | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);

  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  const [confirmLive, setConfirmLive] = useState(false);
  const [liveNote, setLiveNote] = useState('');

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const [p, v] = await Promise.all([getOnboarding(businessId), validateOnboarding(businessId)]);
      setProgress(p);
      setValidation(v);
      setNotes(p.notes ?? '');
    } catch {
      setLoadFailed(true);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function recheck(announce: boolean) {
    setChecking(true);
    try {
      const v = await validateOnboarding(businessId);
      setValidation(v);
      if (announce) toast.show(v.issues.length === 0 ? t('onboarding.wizard.readyToast') : t('onboarding.wizard.notReadyToast', { count: v.issues.length }), v.issues.length === 0 ? 'ok' : 'info');
    } catch {
      toast.show(t('onboarding.errors.checkFailed'), 'bad');
    } finally {
      setChecking(false);
    }
  }

  async function advance(step: OnboardingStep, note?: string): Promise<boolean> {
    setBusyStep(step);
    setStepError(null);
    try {
      const updated = await completeStep(businessId, step, note);
      setProgress(updated);
      setValidation(await validateOnboarding(businessId));
      return true;
    } catch (err) {
      setStepError(errorMessage(err, t('onboarding.errors.stepFailed')));
      return false;
    } finally {
      setBusyStep(null);
    }
  }

  async function markDone(step: OnboardingStep) {
    if (await advance(step)) toast.show(t('onboarding.wizard.stepDoneToast', { step: t(`onboarding.steps.${step}.label`) }));
  }

  async function goLive() {
    if (await advance('COMPLETED', liveNote.trim() || undefined)) {
      setConfirmLive(false);
      setLiveNote('');
      toast.show(t('onboarding.wizard.liveToast', { name: progress?.business.name ?? '' }));
    }
  }

  async function saveNotes() {
    setSavingNotes(true);
    setNotesError(null);
    try {
      const updated = await updateOnboardingNotes(businessId, notes.trim() || null);
      setProgress(updated);
      setNotes(updated.notes ?? '');
      toast.show(t('onboarding.wizard.notesSaved'));
    } catch (err) {
      setNotesError(errorMessage(err, t('onboarding.errors.saveFailed')));
    } finally {
      setSavingNotes(false);
    }
  }

  const back = (
    <Button variant="ghost" onClick={onBack} className="mb-3 -ml-3">
      {t('onboarding.back')}
    </Button>
  );

  if (loadFailed) {
    return (
      <div>
        {back}
        <ErrorState
          title={t('onboarding.errors.loadTitle')}
          body={t('onboarding.errors.loadFailed')}
          onRetry={() => void load()}
          retryLabel={t('commercial.retry')}
        />
      </div>
    );
  }

  if (!progress || !validation) {
    return (
      <div>
        {back}
        <div role="status" aria-label={t('onboarding.loading')} className="space-y-3">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const done = new Set(progress.completedSteps);
  const isLive = !!progress.completedAt;
  const total = ONBOARDING_STEPS.length;
  const pct = Math.round((done.size / total) * 100);
  const nextStep = ONBOARDING_STEPS.find((s) => !done.has(s));
  const ready = validation.issues.length === 0;
  const earlierDone = ONBOARDING_STEPS.filter((s) => s !== 'COMPLETED').every((s) => done.has(s));
  const canGoLive = !isLive && ready && earlierDone;
  const notesChanged = notes.trim() !== (progress.notes ?? '');

  const goLiveBlockers: string[] = [];
  if (!isLive) {
    for (const k of CHECK_KEYS) if (!validation[k]) goLiveBlockers.push(t(`onboarding.blockers.${k}`));
    if (!earlierDone) goLiveBlockers.push(t('onboarding.blockers.stepsOpen'));
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        {back}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold">{progress.business.name}</h1>
            <p className="mt-1 text-sm text-muted">{t('onboarding.wizard.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill tone={COMMERCIAL_TONE[progress.business.commercialStatus as keyof typeof COMMERCIAL_TONE] ?? 'neutral'}>
              {t(`commercial.status.${progress.business.commercialStatus}`, { defaultValue: progress.business.commercialStatus })}
            </StatusPill>
            {isLive && <StatusPill tone="ok">{t('onboarding.wizard.goLive')}</StatusPill>}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-sm text-muted">
          <span>{t('onboarding.wizard.progress')}</span>
          <span className="tabular" aria-live="polite">
            {t('onboarding.stepsDone', { done: done.size, total })}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label={t('onboarding.wizard.progress')}
          className="h-2.5 w-full rounded-full bg-sunken"
        >
          <div className={cn('h-2.5 rounded-full transition-all', isLive ? 'bg-ok' : 'bg-accent')} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <Panel aria-labelledby="ready-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="ready-h" className="text-lg font-semibold">
            {t('onboarding.wizard.readiness')}
          </h2>
          <Button variant="secondary" loading={checking} onClick={() => void recheck(true)}>
            {t('onboarding.wizard.recheck')}
          </Button>
        </div>
        <ul className="mt-3 space-y-2">
          {CHECK_KEYS.map((k) => (
            <li key={k} className="flex flex-wrap items-start gap-2 text-sm">
              <StatusPill tone={validation[k] ? 'ok' : 'warn'}>
                {t(validation[k] ? 'onboarding.wizard.passed' : 'onboarding.wizard.blocked')}
              </StatusPill>
              <span className="min-w-0 flex-1">
                <span className="font-medium">{t(`onboarding.checks.${k}`)}</span>
                {!validation[k] && <span className="block text-muted">{t(`onboarding.blockers.${k}`)}</span>}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <div aria-live="polite">
        {stepError && (
          <p role="alert" className="rounded-control bg-bad-soft px-3 py-2 text-sm text-bad">
            {stepError}
          </p>
        )}
      </div>

      <ol className="space-y-3" aria-label={t('onboarding.wizard.stepsLabel')}>
        {ONBOARDING_STEPS.map((step, idx) => {
          const isDone = done.has(step);
          const isNext = step === nextStep && !isLive;
          const isFinal = step === 'COMPLETED';
          const check = STEP_CHECK[step];
          const checkFails = !!check && !validation[check];
          const lockedByOrder = !isDone && !isNext;
          const blockedReason = checkFails && check ? t(`onboarding.blockers.${check}`) : null;

          let pill: { tone: 'ok' | 'accent' | 'neutral' | 'warn'; text: string };
          if (isDone) pill = { tone: 'ok', text: t('onboarding.wizard.statusDone') };
          else if (isNext && (blockedReason || (isFinal && !canGoLive))) pill = { tone: 'warn', text: t('onboarding.wizard.statusBlocked') };
          else if (isNext) pill = { tone: 'accent', text: t('onboarding.wizard.statusNext') };
          else pill = { tone: 'neutral', text: t('onboarding.wizard.statusLater') };

          return (
            <li
              key={step}
              aria-current={isNext ? 'step' : undefined}
              className={cn('rounded-panel border p-4', isNext ? 'border-accent bg-accent-soft/40' : 'border-line bg-surface')}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      'tabular flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                      isDone ? 'bg-ok text-surface' : isNext ? 'bg-accent text-surface' : 'bg-sunken text-muted',
                    )}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{t(`onboarding.steps.${step}.label`)}</h3>
                      <StatusPill tone={pill.tone}>{pill.text}</StatusPill>
                    </div>
                    <p className="mt-0.5 text-sm text-muted">{t(`onboarding.steps.${step}.description`)}</p>
                    {isNext && !isFinal && blockedReason && <p className="mt-1 text-sm text-warn">{blockedReason}</p>}
                    {isNext && isFinal && !canGoLive && (
                      <div className="mt-1 text-sm text-warn">
                        <p>{t('onboarding.wizard.cannotGoLive')}</p>
                        <ul className="list-disc pl-5">
                          {goLiveBlockers.map((b) => (
                            <li key={b}>{b}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                {!isDone && !isFinal && (
                  <Button
                    variant={isNext ? 'primary' : 'secondary'}
                    loading={busyStep === step}
                    disabled={lockedByOrder || checkFails || (step === 'VALIDATED' && !ready) || busyStep !== null}
                    onClick={() => void markDone(step)}
                    aria-label={t('onboarding.wizard.markDoneNamed', { step: t(`onboarding.steps.${step}.label`) })}
                  >
                    {busyStep === step ? t('onboarding.wizard.marking') : t('onboarding.wizard.markDone')}
                  </Button>
                )}
                {!isDone && isFinal && (
                  <Button disabled={!canGoLive || busyStep !== null} onClick={() => setConfirmLive(true)}>
                    {t('onboarding.wizard.goLiveAction')}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <Panel aria-labelledby="notes-h">
        <h2 id="notes-h" className="text-lg font-semibold">
          {t('onboarding.wizard.notes')}
        </h2>
        <div className="mt-3 space-y-3">
          <Textarea
            label={t('onboarding.wizard.notesLabel')}
            rows={4}
            maxLength={2000}
            value={notes}
            placeholder={t('onboarding.wizard.notesPlaceholder')}
            onChange={(e) => setNotes(e.target.value)}
          />
          <FormError message={notesError} />
          <div className="flex gap-2">
            <Button loading={savingNotes} disabled={!notesChanged} onClick={() => void saveNotes()}>
              {savingNotes ? t('commercial.saving') : t('onboarding.wizard.saveNotes')}
            </Button>
            {notesChanged && !savingNotes && (
              <Button variant="ghost" onClick={() => setNotes(progress.notes ?? '')}>
                {t('onboarding.wizard.discard')}
              </Button>
            )}
          </div>
        </div>
      </Panel>

      <Dialog
        open={confirmLive}
        onClose={() => busyStep === null && setConfirmLive(false)}
        title={t('onboarding.wizard.confirmTitle', { name: progress.business.name })}
        footer={
          <>
            <Button variant="secondary" disabled={busyStep !== null} onClick={() => setConfirmLive(false)}>
              {t('onboarding.cancel')}
            </Button>
            <Button loading={busyStep === 'COMPLETED'} onClick={() => void goLive()}>
              {t('onboarding.wizard.confirmAction')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm">{t('onboarding.wizard.confirmBody')}</p>
          <p className="text-sm font-medium">{t('onboarding.wizard.confirmIrreversible')}</p>
          <Textarea
            label={t('onboarding.wizard.liveNote')}
            rows={2}
            maxLength={500}
            value={liveNote}
            onChange={(e) => setLiveNote(e.target.value)}
          />
          <FormError message={stepError} />
        </div>
      </Dialog>
    </div>
  );
}
