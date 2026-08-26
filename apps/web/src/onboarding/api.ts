import { api } from '../auth/api';

export const ONBOARDING_STEPS = [
  'BUSINESS_CREATED',
  'LOCATION_ADDED',
  'MODULES_SELECTED',
  'BRANDING_SET',
  'CONFIGURATION_DONE',
  'USERS_PROVISIONED',
  'DEVICES_CONFIGURED',
  'VALIDATED',
  'COMPLETED',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const STEP_LABELS: Record<OnboardingStep, string> = {
  BUSINESS_CREATED: 'Business Created',
  LOCATION_ADDED: 'Location Added',
  MODULES_SELECTED: 'Modules Activated',
  BRANDING_SET: 'Branding Configured',
  CONFIGURATION_DONE: 'Configuration Done',
  USERS_PROVISIONED: 'Users Provisioned',
  DEVICES_CONFIGURED: 'Devices Configured',
  VALIDATED: 'Validated & Tested',
  COMPLETED: 'Go Live ✓',
};

export const STEP_DESCRIPTIONS: Record<OnboardingStep, string> = {
  BUSINESS_CREATED: 'Business workspace created with type and basic details.',
  LOCATION_ADDED: 'At least one active location configured.',
  MODULES_SELECTED: 'Relevant modules activated and setup completed.',
  BRANDING_SET: 'Logo, accent color, and invoice identity configured.',
  CONFIGURATION_DONE: 'Key operational settings and alert rules configured.',
  USERS_PROVISIONED: 'Owner and staff accounts created with correct roles.',
  DEVICES_CONFIGURED: 'Print agents and printers set up (if applicable).',
  VALIDATED: 'Test transactions completed successfully.',
  COMPLETED: 'Client is live — handover completed.',
};

export interface OnboardingBusiness {
  id: string;
  name: string;
  commercialStatus: string;
  slug: string | null;
  logoUrl: string | null;
  accentColor: string | null;
}

export interface OnboardingProgress {
  id: string;
  businessId: string;
  completedSteps: string[];
  currentStep: string;
  notes: string | null;
  startedAt: string;
  completedAt: string | null;
  updatedAt: string;
  business: OnboardingBusiness;
}

export interface ValidationResult {
  hasLocation: boolean;
  hasActiveModule: boolean;
  hasNonOwnerUser: boolean;
  hasBranding: boolean;
  issues: string[];
}

export async function listOnboardings(params?: {
  currentStep?: OnboardingStep;
  completed?: boolean;
}): Promise<OnboardingProgress[]> {
  const qs = new URLSearchParams();
  if (params?.currentStep) qs.set('currentStep', params.currentStep);
  if (params?.completed !== undefined) qs.set('completed', String(params.completed));
  return api(`/internal/onboarding?${qs.toString()}`);
}

export async function initializeOnboarding(
  businessId: string,
  notes?: string,
): Promise<OnboardingProgress> {
  return api(`/internal/onboarding/${businessId}/initialize`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

export async function getOnboarding(businessId: string): Promise<OnboardingProgress> {
  return api(`/internal/onboarding/${businessId}`);
}

export async function validateOnboarding(businessId: string): Promise<ValidationResult> {
  return api(`/internal/onboarding/${businessId}/validate`);
}

export async function completeStep(
  businessId: string,
  step: OnboardingStep,
  note?: string,
): Promise<OnboardingProgress> {
  return api(`/internal/onboarding/${businessId}/steps/${step}`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}

export async function updateOnboardingNotes(
  businessId: string,
  notes: string | null,
): Promise<OnboardingProgress> {
  return api(`/internal/onboarding/${businessId}/notes`, {
    method: 'PATCH',
    body: JSON.stringify({ notes }),
  });
}
