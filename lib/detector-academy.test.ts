import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AXIOM_LITE_BUNDLE_PRODUCT_ID,
  DETECTOR_ACADEMY_DEPOSIT_VARIANT_ID,
  academyReservationStatus,
  isAcademyPromoOpen,
  isWithinAcademyPromoWindow,
  type ShopifyOrderSummary,
} from "./detector-academy.ts";

function order(partial: Partial<ShopifyOrderSummary>): ShopifyOrderSummary {
  return { createdAt: "2026-11-15T18:00:00Z", cancelled: false, financialStatus: "PAID", productIds: [], variantIds: [], ...partial };
}

const bundle = { productIds: [AXIOM_LITE_BUNDLE_PRODUCT_ID] };

describe("isWithinAcademyPromoWindow", () => {
  it("includes Nov 2 through Dec 31, 2026 Pacific", () => {
    assert.equal(isWithinAcademyPromoWindow("2026-11-02T08:00:00Z"), true);
    assert.equal(isWithinAcademyPromoWindow("2027-01-01T07:59:59Z"), true);
    assert.equal(isWithinAcademyPromoWindow("2026-11-02T07:59:59Z"), false);
    assert.equal(isWithinAcademyPromoWindow("2027-01-01T08:00:00Z"), false);
  });

  it("closes the promo after Dec 31", () => {
    assert.equal(isAcademyPromoOpen(new Date("2026-12-31T20:00:00-08:00")), true);
    assert.equal(isAcademyPromoOpen(new Date("2027-01-01T00:00:01-08:00")), false);
  });
});

describe("academyReservationStatus", () => {
  it("is eligible with a paid bundle order in the window", () => {
    assert.deepEqual(academyReservationStatus([order(bundle)]), { state: "eligible" });
  });

  it("ignores bundle orders outside the window, cancelled, or unpaid", () => {
    assert.deepEqual(academyReservationStatus([order({ ...bundle, createdAt: "2026-10-20T18:00:00Z" })]), {
      state: "no_bundle_order",
    });
    assert.deepEqual(academyReservationStatus([order({ ...bundle, cancelled: true })]), { state: "no_bundle_order" });
    assert.deepEqual(academyReservationStatus([order({ ...bundle, financialStatus: "PENDING" })]), {
      state: "no_bundle_order",
    });
    assert.deepEqual(academyReservationStatus([order({ ...bundle, financialStatus: "REFUNDED" })]), {
      state: "no_bundle_order",
    });
  });

  it("reports an existing deposit", () => {
    assert.deepEqual(
      academyReservationStatus([order(bundle), order({ variantIds: [DETECTOR_ACADEMY_DEPOSIT_VARIANT_ID] })]),
      { state: "already_reserved" }
    );
  });
});
