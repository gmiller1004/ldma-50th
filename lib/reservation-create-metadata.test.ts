import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveCreateReservationPricing } from "./reservation-create-metadata.ts";

describe("resolveCreateReservationPricing", () => {
  it("partial payment keeps full stay total without override flag", () => {
    const r = resolveCreateReservationPricing(300000, {
      paymentAmountDollars: "500",
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.stayTotalCents, 300000);
    assert.equal(r.collectCents, 50000);
    assert.equal(r.balanceAfterCents, 250000);
    assert.equal(r.fields.amountCents, 50000);
    assert.equal(r.fields.amountOverrideCents, undefined);
  });

  it("stay total override is separate from partial payment", () => {
    const r = resolveCreateReservationPricing(300000, {
      stayTotalOverrideDollars: "2500",
      overrideReason: "Negotiated rate",
      paymentAmountDollars: "500",
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.stayTotalCents, 250000);
    assert.equal(r.collectCents, 50000);
    assert.equal(r.balanceAfterCents, 200000);
    assert.equal(r.fields.amountOverrideCents, 250000);
    assert.equal(r.fields.overrideReason, "Negotiated rate");
  });

  it("blank payment collects the full stay total by default (card checkout)", () => {
    const r = resolveCreateReservationPricing(300000, { paymentAmountDollars: "" });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.collectCents, 300000);
    assert.equal(r.balanceAfterCents, 0);
  });

  it("blank payment collects nothing when blankPaymentMeans is zero (cash / pay on arrival)", () => {
    const r = resolveCreateReservationPricing(300000, { paymentAmountDollars: "  ", blankPaymentMeans: "zero" });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.collectCents, 0);
    assert.equal(r.balanceAfterCents, 300000);
    assert.equal(r.fields.amountCents, 0);
  });
});
