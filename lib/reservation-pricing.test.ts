import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeStayPricing,
  generateBillingPeriods,
  MEMBER_DAILY_MAX_NIGHTS,
  BILLING_PERIOD_DAYS,
} from "./reservation-pricing.ts";

const rates = {
  memberRateDaily: 20,
  memberRateMonthly: 540,
  nonMemberRateDaily: 55,
};

describe("computeStayPricing", () => {
  it("member 29 nights uses daily", () => {
    const r = computeStayPricing({
      checkInDate: "2026-06-01",
      checkOutDate: "2026-06-30",
      isMember: true,
      rates,
    });
    assert.equal(r.totalNights, 29);
    assert.equal(r.pricingBasis, "member_daily");
    assert.equal(r.totalCents, 29 * 20 * 100);
  });

  it("member 30 nights uses monthly prorated", () => {
    const r = computeStayPricing({
      checkInDate: "2026-06-01",
      checkOutDate: "2026-07-01",
      isMember: true,
      rates,
    });
    assert.equal(r.totalNights, 30);
    assert.equal(r.pricingBasis, "member_monthly_prorated");
    assert.equal(r.totalCents, 540 * 100);
  });

  it("member 45 nights uses monthly prorated 1.5x", () => {
    const r = computeStayPricing({
      checkInDate: "2026-06-09",
      checkOutDate: "2026-07-24",
      isMember: true,
      rates,
    });
    assert.equal(r.totalNights, 45);
    assert.equal(r.totalCents, Math.round(540 * (45 / 30) * 100));
  });

  it("guest 60 nights uses daily only", () => {
    const r = computeStayPricing({
      checkInDate: "2026-06-01",
      checkOutDate: "2026-07-31",
      isMember: false,
      rates,
    });
    assert.equal(r.pricingBasis, "guest_daily");
    assert.equal(r.totalCents, 60 * 55 * 100);
  });

  it("threshold constants", () => {
    assert.equal(MEMBER_DAILY_MAX_NIGHTS, 29);
    assert.equal(BILLING_PERIOD_DAYS, 30);
  });
});

describe("generateBillingPeriods", () => {
  it("member 45 nights splits into 30 + 15 with correct sum", () => {
    const periods = generateBillingPeriods({
      checkInDate: "2026-06-09",
      checkOutDate: "2026-07-24",
      isMember: true,
      rates,
    });
    assert.equal(periods.length, 2);
    assert.equal(periods[0].nights, 30);
    assert.equal(periods[0].amountDueCents, 54000);
    assert.equal(periods[1].nights, 15);
    const sum = periods.reduce((s, p) => s + p.amountDueCents, 0);
    const expected = computeStayPricing({
      checkInDate: "2026-06-09",
      checkOutDate: "2026-07-24",
      isMember: true,
      rates,
    }).totalCents;
    assert.equal(sum, expected);
  });

  it("member 29 nights is a single period", () => {
    const periods = generateBillingPeriods({
      checkInDate: "2026-06-01",
      checkOutDate: "2026-06-30",
      isMember: true,
      rates,
    });
    assert.equal(periods.length, 1);
    assert.equal(periods[0].pricingBasis, "member_daily");
    assert.equal(periods[0].amountDueCents, 29 * 20 * 100);
  });

  it("guest 45 nights splits daily per period", () => {
    const periods = generateBillingPeriods({
      checkInDate: "2026-06-09",
      checkOutDate: "2026-07-24",
      isMember: false,
      rates,
    });
    assert.equal(periods.length, 2);
    assert.equal(periods[0].amountDueCents, 30 * 55 * 100);
    assert.equal(periods[1].amountDueCents, 15 * 55 * 100);
  });
});
