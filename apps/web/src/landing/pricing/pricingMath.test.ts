import { describe, expect, it } from 'vitest';
import { FOUNDING_OFFER, PLANS, getPlan, gstInclusiveExact, isFoundingOfferOpen } from '../content';
import {
  foundingAwareText,
  foundingEyebrow,
  foundingState,
  foundingWindowLabel,
  priceLabel,
  priceView,
  visibleFeatures,
  withGst,
} from './pricingMath';

const counter = getPlan('counter');
const floor = getPlan('floor');
const pass = getPlan('pass');
const manyDoors = getPlan('many-doors');
const ex = { inclusive: false, founding: false } as const;

describe('priceView: ex-GST', () => {
  it('monthly prices are the published ones', () => {
    expect(priceView(counter, 'monthly', ex)).toMatchObject({ amount: 599, unit: 'month', listAmount: null, perMonth: null, saving: null });
    expect(priceView(floor, 'monthly', ex)?.amount).toBe(1299);
    expect(priceView(pass, 'monthly', ex)?.amount).toBe(2499);
  });

  it('yearly prices carry the published per-month figure and the saving against 12 monthly payments', () => {
    expect(priceView(counter, 'yearly', ex)).toMatchObject({ amount: 5990, unit: 'year', perMonth: 499, saving: 1198, listAmount: null });
    expect(priceView(floor, 'yearly', ex)).toMatchObject({ amount: 12990, perMonth: 1082, saving: 2598 });
    expect(priceView(pass, 'yearly', ex)).toMatchObject({ amount: 24990, perMonth: 2083, saving: 4998 });
  });

  it('yearly = 10 months paid (the “2 months free” claim is arithmetically true)', () => {
    for (const plan of [counter, floor, pass]) {
      expect(plan.yearly).toBe((plan.monthly ?? 0) * 10);
    }
  });

  it('Many Doors has no price', () => {
    expect(priceView(manyDoors, 'monthly', ex)).toBeNull();
    expect(priceView(manyDoors, 'yearly', { inclusive: true, founding: true })).toBeNull();
  });
});

describe('priceView: GST-inclusive rounding (to the paisa, as invoiced)', () => {
  const inc = { inclusive: true, founding: false } as const;

  it('uses exact paise, matching the 03b reference table', () => {
    expect(priceView(counter, 'monthly', inc)?.amount).toBe(706.82);
    expect(priceView(floor, 'monthly', inc)?.amount).toBe(1532.82);
    expect(priceView(pass, 'monthly', inc)?.amount).toBe(2948.82);
    expect(priceView(counter, 'yearly', inc)?.amount).toBe(7068.2);
    expect(priceView(floor, 'yearly', inc)?.amount).toBe(15328.2);
    expect(priceView(pass, 'yearly', inc)?.amount).toBe(29488.2);
  });

  it('withGst is the identity when GST is shown separately', () => {
    expect(withGst(599, false)).toBe(599);
    expect(withGst(599, true)).toBe(gstInclusiveExact(599));
  });

  it('inclusive per-month and saving figures are consistent with the inclusive amounts', () => {
    const view = priceView(counter, 'yearly', inc);
    expect(view?.perMonth).toBe(Math.round(7068.2 / 12));
    expect(view?.saving).toBe(gstInclusiveExact(1198));
  });

  it('otherMode is the price in the opposite GST mode', () => {
    expect(priceView(floor, 'monthly', ex)?.otherMode).toBe(1532.82);
    expect(priceView(floor, 'monthly', inc)?.otherMode).toBe(1299);
  });
});

