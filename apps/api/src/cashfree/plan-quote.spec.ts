import {
  BILLING_CYCLES,
  FOUNDING,
  GST_PERCENT,
  LAUNCH_PACK_PAISE,
  PLAN_PRICES,
  PRICED_PLAN_KEYS,
  QuoteError,
  gstOn,
  isFoundingOpen,
  quotePlan,
} from '@nexus/shared';
import { createPaymentLinkSchema } from './cashfree.dto';

const IN_WINDOW = new Date('2026-12-15T12:00:00+05:30');
const AFTER_WINDOW = new Date('2027-02-01T12:00:00+05:30');

describe('Founding window', () => {
  it('opens at 00:00 IST on 1 Nov 2026 and closes at 23:59 IST on 31 Jan 2027, both ends inclusive', () => {
    expect(isFoundingOpen(new Date('2026-10-31T23:59:59+05:30'))).toBe(false);
    expect(isFoundingOpen(new Date('2026-11-01T00:00:00+05:30'))).toBe(true);
    expect(isFoundingOpen(new Date('2027-01-31T23:59:00+05:30'))).toBe(true);
    expect(isFoundingOpen(new Date('2027-01-31T23:59:01+05:30'))).toBe(false);
  });
});

describe('quotePlan: the whole matrix', () => {
  for (const planKey of PRICED_PLAN_KEYS) {
    for (const cycle of BILLING_CYCLES) {
      for (const offerDate of [IN_WINDOW, AFTER_WINDOW]) {
        for (const launchPack of [false, true]) {
          const name = `${planKey} ${cycle} ${offerDate === IN_WINDOW ? 'in Founding' : 'after Founding'} ${launchPack ? 'with' : 'without'} Launch Pack`;
          it(name, () => {
            const q = quotePlan({ planKey, cycle, offerDate, launchPack });
            const plan = PLAN_PRICES[planKey];
            const founding = cycle === 'yearly' && offerDate === IN_WINDOW;

            // Founding discounts the YEARLY plan only.
            expect(q.foundingApplied).toBe(founding);
            const base = cycle === 'yearly' ? (founding ? plan.foundingYearlyPaise : plan.yearlyPaise) : plan.monthlyPaise;
            // Launch Pack is charged only when asked for AND not already included (Pass, or a Founding yearly plan).
            const included = plan.includesLaunchPack || founding;
            const packCharged = launchPack && !included;
            expect(q.launchPackCharged).toBe(packCharged);
            const subtotal = base + (packCharged ? LAUNCH_PACK_PAISE : 0);

            expect(q.subtotalPaise).toBe(subtotal);
            expect(q.gstPaise).toBe(gstOn(subtotal));
            expect(q.totalPaise).toBe(subtotal + gstOn(subtotal));
            expect(q.gstPercent).toBe(GST_PERCENT);
            // The lines add up to the total exactly (what the owner is shown is what they pay).
            expect(q.lines.reduce((sum, l) => sum + l.amountPaise, 0)).toBe(q.totalPaise);
            expect(Number.isInteger(q.totalPaise)).toBe(true);
            expect(q.description.length).toBeLessThanOrEqual(200);
            expect(q.description).toContain(plan.name);
            expect(q.description).toContain(`incl. ${GST_PERCENT}% GST`);
          });
        }
      }
    }
  }
});

