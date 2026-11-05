import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { ToastProvider } from '../ui/Toast';
import type { OnboardingProgress, ValidationResult } from './api';

const business = { id: 'b-1', name: 'Ananda Cafe', commercialStatus: 'TRIAL', slug: 'ananda', logoUrl: null, accentColor: null };
const progress: OnboardingProgress = {
  id: 'p-1',
  businessId: 'b-1',
  completedSteps: ['BUSINESS_CREATED'],
  currentStep: 'LOCATION_ADDED',
  notes: null,
  startedAt: '2026-11-01T10:00:00.000Z',
  completedAt: null,
  updatedAt: '2026-11-01T10:00:00.000Z',
  business,
};
const validation: ValidationResult = { hasLocation: true, hasActiveModule: true, hasNonOwnerUser: true, hasBranding: true, issues: [] };

const getOnboarding = vi.fn();
const validateOnboarding = vi.fn();
const completeStep = vi.fn();
const updateOnboardingNotes = vi.fn();
vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  getOnboarding: (...a: unknown[]) => getOnboarding(...a),
  validateOnboarding: (...a: unknown[]) => validateOnboarding(...a),
  completeStep: (...a: unknown[]) => completeStep(...a),
  updateOnboardingNotes: (...a: unknown[]) => updateOnboardingNotes(...a),
}));

import { OnboardingWizard, keepBusiness } from './OnboardingWizard';

/** What the API used to return for a step update: the record WITHOUT its business. */
const withoutBusiness = (p: OnboardingProgress): Omit<OnboardingProgress, 'business'> => {
  const { business: _b, ...rest } = p;
  return rest;
};

beforeEach(() => {
  getOnboarding.mockReset().mockResolvedValue(progress);
  validateOnboarding.mockReset().mockResolvedValue(validation);
  completeStep.mockReset();
  updateOnboardingNotes.mockReset();
});
afterEach(cleanup);

describe('keepBusiness', () => {
  it('keeps the business already on screen when the response has none', () => {
    const merged = keepBusiness(withoutBusiness(progress) as OnboardingProgress, progress);
    expect(merged.business.name).toBe('Ananda Cafe');
  });
  it('uses the response business when it has one', () => {
    const merged = keepBusiness({ ...progress, business: { ...business, name: 'Renamed' } }, progress);
    expect(merged.business.name).toBe('Renamed');
  });
});

describe('OnboardingWizard', () => {
  it('survives marking a step done when the API response has no business (this used to crash the page)', async () => {
    completeStep.mockResolvedValue({
      ...withoutBusiness(progress),
      completedSteps: ['BUSINESS_CREATED', 'LOCATION_ADDED'],
      currentStep: 'MODULES_SELECTED',
    });
    render(
      <ToastProvider>
        <OnboardingWizard businessId="b-1" onBack={() => undefined} />
      </ToastProvider>,
    );
    // Only the next step can be marked; the later ones are disabled.
    const buttons = await screen.findAllByRole('button', { name: /Mark .* as done/i });
    fireEvent.click(buttons.find((b) => !(b as HTMLButtonElement).disabled) as HTMLElement);
    // Wait for the update to land (the success toast), then check the wizard is still there with its business name.
    await screen.findAllByText(/marked done/i);
    expect(screen.getByRole('heading', { name: 'Ananda Cafe' })).toBeTruthy();
    expect(screen.queryByText(/Something went wrong/i)).toBeNull();
    expect(completeStep).toHaveBeenCalledWith('b-1', 'LOCATION_ADDED', undefined);
  });

  it('survives saving notes when the API response has no business', async () => {
    updateOnboardingNotes.mockResolvedValue({ ...withoutBusiness(progress), notes: 'call on Monday' });
    render(
      <ToastProvider>
        <OnboardingWizard businessId="b-1" onBack={() => undefined} />
      </ToastProvider>,
    );
    await screen.findByRole('heading', { name: 'Ananda Cafe' });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'call on Monday' } });
    fireEvent.click(screen.getByRole('button', { name: /save notes/i }));
    await vi.waitFor(() => expect(updateOnboardingNotes).toHaveBeenCalled());
    await screen.findAllByText(/notes saved/i);
    expect(screen.getByRole('heading', { name: 'Ananda Cafe' })).toBeTruthy();
  });
});
