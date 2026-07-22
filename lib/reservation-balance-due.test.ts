import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  balanceDueBeforeArrivalCents,
  payableBalanceCents,
  previewStayPaymentObligations,
  summarizeReservationPaymentObligations,
  type ReservationPaymentObligations,
} from "./reservation-balance-due.ts";
import type { BillingPeriodSummary } from "./reservation-billing.ts";

function period(
  partial: Partial<BillingPeriodSummary> & Pick<BillingPeriodSummary, "periodIndex" | "dueDate">
): BillingPeriodSummary {
  return {
    id: `p-${partial.periodIndex}`,
    periodStart: partial.dueDate,
    periodEnd: partial.dueDate,
    nights: 30,
    amountDueCents: 30_000,
    amountPaidCents: 0,
    status: "unpaid",
    pricingBasis: "member_monthly_prorated",
    ...partial,
  };
}

describe("balanceDueBeforeArrivalCents", () => {
  it("uses full unpaid balance for short guest stays", () => {
    const periods = [
      period({ periodIndex: 0, dueDate: "2026-08-01", amountDueCents: 5000, amountPaidCents: 1000 }),
    ];
    assert.equal(balanceDueBeforeArrivalCents(periods, false), 4000);
  });

  it("uses only first period for long member stays", () => {
    const periods = [
      period({ periodIndex: 0, dueDate: "2026-08-01", amountDueCents: 30_000, amountPaidCents: 10_000 }),
      period({ periodIndex: 1, dueDate: "2026-08-31", amountDueCents: 30_000, amountPaidCents: 0 }),
      period({ periodIndex: 2, dueDate: "2026-09-30", amountDueCents: 30_000, amountPaidCents: 0 }),
    ];
    assert.equal(balanceDueBeforeArrivalCents(periods, true), 20_000);
  });
});

describe("payableBalanceCents", () => {
  const longStayBase = {
    checkInDate: "2026-08-01",
    checkOutDate: "2026-10-30",
    reservationType: "member",
  };

  it("allows pre-arrival payment of first-month remainder on long stays", () => {
    const periods = [
      period({ periodIndex: 0, dueDate: "2026-08-01", amountDueCents: 30_000, amountPaidCents: 10_000 }),
      period({ periodIndex: 1, dueDate: "2026-08-31", amountDueCents: 30_000 }),
    ];
    assert.equal(
      payableBalanceCents({ periods, ...longStayBase, today: "2026-07-15" }),
      20_000
    );
  });

  it("does not collect future months before their due window", () => {
    const periods = [
      period({ periodIndex: 0, dueDate: "2026-08-01", amountDueCents: 30_000, amountPaidCents: 30_000, status: "paid" }),
      period({ periodIndex: 1, dueDate: "2026-08-31", amountDueCents: 30_000 }),
    ];
    assert.equal(
      payableBalanceCents({ periods, ...longStayBase, today: "2026-07-15" }),
      0
    );
  });

  it("collects next month within 14 days of period due date", () => {
    const periods = [
      period({ periodIndex: 0, dueDate: "2026-08-01", amountDueCents: 30_000, amountPaidCents: 30_000, status: "paid" }),
      period({ periodIndex: 1, dueDate: "2026-08-31", amountDueCents: 30_000 }),
    ];
    assert.equal(
      payableBalanceCents({ periods, ...longStayBase, today: "2026-08-20" }),
      30_000
    );
  });

  it("uses full balance for short stays before arrival", () => {
    const periods = [
      period({ periodIndex: 0, dueDate: "2026-08-01", amountDueCents: 8000, amountPaidCents: 1000 }),
    ];
    assert.equal(
      payableBalanceCents({
        periods,
        checkInDate: "2026-08-01",
        checkOutDate: "2026-08-06",
        reservationType: "guest",
        today: "2026-07-20",
      }),
      7000
    );
  });
});

describe("summarizeReservationPaymentObligations", () => {
  it("reports next scheduled payment after first month is paid", () => {
    const summary: ReservationPaymentObligations = summarizeReservationPaymentObligations({
      periods: [
        period({ periodIndex: 0, dueDate: "2026-08-01", amountDueCents: 30_000, amountPaidCents: 30_000, status: "paid" }),
        period({ periodIndex: 1, dueDate: "2026-08-31", amountDueCents: 30_000 }),
      ],
      checkInDate: "2026-08-01",
      checkOutDate: "2026-10-30",
      reservationType: "member",
      today: "2026-07-15",
    });
    assert.equal(summary.isLongTermMember, true);
    assert.equal(summary.balanceDueBeforeArrivalCents, 0);
    assert.equal(summary.payableNowCents, 0);
    assert.equal(summary.nextScheduledPayment?.dueDate, "2026-08-31");
    assert.equal(summary.nextScheduledPayment?.amountCents, 30_000);
    assert.equal(summary.totalUnpaidCents, 30_000);
  });
});

describe("previewStayPaymentObligations", () => {
  it("does not require full stay collection when first month is already paid", () => {
    const preview = previewStayPaymentObligations({
      checkInDate: "2026-12-01",
      checkOutDate: "2027-05-01",
      reservationType: "member",
      rates: {
        memberRateDaily: 15,
        memberRateMonthly: 450,
        nonMemberRateDaily: 45,
      },
      netPaidCents: 51_000,
      today: "2026-07-22",
    });

    assert.equal(preview.isLongTermMember, true);
    assert.equal(preview.payableNowCents, 0);
    assert.ok(preview.scheduledRemainingCents > 0);
    assert.ok(preview.nextScheduledPayment);
    assert.equal(preview.nextScheduledPayment?.dueDate, "2026-12-31");
  });
});
