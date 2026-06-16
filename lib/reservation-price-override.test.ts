import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validatePriceOverride, scalePeriodDraftsToTotal } from "./reservation-price-override.ts";

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
});

describe("scalePeriodDraftsToTotal", () => {
  it("scales periods to target total", () => {
    const scaled = scalePeriodDraftsToTotal(
      [
        { periodIndex: 0, periodStart: "2026-01-01", periodEnd: "2026-01-31", nights: 30, amountDueCents: 6000, dueDate: "2026-01-01", pricingBasis: "monthly" },
        { periodIndex: 1, periodStart: "2026-01-31", periodEnd: "2026-02-15", nights: 15, amountDueCents: 3000, dueDate: "2026-01-31", pricingBasis: "monthly" },
      ],
      7500
    );
    assert.equal(scaled.reduce((s, d) => s + d.amountDueCents, 0), 7500);
  });
});
