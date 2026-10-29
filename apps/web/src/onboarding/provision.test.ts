import { describe, expect, it } from 'vitest';
import { generatePassword, orderModules, stepsFor } from './provision';

describe('provision helpers', () => {
  it('always puts the core modules first, in dependency order', () => {
    expect(orderModules(['costs', 'reports'])).toEqual(['restaurant', 'catalog', 'checkout', 'reports', 'costs']);
    expect(orderModules([])).toEqual(['restaurant', 'catalog', 'checkout']);
  });
  it('lists one step per action in order', () => {
    expect(stepsFor({ modules: ['restaurant', 'catalog'] })).toEqual(['business', 'location', 'owner', 'module:restaurant', 'module:catalog', 'commercial', 'onboarding']);
  });
  it('generates strong, varied passwords', () => {
    const a = generatePassword();
    expect(a).toHaveLength(16);
    expect(a).toMatch(/[a-z]/);
    expect(a).toMatch(/[A-Z]/);
    expect(a).toMatch(/[0-9]/);
    expect(a).toMatch(/[#$%&*+=?@-]/);
    expect(generatePassword()).not.toEqual(a);
  });
});
