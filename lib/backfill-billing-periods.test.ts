import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildBillingPeriodBackfill, allocatePaidWaterfall } from "./backfill-billing-periods.ts";

describe("allocatePaidWaterfall", () => {
  it("allocates across periods", () => {
    const result = allocatePaidWaterfall(
      [
        { periodIndex: 0, periodStart: "2026-01-01", periodEnd: "2026-02-01", nights: 31, amountDueCents: 50000, dueDate: "2026-01-01", pricingBasis: "member_daily" },
        { periodIndex: 1, periodStart: "2026-02-01", periodEnd: "2026-03-01", nights: 28, amountDueCents: 50000, dueDate: "2026-02-01", pricingBasis: "member_daily" },
      ],
      75000
    );
    assert.equal(result[0].status, "paid");
    assert.equal(result[1].status, "partial");
    assert.equal(result[1].amountPaidCents, 25000);
  });
});

describe("buildBillingPeriodBackfill", () => {
  it("builds periods with payment allocation", () => {
    const periods = buildBillingPeriodBackfill({
      checkInDate: "2026-06-01",
      checkOutDate: "2026-07-01",
      isMember: true,
      rates: { memberRateDaily: 20, memberRateMonthly: 540, nonMemberRateDaily: 55 },
      totalPaidCents: 60000,
    });
    assert.equal(periods.length, 1);
    assert.equal(periods[0].amountDueCents, 54000);
    assert.equal(periods[0].amountPaidCents, 54000);
    assert.equal(periods[0].status, "paid");
  });
});
