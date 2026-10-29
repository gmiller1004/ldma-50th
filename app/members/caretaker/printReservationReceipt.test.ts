import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { receiptPaymentLines, type PrintableReceiptInput } from "./printReservationReceipt.ts";

function receipt(partial: Partial<PrintableReceiptInput>): PrintableReceiptInput {
  return {
    campName: "Stanton",
    partyName: "LOREN SIMMONS",
    checkInDate: "2026-11-21",
    checkOutDate: "2027-05-01",
    status: "reserved",
    billingPeriods: [],
    payments: [],
    totalDueCents: 274000,
    totalPaidCents: 0,
    balanceDueCents: 0,
    ...partial,
  };
}

const sum = (lines: ReturnType<typeof receiptPaymentLines>) =>
  lines.reduce((s, l) => s + (l.isRefund ? -l.amountCents : l.amountCents), 0);

describe("receiptPaymentLines", () => {
  it("lists the ResNexus carry-over so payments add up to total paid", () => {
    const lines = receiptPaymentLines(
      receipt({
        importedPaidCents: 51000,
        totalPaidCents: 83000,
        payments: [{ method: "card", amountCents: 32000, paymentType: "reservation", createdAt: "2026-10-23T20:19:29Z" }],
      })
    );
    assert.deepEqual(
      lines.map((l) => [l.date, l.label, l.amountCents]),
      [
        ["Prior season", "Paid through ResNexus", 51000],
        ["2026-10-23", "Card", 32000],
      ]
    );
    assert.equal(sum(lines), 83000);
  });

  it("adds no credit lines when payments already match total paid", () => {
    const lines = receiptPaymentLines(
      receipt({
        totalPaidCents: 51000,
        payments: [{ method: "cash", amountCents: 51000, paymentType: "reservation", createdAt: "2026-10-20T17:27:43Z" }],
      })
    );
    assert.equal(lines.length, 1);
  });

  it("shows a credit line for any other unlisted amount", () => {
    const lines = receiptPaymentLines(receipt({ importedPaidCents: 0, totalPaidCents: 60000 }));
    assert.deepEqual(lines.map((l) => [l.label, l.amountCents]), [["Credit applied", 60000]]);
  });

  it("nets refunds and never lists more carry-over than was paid", () => {
    const lines = receiptPaymentLines(
      receipt({
        importedPaidCents: 51000,
        totalPaidCents: 20000,
        payments: [
          { method: "card", amountCents: 51000, paymentType: "reservation", createdAt: "2026-09-16T00:00:00Z" },
          { method: "card", amountCents: 51000, paymentType: "refund", createdAt: "2026-10-27T00:00:00Z" },
        ],
      })
    );
    assert.equal(lines[0].label, "Paid through ResNexus");
    assert.equal(lines[0].amountCents, 20000);
    assert.equal(sum(lines), 20000);
  });
});
