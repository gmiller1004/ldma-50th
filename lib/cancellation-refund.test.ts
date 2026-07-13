import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeCancellationRefund,
  nightsStayedForCancel,
  daysUntilCheckIn,
  CANCELLATION_FEE_DAILY_CENTS,
  CANCELLATION_FEE_HOOKUP_CENTS,
} from "./cancellation-refund.ts";

const base = {
  checkInDate: "2026-06-10",
  checkOutDate: "2026-06-20",
  totalNights: 10,
  isMember: true,
  isHookupSite: false,
  memberRateDaily: 20,
  totalRefundedCents: 0,
};

describe("computeCancellationRefund", () => {
  it("full refund when cancelling 7+ days before check-in", () => {
    const r = computeCancellationRefund({
      ...base,
      cancelDate: "2026-06-01",
      totalPaidCents: 50000,
    });
    assert.equal(r.pricingMode, "full_refund");
    assert.equal(r.refundCents, 50000);
    assert.equal(r.cancellationFeeCents, 0);
  });

  it("daily stay partial refund with $25 fee before check-in", () => {
    const r = computeCancellationRefund({
      ...base,
      cancelDate: "2026-06-05",
      totalPaidCents: 20000,
    });
    assert.equal(r.pricingMode, "daily");
    assert.equal(r.nightsStayed, 0);
    assert.equal(r.earnedCents, 0);
    assert.equal(r.cancellationFeeCents, CANCELLATION_FEE_DAILY_CENTS);
    assert.equal(r.refundCents, 20000 - CANCELLATION_FEE_DAILY_CENTS);
  });

  it("monthly member mid-stay uses earned nights and hookup fee", () => {
    const r = computeCancellationRefund({
      ...base,
      checkOutDate: "2026-08-01",
      totalNights: 52,
      isHookupSite: true,
      cancelDate: "2026-06-15",
      totalPaidCents: 100000,
    });
    assert.equal(r.pricingMode, "monthly_member");
    assert.equal(r.nightsStayed, 5);
    assert.equal(r.earnedCents, 5 * 20 * 100);
    assert.equal(r.cancellationFeeCents, CANCELLATION_FEE_HOOKUP_CENTS);
    assert.equal(r.policyCancellationFeeCents, CANCELLATION_FEE_HOOKUP_CENTS);
    assert.equal(r.cancellationFeeWaived, false);
    assert.equal(r.refundCents, 100000 - r.earnedCents - CANCELLATION_FEE_HOOKUP_CENTS);
  });

  it("waives cancellation fee when caretaker opts in", () => {
    const r = computeCancellationRefund({
      ...base,
      checkOutDate: "2026-08-01",
      totalNights: 52,
      isHookupSite: true,
      cancelDate: "2026-06-15",
      totalPaidCents: 100000,
      waiveCancellationFee: true,
    });
    assert.equal(r.policyCancellationFeeCents, CANCELLATION_FEE_HOOKUP_CENTS);
    assert.equal(r.cancellationFeeCents, 0);
    assert.equal(r.cancellationFeeWaived, true);
    assert.equal(r.refundCents, 100000 - r.earnedCents);
  });

  it("caps refund at paid minus already refunded", () => {
    const r = computeCancellationRefund({
      ...base,
      cancelDate: "2026-06-01",
      totalPaidCents: 50000,
      totalRefundedCents: 20000,
    });
    assert.equal(r.refundCents, 30000);
  });

  it("guest stay always uses daily pricing mode", () => {
    const r = computeCancellationRefund({
      ...base,
      isMember: false,
      checkOutDate: "2026-08-01",
      totalNights: 52,
      cancelDate: "2026-06-15",
      totalPaidCents: 80000,
    });
    assert.equal(r.pricingMode, "daily");
  });
});

describe("nightsStayedForCancel", () => {
  it("counts nights from check-in through cancel date", () => {
    assert.equal(nightsStayedForCancel("2026-06-10", "2026-06-20", "2026-06-15"), 5);
    assert.equal(nightsStayedForCancel("2026-06-10", "2026-06-20", "2026-06-10"), 0);
  });
});

describe("daysUntilCheckIn", () => {
  it("returns days between cancel and check-in", () => {
    assert.equal(daysUntilCheckIn("2026-06-01", "2026-06-10"), 9);
    assert.equal(daysUntilCheckIn("2026-06-10", "2026-06-10"), 0);
  });
});
