import { describe, expect, it } from 'vitest';
import { FOUNDING, GST_PERCENT, LAUNCH_PACK_PAISE, PLAN_PRICES, PRICED_PLAN_KEYS, quotePlan } from '@nexus/shared';
import { FOUNDING_OFFER, GST_PERCENT as LANDING_GST, LAUNCH_PACK_PRICE, PRICED_PLANS, gstInclusiveExact } from './plans';

/**
 * The landing page shows prices and the payment link is priced from the shared catalog. If they ever differ, an owner
 * would be charged something other than what the page promised, so this test fails the build instead.
 */
describe('landing prices match the billing catalog the payment links use', () => {
  it('covers exactly the plans that have a public price', () => {
    expect(PRICED_PLANS.map((p) => p.key).sort()).toEqual([...PRICED_PLAN_KEYS].sort());
  });

  for (const key of PRICED_PLAN_KEYS) {
    it(`${key}: name, monthly, yearly and Founding yearly agree (rupees on the page, paise in the catalog)`, () => {
      const page = PRICED_PLANS.find((p) => p.key === key)!;
      const catalog = PLAN_PRICES[key];
      expect(page.name).toBe(catalog.name);
      expect(page.monthly! * 100).toBe(catalog.monthlyPaise);
      expect(page.yearly! * 100).toBe(catalog.yearlyPaise);
      expect(page.foundingYearly! * 100).toBe(catalog.foundingYearlyPaise);
    });

    it(`${key}: the "incl. GST" figure on the page equals what the payment link charges`, () => {
      const page = PRICED_PLANS.find((p) => p.key === key)!;
      const after = new Date('2027-06-01T10:00:00+05:30'); // outside the Founding window: plain list prices
      const founding = new Date('2026-12-01T10:00:00+05:30');
      expect(quotePlan({ planKey: key, cycle: 'monthly', offerDate: after }).totalPaise).toBe(Math.round(gstInclusiveExact(page.monthly!) * 100));
      expect(quotePlan({ planKey: key, cycle: 'yearly', offerDate: after }).totalPaise).toBe(Math.round(gstInclusiveExact(page.yearly!) * 100));
      expect(quotePlan({ planKey: key, cycle: 'yearly', offerDate: founding }).totalPaise).toBe(Math.round(gstInclusiveExact(page.foundingYearly!) * 100));
    });
  }

  it('GST rate, Launch Pack price and the Founding window agree', () => {
    expect(LANDING_GST).toBe(GST_PERCENT);
    expect(LAUNCH_PACK_PRICE * 100).toBe(LAUNCH_PACK_PAISE);
    expect(FOUNDING_OFFER.opensOn).toBe(FOUNDING.opensOn);
    expect(FOUNDING_OFFER.closesAt).toBe(FOUNDING.closesAt);
    expect(FOUNDING_OFFER.discountPercent).toBe(FOUNDING.discountPercent);
  });
});
