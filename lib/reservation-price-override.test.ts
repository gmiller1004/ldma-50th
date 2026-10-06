import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validatePriceOverride, fitPeriodDraftsToTotal } from "./reservation-price-override.ts";
import { generateBillingPeriods } from "./reservation-pricing.ts";

describe("validatePriceOverride", () => {
  it("allows partial payment without override", () => {
    const r = validatePriceOverride({
      calculatedTotalCents: 10000,
      paymentAmountCents: 5000,
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.result.priceOverrideFlag, false);
      assert.equal(r.result.effectiveTotalCents, 10000);
    }
  });

  it("requires reason when override total differs", () => {
    const r = validatePriceOverride({
      calculatedTotalCents: 10000,
      amountOverrideCents: 7500,
      paymentAmountCents: 7500,
    });
    assert.equal(r.ok, false);
  });

  it("accepts override with reason", () => {
    const r = validatePriceOverride({
      calculatedTotalCents: 10000,
      amountOverrideCents: 7500,
      overrideReason: "Caretaker comp",
      paymentAmountCents: 7500,
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.result.priceOverrideFlag, true);
      assert.equal(r.result.effectiveTotalCents, 7500);
    }
  });

  it("rejects $0 payment unless allowZeroPayment (cash pay on arrival)", () => {
    assert.equal(validatePriceOverride({ calculatedTotalCents: 10000, paymentAmountCents: 0 }).ok, false);
    assert.equal(
      validatePriceOverride({ calculatedTotalCents: 10000, paymentAmountCents: 0, allowZeroPayment: true }).ok,
      true
    );
    assert.equal(
      validatePriceOverride({
        calculatedTotalCents: 10000,
        amountOverrideCents: 7500,
        overrideReason: "Long stay rate",
        paymentAmountCents: 0,
        allowZeroPayment: true,
      }).ok,
      true
    );
    assert.equal(
      validatePriceOverride({ calculatedTotalCents: 10000, paymentAmountCents: -100, allowZeroPayment: true }).ok,
      false
    );
  });
});

describe("fitPeriodDraftsToTotal", () => {
  const member = (checkInDate: string, checkOutDate: string, monthly: number, daily: number) =>
    generateBillingPeriods({
      checkInDate,
      checkOutDate,
      isMember: true,
      rates: { memberRateMonthly: monthly, memberRateDaily: daily, nonMemberRateDaily: null },
    });
  const amounts = (drafts: { amountDueCents: number }[]) => drafts.map((d) => d.amountDueCents);
  const total = (drafts: { amountDueCents: number }[]) => drafts.reduce((s, d) => s + d.amountDueCents, 0);

  it("flat monthly deal: even months, final nights free and folded into the last month", () => {
    const fitted = fitPeriodDraftsToTotal(member("2026-10-01", "2027-05-31", 540, 21), 432000);
    assert.deepEqual(amounts(fitted), Array(8).fill(54000));
    assert.equal(fitted[fitted.length - 1].periodEnd, "2027-05-31");
    assert.equal(fitted.reduce((s, d) => s + d.nights, 0), 242);
    assert.deepEqual(fitted.map((d) => d.periodIndex), [0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("standard months plus an agreed partial-period amount", () => {
    const fitted = fitPeriodDraftsToTotal(member("2026-11-15", "2027-06-01", 510, 19), 336400);
    assert.deepEqual(amounts(fitted), [...Array(6).fill(51000), 30400]);
  });

  it("discount that doesn't divide evenly: whole-dollar months, cents on the last month", () => {
    const fitted = fitPeriodDraftsToTotal(member("2026-10-01", "2027-05-31", 540, 21), 430650);
    assert.equal(total(fitted), 430650);
    assert.deepEqual(amounts(fitted).slice(0, 7), Array(7).fill(53800));
    assert.equal(fitted.length, 8);
  });

  it("single-month rate lock covers the extra night", () => {
    const fitted = fitPeriodDraftsToTotal(member("2026-10-15", "2026-11-16", 540, 21), 56000);
    assert.deepEqual(amounts(fitted), [56000]);
    assert.equal(fitted[0].nights, 32);
  });

  it("short stay takes the special total directly", () => {
    const fitted = fitPeriodDraftsToTotal(member("2026-10-01", "2026-10-11", 540, 21), 15000);
    assert.deepEqual(amounts(fitted), [15000]);
  });

  it("comp zeroes every period", () => {
    const fitted = fitPeriodDraftsToTotal(member("2026-10-01", "2027-05-31", 540, 21), 0);
    assert.equal(total(fitted), 0);
    assert.equal(fitted.length, 8);
  });

  it("guest monthly rate lock collapses to one period", () => {
    const drafts = generateBillingPeriods({
      checkInDate: "2026-10-01",
      checkOutDate: "2026-11-01",
      isMember: false,
      rates: { memberRateMonthly: null, memberRateDaily: null, nonMemberRateDaily: 6 },
    });
    assert.deepEqual(amounts(fitPeriodDraftsToTotal(drafts, 15000)), [15000]);
  });
});
