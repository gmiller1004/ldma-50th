import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  amountDueAtArrivalCents,
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

describe("calendar_month billing", () => {
  const stanton30a = { memberRateDaily: 19, memberRateMonthly: 510, nonMemberRateDaily: 45 };
  const calendar = (checkInDate: string, checkOutDate: string, r = stanton30a, isMember = true) =>
    generateBillingPeriods({ checkInDate, checkOutDate, isMember, rates: r, billingMode: "calendar_month" });
  const amounts = (ps: { amountDueCents: number }[]) => ps.map((p) => p.amountDueCents);

  it("mid-month arrival: arrival month at daily rate, then whole months due on the 1st", () => {
    const ps = calendar("2026-10-08", "2027-05-01");
    assert.deepEqual(amounts(ps), [24 * 1900, ...Array(6).fill(51000)]);
    assert.deepEqual(
      ps.map((p) => p.dueDate),
      ["2026-10-08", "2026-11-01", "2026-12-01", "2027-01-01", "2027-02-01", "2027-03-01", "2027-04-01"]
    );
    assert.equal(ps[0].periodEnd, "2026-11-01");
    assert.equal(ps[0].fullMonth, false);
    assert.equal(ps[1].fullMonth, true);
    const total = computeStayPricing({
      checkInDate: "2026-10-08",
      checkOutDate: "2027-05-01",
      isMember: true,
      rates: stanton30a,
      billingMode: "calendar_month",
    }).totalCents;
    assert.equal(total, 24 * 1900 + 6 * 51000);
  });

  it("partial month is capped at the monthly rate", () => {
    const ps = calendar("2026-10-04", "2027-01-01");
    assert.equal(ps[0].nights, 28);
    assert.equal(ps[0].amountDueCents, 51000);
  });

  it("final partial month at the daily rate", () => {
    const ps = calendar("2026-10-01", "2027-04-02", { memberRateDaily: 14, memberRateMonthly: 340, nonMemberRateDaily: 30 });
    assert.deepEqual(amounts(ps), [...Array(6).fill(34000), 1400]);
    assert.equal(ps[6].dueDate, "2027-04-01");
  });

  it("February is a whole month", () => {
    const ps = calendar("2026-11-01", "2027-03-01");
    assert.deepEqual(amounts(ps), Array(4).fill(51000));
    assert.equal(ps[3].nights, 28);
    assert.equal(ps[3].fullMonth, true);
  });

  it("late-month arrival: first whole month is due at arrival too", () => {
    const ps = calendar("2026-10-25", "2027-03-01");
    assert.equal(ps[0].nights, 7);
    assert.equal(ps[1].dueDate, "2026-10-25");
    assert.equal(ps[2].dueDate, "2026-12-01");
    assert.equal(amountDueAtArrivalCents(ps), 7 * 1900 + 51000);
  });

  it("arrival with more than 7 nights left keeps the 1st as the next due date", () => {
    const ps = calendar("2026-10-24", "2027-03-01");
    assert.equal(ps[1].dueDate, "2026-11-01");
    assert.equal(amountDueAtArrivalCents(ps), 8 * 1900);
  });

  it("stay without a whole calendar month falls back to 30-day billing", () => {
    const ps = calendar("2026-10-15", "2026-11-15");
    assert.deepEqual(amounts(ps), [51000, 1700]);
    assert.equal(ps[0].nights, 30);
  });

  it("guests and short member stays are unchanged", () => {
    assert.deepEqual(amounts(calendar("2026-10-08", "2027-01-01", stanton30a, false)), [
      30 * 4500,
      30 * 4500,
      25 * 4500,
    ]);
    assert.deepEqual(amounts(calendar("2026-10-01", "2026-10-21")), [20 * 1900]);
  });

  it("default mode stays on rolling 30-day periods", () => {
    const ps = generateBillingPeriods({
      checkInDate: "2026-10-08",
      checkOutDate: "2027-05-01",
      isMember: true,
      rates: stanton30a,
    });
    assert.equal(ps[0].nights, 30);
    assert.equal(ps[0].periodEnd, "2026-11-07");
  });
});
