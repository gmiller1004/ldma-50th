import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { periodRowToSummary } from "./reservation-billing.ts";
import { summarizeReservationPaymentObligations } from "./reservation-balance-due.ts";

describe("periodRowToSummary date normalization", () => {
  it("keeps YYYY-MM-DD when Neon returns Date objects (not weekday prefixes)", () => {
    const summary = periodRowToSummary({
      id: "p1",
      period_index: 1,
      period_start: new Date("2027-02-06T08:00:00.000Z"),
      period_end: new Date("2027-03-08T08:00:00.000Z"),
      nights: 30,
      amount_due_cents: 15000,
      amount_paid_cents: 0,
      due_date: new Date("2027-02-06T08:00:00.000Z"),
      status: "unpaid",
      pricing_basis: "member_monthly_prorated",
    });
    assert.equal(summary.dueDate, "2027-02-06");
    assert.equal(summary.periodStart, "2027-02-06");
    assert.equal(summary.periodEnd, "2027-03-08");
  });

  it("picks Feb $150 next payment, not Mar $25 stub (Carl Wolfe scenario)", () => {
    const periods = [
      periodRowToSummary({
        id: "p0",
        period_index: 0,
        period_start: new Date("2027-01-07T08:00:00.000Z"),
        period_end: new Date("2027-02-06T08:00:00.000Z"),
        nights: 30,
        amount_due_cents: 15000,
        amount_paid_cents: 15000,
        due_date: new Date("2027-01-07T08:00:00.000Z"),
        status: "paid",
        pricing_basis: "member_monthly_prorated",
      }),
      periodRowToSummary({
        id: "p1",
        period_index: 1,
        period_start: new Date("2027-02-06T08:00:00.000Z"),
        period_end: new Date("2027-03-08T08:00:00.000Z"),
        nights: 30,
        amount_due_cents: 15000,
        amount_paid_cents: 0,
        due_date: new Date("2027-02-06T08:00:00.000Z"),
        status: "unpaid",
        pricing_basis: "member_monthly_prorated",
      }),
      periodRowToSummary({
        id: "p2",
        period_index: 2,
        period_start: new Date("2027-03-08T08:00:00.000Z"),
        period_end: new Date("2027-03-13T08:00:00.000Z"),
        nights: 5,
        amount_due_cents: 2500,
        amount_paid_cents: 0,
        due_date: new Date("2027-03-08T08:00:00.000Z"),
        status: "unpaid",
        pricing_basis: "member_monthly_prorated",
      }),
    ];

    const summary = summarizeReservationPaymentObligations({
      periods,
      checkInDate: "2027-01-07",
      checkOutDate: "2027-03-13",
      reservationType: "member",
      today: "2026-07-15",
    });

    assert.equal(summary.nextScheduledPayment?.dueDate, "2027-02-06");
    assert.equal(summary.nextScheduledPayment?.amountCents, 15000);
  });
});
