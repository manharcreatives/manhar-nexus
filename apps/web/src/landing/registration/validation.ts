import {
  REGISTRATION_FIELD_ORDER,
  normalizeIndianMobile,
  validateRegistration,
  type RegistrationErrors,
  type RegistrationFieldName,
  type RegistrationFormValues,
} from '../content';

/** Order in which errors are listed in the summary: visible fields first, consent last. */
export const ERROR_ORDER: readonly RegistrationFieldName[] = [...REGISTRATION_FIELD_ORDER, 'consent'];

/** Validate one field against the whole form (the rules live in content/register.ts). */
export function validateField(name: RegistrationFieldName, values: RegistrationFormValues): string | undefined {
  return validateRegistration(values)[name];
}

/** Errors as an ordered list for the error summary. */
export function orderedErrors(errors: RegistrationErrors): { name: RegistrationFieldName; message: string }[] {
  return ERROR_ORDER.flatMap((name) => {
    const message = errors[name];
    return message ? [{ name, message }] : [];
  });
}

/** '+91 98765-43210' -> '98765 43210' when it is a valid Indian mobile; otherwise the trimmed input is kept. */
export function formatMobileDisplay(input: string): string {
  const mobile = normalizeIndianMobile(input);
  return mobile ? `${mobile.slice(0, 5)} ${mobile.slice(5)}` : input.trim();
}

/** Keep digits only, capped at 3 characters (outlets are 1 to 500). */
export function sanitizeOutlets(input: string): string {
  return input.replace(/\D/g, '').slice(0, 3);
}

/** DOM id of a field's control. */
export const fieldId = (name: RegistrationFieldName): string => `reg-${name}`;
