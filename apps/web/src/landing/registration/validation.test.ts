import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FORM_VALUES,
  VALIDATION_MESSAGES,
  normalizeIndianMobile,
  validateRegistration,
  type RegistrationFormValues,
} from '../content';
import { ERROR_ORDER, fieldId, formatMobileDisplay, orderedErrors, sanitizeOutlets, validateField } from './validation';

const valid: RegistrationFormValues = {
  ...DEFAULT_FORM_VALUES,
  restaurantName: 'Ananda Cafe',
  contactName: 'Asha Patel',
  phone: '97145 71522',
  email: 'asha@example.com',
  city: 'Visnagar',
  outlets: '2',
  consent: true,
};

describe('registration validation rules', () => {
  it('accepts a complete, valid form', () => {
    expect(validateRegistration(valid)).toEqual({});
  });

  it('requires restaurant name, contact name, city, phone, email and consent', () => {
    const errors = validateRegistration(DEFAULT_FORM_VALUES);
    expect(Object.keys(errors).sort()).toEqual(['city', 'consent', 'contactName', 'email', 'phone', 'restaurantName']);
    expect(errors.consent).toBe(VALIDATION_MESSAGES.consent);
  });

  it('rejects one-character names and cities', () => {
    const errors = validateRegistration({ ...valid, restaurantName: 'A', contactName: ' B ', city: 'C' });
    expect(errors.restaurantName).toMatch(/at least 2 characters/);
    expect(errors.contactName).toMatch(/at least 2 characters/);
    expect(errors.city).toMatch(/at least 2 characters/);
  });

  it('checks the email shape', () => {
    expect(validateRegistration({ ...valid, email: 'asha@' }).email).toBe(VALIDATION_MESSAGES.email);
    expect(validateRegistration({ ...valid, email: 'asha example.com' }).email).toBe(VALIDATION_MESSAGES.email);
    expect(validateRegistration({ ...valid, email: ' asha@example.com ' }).email).toBeUndefined();
  });

  it('outlets must be a whole number from 1 to 500', () => {
    for (const bad of ['', '0', '501', '1.5', 'abc']) {
      expect(validateRegistration({ ...valid, outlets: bad }).outlets).toBe(VALIDATION_MESSAGES.outlets);
    }
    for (const good of ['1', '4', '500']) {
      expect(validateRegistration({ ...valid, outlets: good }).outlets).toBeUndefined();
    }
  });
});

describe('Indian mobile numbers', () => {
  it.each([
    ['9714571522', '9714571522'],
    ['97145 71522', '9714571522'],
    ['+91 97145 71522', '9714571522'],
    ['+91-97145-71522', '9714571522'],
    ['919714571522', '9714571522'],
    ['09714571522', '9714571522'],
    ['(97145) 71522', '9714571522'],
  ])('normalises %s', (input, expected) => {
    expect(normalizeIndianMobile(input)).toBe(expected);
  });

  it.each(['12345', '5714571522', '97145715', '+1 415 555 0100', 'call me'])('rejects %s', (input) => {
    expect(normalizeIndianMobile(input)).toBeNull();
    expect(validateRegistration({ ...valid, phone: input }).phone).toBe(VALIDATION_MESSAGES.phone);
  });

  it('formats a valid number for display and leaves invalid input alone', () => {
    expect(formatMobileDisplay('+91 9714571522')).toBe('97145 71522');
    expect(formatMobileDisplay('  12345 ')).toBe('12345');
  });
});

describe('validation helpers', () => {
  it('validateField returns the message for one field only', () => {
    expect(validateField('email', { ...valid, email: 'nope' })).toBe(VALIDATION_MESSAGES.email);
    expect(validateField('city', { ...valid, email: 'nope' })).toBeUndefined();
  });

  it('orderedErrors follows the visible field order with consent last', () => {
    const list = orderedErrors(validateRegistration(DEFAULT_FORM_VALUES));
    expect(list.map((e) => e.name)).toEqual(['restaurantName', 'contactName', 'phone', 'email', 'city', 'consent']);
    expect(ERROR_ORDER[ERROR_ORDER.length - 1]).toBe('consent');
  });

  it('sanitizeOutlets keeps up to three digits', () => {
    expect(sanitizeOutlets('1a2b3c4')).toBe('123');
    expect(sanitizeOutlets('')).toBe('');
  });

  it('field ids are stable, prefixed and unique', () => {
    expect(fieldId('restaurantName')).toBe('reg-restaurantName');
    expect(new Set(ERROR_ORDER.map(fieldId)).size).toBe(ERROR_ORDER.length);
  });
});
