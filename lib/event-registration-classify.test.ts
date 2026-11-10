import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyEventRegistration } from "./event-registration-classify.ts";
import { eventVariantPricingType } from "./events-config.ts";

describe("eventVariantPricingType", () => {
  it("recognizes member, general, deposit, and unset levels", () => {
    assert.equal(eventVariantPricingType("member"), "member");
    assert.equal(eventVariantPricingType("Non Member"), "general");
    assert.equal(eventVariantPricingType("non-member"), "general");
    assert.equal(eventVariantPricingType("deposit"), "deposit");
    assert.equal(eventVariantPricingType(""), "unset");
    assert.equal(eventVariantPricingType(null), "unset");
  });
});

describe("classifyEventRegistration", () => {
  it("counts reservation deposits as LDMA registrations", () => {
    assert.equal(
      classifyEventRegistration({ variantTitle: "New Member Reservation Deposit", priceLevelMetafield: "deposit" }),
      "LDMA"
    );
  });

  it("uses the price level before the title", () => {
    assert.equal(classifyEventRegistration({ variantTitle: "General Registration", priceLevelMetafield: "member" }), "LDMA");
    assert.equal(
      classifyEventRegistration({ variantTitle: "LDMA Member Registration", priceLevelMetafield: "non member" }),
      "NON_LDMA"
    );
  });

  it("falls back to title heuristics without a price level", () => {
    assert.equal(classifyEventRegistration({ variantTitle: "LDMA Member Registration" }), "LDMA");
    assert.equal(classifyEventRegistration({ variantTitle: "Non-LDMA (General Admission) - Dry Site" }), "NON_LDMA");
    assert.equal(classifyEventRegistration({ variantTitle: "Default Title" }), null);
  });
});