describe('quotePlan: known figures (these are the prices on the landing page)', () => {
  it.each([
    ['counter', 'monthly', 70_682],
    ['counter', 'yearly', 706_820],
    ['floor', 'monthly', 153_282],
    ['floor', 'yearly', 1_532_820],
    ['pass', 'monthly', 294_882],
    ['pass', 'yearly', 2_948_820],
  ] as const)('%s %s list price with GST is %d paise', (planKey, cycle, total) => {
    expect(quotePlan({ planKey, cycle, offerDate: AFTER_WINDOW }).totalPaise).toBe(total);
  });

  it.each([
    ['counter', 529_820],
    ['floor', 1_149_320],
    ['pass', 2_211_320],
  ] as const)('%s yearly during Founding with GST is %d paise', (planKey, total) => {
    expect(quotePlan({ planKey, cycle: 'yearly', offerDate: IN_WINDOW }).totalPaise).toBe(total);
  });

  it('Founding is exactly the advertised percentage off, give or take the rounding to a whole 10 rupees', () => {
    for (const key of PRICED_PLAN_KEYS) {
      const p = PLAN_PRICES[key];
      const advertised = (p.yearlyPaise * (100 - FOUNDING.discountPercent)) / 100;
      expect(Math.abs(p.foundingYearlyPaise - advertised)).toBeLessThanOrEqual(1_000);
    }
  });

  it('GST is rounded to the paisa, half up, like the landing page', () => {
    expect(gstOn(59_900)).toBe(10_782);
    expect(gstOn(1)).toBe(0);
    expect(gstOn(3)).toBe(1); // 0.54 rounds up
    expect(gstOn(100)).toBe(18);
  });
});

describe('quotePlan: what it refuses', () => {
  it('refuses Many Doors and "not sure" with a message that tells staff what to do', () => {
    expect(() => quotePlan({ planKey: 'many-doors', cycle: 'yearly' })).toThrow(QuoteError);
    expect(() => quotePlan({ planKey: 'many-doors', cycle: 'yearly' })).toThrow(/agree the amount/);
    expect(() => quotePlan({ planKey: 'not-sure', cycle: 'yearly' })).toThrow(/pick a plan/);
    expect(() => quotePlan({ planKey: 'platinum', cycle: 'yearly' })).toThrow(QuoteError);
  });

  it('refuses an unknown billing cycle', () => {
    expect(() => quotePlan({ planKey: 'floor', cycle: 'weekly' })).toThrow(/Unknown billing cycle/);
  });
});

describe('createPaymentLinkSchema', () => {
  const ok = (v: unknown) => createPaymentLinkSchema.safeParse(v).success;

  it('accepts the quote path with nothing, with plan/cycle/launch pack, and with replaceOpen', () => {
    expect(ok({})).toBe(true);
    expect(ok({ planKey: 'floor', cycle: 'yearly', launchPack: true })).toBe(true);
    expect(ok({ replaceOpen: true })).toBe(true);
  });

  it('a typed amount needs a reason, and a reason needs a typed amount', () => {
    expect(ok({ amountRupees: 1500, overrideReason: 'Agreed on the phone' })).toBe(true);
    expect(ok({ amountRupees: 1500 })).toBe(false);
    expect(ok({ overrideReason: 'Agreed on the phone' })).toBe(false);
    expect(ok({ amountRupees: 1500, overrideReason: 'ab' })).toBe(false);
  });

  it('a typed amount cannot be mixed with plan fields (one or the other)', () => {
    expect(ok({ amountRupees: 1500, overrideReason: 'Agreed on the phone', planKey: 'floor' })).toBe(false);
    expect(ok({ amountRupees: 1500, overrideReason: 'Agreed on the phone', launchPack: true })).toBe(false);
  });

  it('rejects bad amounts, unpriced plans, unknown cycles and unknown fields (a client price is never read)', () => {
    for (const bad of [
      { amountRupees: 0, overrideReason: 'free pilot' },
      { amountRupees: -5, overrideReason: 'free pilot' },
      { amountRupees: 10.001, overrideReason: 'free pilot' },
      { amountRupees: 5_000_000, overrideReason: 'free pilot' },
      { amountRupees: '100', overrideReason: 'free pilot' },
      { planKey: 'many-doors' },
      { planKey: 'not-sure' },
      { cycle: 'weekly' },
      { totalPaise: 1 },
      { purpose: 'anything' },
    ]) {
      expect(ok(bad)).toBe(false);
    }
  });
});
