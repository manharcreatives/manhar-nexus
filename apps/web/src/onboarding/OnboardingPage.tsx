import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  listOnboardings,
  initializeOnboarding,
  ONBOARDING_STEPS,
  type OnboardingProgress,
} from './api';
import { OnboardingWizard } from './OnboardingWizard';

const STATUS_COLORS: Record<string, string> = {
  PROSPECT: 'bg-slate-100 text-slate-600',
  TRIAL: 'bg-blue-100 text-blue-700',
  ACTIVE: 'bg-green-100 text-green-700',
  SUSPENDED: 'bg-amber-100 text-amber-700',
  CHURNED: 'bg-red-100 text-red-700',
};

export function OnboardingPage() {
  const { t } = useTranslation();
  const [onboardings, setOnboardings] = useState<OnboardingProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [startingBizId, setStartingBizId] = useState<string | null>(null);
  const [initBizId, setInitBizId] = useState('');
  const [showInitForm, setShowInitForm] = useState(false);
  const [filterCompleted, setFilterCompleted] = useState<boolean | undefined>(false);

  useEffect(() => {
    void load();
  }, [filterCompleted]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setOnboardings(await listOnboardings({ completed: filterCompleted }));
    } catch {
      setError(t('onboarding.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleInit() {
    if (!initBizId.trim()) return;
    setStartingBizId(initBizId.trim());
    try {
      await initializeOnboarding(initBizId.trim());
      setInitBizId('');
      setShowInitForm(false);
      await load();
    } catch {
      setError(t('onboarding.errors.initFailed'));
    } finally {
      setStartingBizId(null);
    }
  }

  if (selectedId) {
    return (
      <OnboardingWizard
        businessId={selectedId}
        onBack={() => { setSelectedId(null); void load(); }}
      />
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{t('onboarding.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('onboarding.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowInitForm((v) => !v)}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
        >
          {t('onboarding.startNew')}
        </button>
      </div>

      {showInitForm && (
        <div className="mb-6 rounded-lg border border-slate-200 p-4 space-y-3">
          <h3 className="text-sm font-medium">{t('onboarding.initTitle')}</h3>
          <div>
            <label className="block text-xs text-slate-600 mb-1">{t('onboarding.businessIdLabel')}</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-mono"
              placeholder="Business UUID"
              value={initBizId}
              onChange={(e) => setInitBizId(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!!startingBizId}
              onClick={() => void handleInit()}
              className="text-sm rounded-md bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {startingBizId ? t('onboarding.starting') : t('onboarding.start')}
            </button>
            <button
              type="button"
              onClick={() => setShowInitForm(false)}
              className="text-sm rounded-md border border-slate-300 px-3 py-1.5 text-slate-600"
            >
              {t('onboarding.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="mb-4 flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 w-fit">
        {[
          { label: t('onboarding.filterInProgress'), value: false as const },
          { label: t('onboarding.filterCompleted'), value: true as const },
          { label: t('onboarding.filterAll'), value: undefined },
        ].map(({ label, value }) => (
          <button
            key={String(value)}
            type="button"
            onClick={() => setFilterCompleted(value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filterCompleted === value
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">{t('onboarding.loading')}</p>
      ) : onboardings.length === 0 ? (
        <p className="text-sm text-slate-400">{t('onboarding.empty')}</p>
      ) : (
        <div className="space-y-3">
          {onboardings.map((o) => {
            const pct = Math.round((o.completedSteps.length / ONBOARDING_STEPS.length) * 100);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setSelectedId(o.businessId)}
                className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{o.business.name}</p>
                      <p className="text-xs text-slate-500">
                        {t('onboarding.currentStep')}: {o.currentStep.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_COLORS[o.business.commercialStatus] ?? 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {o.business.commercialStatus}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">{pct}%</p>
                      <p className="text-xs text-slate-400">{o.completedSteps.length}/{ONBOARDING_STEPS.length} steps</p>
                    </div>
                    {o.completedAt && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        {t('onboarding.completed')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100">
                  <div
                    className={`h-1.5 rounded-full transition-all ${o.completedAt ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
