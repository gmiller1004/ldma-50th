import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { suggestedReservationPaymentCents } from "./reservation-billing.ts";

describe("suggestedReservationPaymentCents", () => {
  it("suggests remaining on first unpaid period", () => {
    const cents = suggestedReservationPaymentCents(
      [
        { status: "partial", amountDueCents: 54000, amountPaidCents: 20000 },
        { status: "unpaid", amountDueCents: 54000, amountPaidCents: 0 },
      ],
      88000
    );
    assert.equal(cents, 34000);
  });

  it("falls back to full balance when no periods", () => {
    assert.equal(suggestedReservationPaymentCents([], 15000), 15000);
  });
});
