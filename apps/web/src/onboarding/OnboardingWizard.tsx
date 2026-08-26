import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getOnboarding,
  validateOnboarding,
  completeStep,
  updateOnboardingNotes,
  ONBOARDING_STEPS,
  STEP_LABELS,
  STEP_DESCRIPTIONS,
  type OnboardingProgress,
  type OnboardingStep,
  type ValidationResult,
} from './api';

interface Props {
  businessId: string;
  onBack: () => void;
}

export function OnboardingWizard({ businessId, onBack }: Props) {
  const { t } = useTranslation();
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState<OnboardingStep | null>(null);
  const [notes, setNotes] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);

  useEffect(() => {
    void load();
  }, [businessId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [p, v] = await Promise.all([
        getOnboarding(businessId),
        validateOnboarding(businessId),
      ]);
      setProgress(p);
      setValidation(v);
      setNotes(p.notes ?? '');
    } catch {
      setError(t('onboarding.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteStep(step: OnboardingStep) {
    setCompleting(step);
    try {
      const updated = await completeStep(businessId, step);
      setProgress(updated);
      const v = await validateOnboarding(businessId);
      setValidation(v);
    } catch {
      setError(t('onboarding.errors.stepFailed'));
    } finally {
      setCompleting(null);
    }
  }

  async function handleSaveNotes() {
    try {
      const updated = await updateOnboardingNotes(businessId, notes || null);
      setProgress(updated);
      setEditingNotes(false);
    } catch {
      setError(t('onboarding.errors.saveFailed'));
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">{t('onboarding.loading')}</p>;
  }

  if (error && !progress) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!progress) return null;

  const completedSet = new Set(progress.completedSteps);
  const pct = Math.round((completedSet.size / ONBOARDING_STEPS.length) * 100);

  return (
    <div className="max-w-3xl">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 text-sm text-blue-600 hover:underline"
      >
        {t('onboarding.back')}
      </button>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {progress.business.name}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {t('onboarding.wizard.subtitle', { status: progress.business.commercialStatus })}
          </p>
        </div>
        {progress.completedAt && (
          <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
            {t('onboarding.wizard.goLive')}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
          <span>{t('onboarding.wizard.progress')}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-200">
          <div
            className="h-2 rounded-full bg-blue-600 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Validation issues */}
      {validation && validation.issues.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-medium text-amber-800">{t('onboarding.wizard.validationIssues')}</p>
          <ul className="list-inside list-disc space-y-1">
            {validation.issues.map((issue) => (
              <li key={issue} className="text-xs text-amber-700">{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p className="mb-4 text-sm text-red-600">{error}</p>
      )}

      {/* Steps */}
      <div className="space-y-3">
        {ONBOARDING_STEPS.map((step, idx) => {
          const done = completedSet.has(step);
          const isCurrent = progress.currentStep === step;
          return (
            <div
              key={step}
              className={`rounded-lg border p-4 ${
                done
                  ? 'border-green-200 bg-green-50'
                  : isCurrent
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      done
                        ? 'bg-green-600 text-white'
                        : isCurrent
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {done ? '✓' : idx + 1}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${done ? 'text-green-800' : 'text-slate-900'}`}>
                      {STEP_LABELS[step]}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {STEP_DESCRIPTIONS[step]}
                    </p>
                  </div>
                </div>
                {!done && (
                  <button
                    type="button"
                    disabled={completing === step}
                    onClick={() => void handleCompleteStep(step)}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {completing === step ? t('onboarding.wizard.marking') : t('onboarding.wizard.markDone')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Notes */}
      <div className="mt-8 rounded-lg border border-slate-200 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-900">{t('onboarding.wizard.notes')}</p>
          {!editingNotes && (
            <button
              type="button"
              onClick={() => setEditingNotes(true)}
              className="text-xs text-blue-600 hover:underline"
            >
              {t('onboarding.wizard.editNotes')}
            </button>
          )}
        </div>
        {editingNotes ? (
          <div className="space-y-2">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder={t('onboarding.wizard.notesPlaceholder')}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleSaveNotes()}
                className="text-sm rounded-md bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700"
              >
                {t('onboarding.wizard.saveNotes')}
              </button>
              <button
                type="button"
                onClick={() => { setEditingNotes(false); setNotes(progress.notes ?? ''); }}
                className="text-sm rounded-md border border-slate-300 px-3 py-1.5 text-slate-600"
              >
                {t('onboarding.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            {progress.notes ?? <span className="italic text-slate-400">{t('onboarding.wizard.noNotes')}</span>}
          </p>
        )}
      </div>
    </div>
  );
}
