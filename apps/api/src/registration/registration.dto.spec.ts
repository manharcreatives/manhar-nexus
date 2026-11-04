import {
  CONSENT_VERSIONS,
  REGISTRATION_TRANSITIONS,
  createRegistrationSchema,
  updateRegistrationSchema,
} from './registration.dto';

const valid = {
  restaurantName: 'Ananda Cafe',
  contactName: 'Asha Patel',
  email: 'Asha@Example.com ',
  phone: '+91 97145 71522',
  city: 'Visnagar',
  businessKind: 'cafe',
  outlets: 2,
  planKey: 'floor',
  billingCycle: 'yearly',
  consent: true,
  consentVersion: CONSENT_VERSIONS[0],
};

describe('createRegistrationSchema', () => {
  it('accepts the contract body and normalises the email', () => {
    const out = createRegistrationSchema.parse(valid);
    expect(out.email).toBe('asha@example.com');
  });

  it('rejects unknown keys, bad email, consent=false and unknown consent versions', () => {
    expect(createRegistrationSchema.safeParse({ ...valid, role: 'admin' }).success).toBe(false);
    expect(createRegistrationSchema.safeParse({ ...valid, email: 'nope' }).success).toBe(false);
    expect(createRegistrationSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
    expect(createRegistrationSchema.safeParse({ ...valid, consentVersion: '1999-01-01' }).success).toBe(false);
  });

  it('enforces the allow-lists and numeric bounds', () => {
    for (const bad of [
      { planKey: 'enterprise' },
      { billingCycle: 'weekly' },
      { businessKind: 'spaceship' },
      { outlets: 0 },
      { outlets: 501 },
      { outlets: 1.5 },
      { message: 'x'.repeat(1001) },
      { phone: 'abc' },
    ]) {
      expect(createRegistrationSchema.safeParse({ ...valid, ...bad }).success).toBe(false);
    }
    for (const plan of ['counter', 'floor', 'pass', 'many-doors', 'not-sure']) {
      expect(createRegistrationSchema.safeParse({ ...valid, planKey: plan }).success).toBe(true);
    }
  });
});

describe('updateRegistrationSchema', () => {
  it('needs at least one field and rejects unknown keys', () => {
    expect(updateRegistrationSchema.safeParse({}).success).toBe(false);
    expect(updateRegistrationSchema.safeParse({ email: 'x@y.z' }).success).toBe(false);
    expect(updateRegistrationSchema.safeParse({ status: 'CONTACTED' }).success).toBe(true);
  });
});

describe('REGISTRATION_TRANSITIONS', () => {
  it('makes CONVERTED terminal and lets SPAM be reopened', () => {
    expect(REGISTRATION_TRANSITIONS.CONVERTED).toEqual([]);
    expect(REGISTRATION_TRANSITIONS.SPAM).toContain('NEW');
  });
});

describe('createRegistrationSchema: simplified landing form', () => {
  it('defaults plan and billing when the form does not send them', () => {
    const { planKey: _p, billingCycle: _b, ...bare } = valid;
    const out = createRegistrationSchema.parse(bare);
    expect(out.planKey).toBe('not-sure');
    expect(out.billingCycle).toBe('yearly');
  });

  it.each(['9714571522', '+91 97145 71522', '+919714571522', '09714571522', '91-97145-71522', '(97145) 71522'])(
    'normalises %s to +919714571522',
    (phone) => {
      expect(createRegistrationSchema.parse({ ...valid, phone }).phone).toBe('+919714571522');
    },
  );

  it.each(['1234567890', '5714571522', '+1 415 555 0100', '97145', '97145715221', 'call me'])(
    'rejects %s as an Indian mobile number',
    (phone) => {
      expect(createRegistrationSchema.safeParse({ ...valid, phone }).success).toBe(false);
    },
  );
});