describe('priceView: Founding Restaurants', () => {
  it('shows the founding first-year price against the crossed-out list price (yearly only)', () => {
    const founding = { inclusive: false, founding: true } as const;
    expect(priceView(floor, 'yearly', founding)).toMatchObject({ amount: 9740, listAmount: 12990, perMonth: 812 });
    expect(priceView(counter, 'yearly', founding)).toMatchObject({ amount: 4490, listAmount: 5990 });
    expect(priceView(pass, 'yearly', founding)).toMatchObject({ amount: 18740, listAmount: 24990 });
    // monthly plans are not discounted
    expect(priceView(floor, 'monthly', founding)).toMatchObject({ amount: 1299, listAmount: null });
  });

  it('matches the 03b inclusive founding column', () => {
    expect(priceView(counter, 'yearly', { inclusive: true, founding: true })?.amount).toBe(5298.2);
    expect(priceView(floor, 'yearly', { inclusive: true, founding: true })?.amount).toBe(11493.2);
    expect(priceView(pass, 'yearly', { inclusive: true, founding: true })?.amount).toBe(22113.2);
  });
});

describe('priceLabel (screen readers)', () => {
  it('reads the ex-GST price in words', () => {
    const view = priceView(floor, 'yearly', ex);
    expect(view && priceLabel(view, false)).toBe('twelve thousand nine hundred ninety rupees per year plus GST');
  });
  it('reads the inclusive price with paise', () => {
    const view = priceView(counter, 'monthly', { inclusive: true, founding: false });
    expect(view && priceLabel(view, true)).toBe('seven hundred six rupees and 82 paise per month including 18 percent GST');
  });
});

describe('Founding window (IST)', () => {
  it('is upcoming before 1 Nov 2026 00:00 IST, open until 31 Jan 2027 23:59 IST, then closed', () => {
    expect(foundingState(new Date('2026-10-31T10:00:00+05:30'))).toBe('upcoming');
    expect(foundingState(new Date('2026-10-31T23:59:59+05:30'))).toBe('upcoming');
    expect(foundingState(new Date('2026-11-01T00:00:00+05:30'))).toBe('open');
    expect(foundingState(new Date('2027-01-31T12:00:00+05:30'))).toBe('open');
    expect(foundingState(new Date('2027-01-31T23:59:00+05:30'))).toBe('open');
    expect(foundingState(new Date('2027-01-31T23:59:30+05:30'))).toBe('closed');
    expect(foundingState(new Date('2027-02-01T00:00:00+05:30'))).toBe('closed');
  });

  it('agrees with the content helper', () => {
    for (const iso of ['2026-10-31T10:00:00+05:30', '2026-12-25T10:00:00+05:30', '2027-03-01T10:00:00+05:30']) {
      expect(foundingState(new Date(iso)) === 'open').toBe(isFoundingOfferOpen(new Date(iso)));
    }
  });

  it('states the exact window from the content dates', () => {
    expect(foundingWindowLabel()).toBe('1 Nov 2026 – 31 Jan 2027, 11:59 pm IST');
    expect(foundingEyebrow('open')).toBe(FOUNDING_OFFER.eyebrow);
    expect(foundingEyebrow('upcoming')).toBe('FOUNDING RESTAURANTS · OPENS 1 NOV 2026');
  });

  it('drops founding-only wording once the window has closed, and nothing before', () => {
    const fine = '14-day money-back guarantee · Prices exclude 18% GST · Founding Restaurants offer until 31 Jan 2027.';
    expect(foundingAwareText(fine, 'open')).toBe(fine);
    expect(foundingAwareText(fine, 'upcoming')).toBe(fine);
    expect(foundingAwareText(fine, 'closed')).toBe('14-day money-back guarantee · Prices exclude 18% GST.');
    expect(foundingAwareText('Included with Pass and for Founding Restaurants.', 'closed')).toBe('Included with Pass.');
    const lines = visibleFeatures(pass, 'closed');
    expect(lines.some((l) => /founding/i.test(l))).toBe(false);
    expect(visibleFeatures(pass, 'open').some((l) => /founding/i.test(l))).toBe(true);
  });
});

describe('content sanity the pricing UI relies on', () => {
  it('has three priced plans, one enquiry plan and exactly one highlighted card', () => {
    expect(PLANS.map((p) => p.key)).toEqual(['counter', 'floor', 'pass', 'many-doors']);
    expect(PLANS.filter((p) => p.highlight)).toHaveLength(1);
    expect(PLANS.filter((p) => p.enquiryOnly)).toHaveLength(1);
  });
});
