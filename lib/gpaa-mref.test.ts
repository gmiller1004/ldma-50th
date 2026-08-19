import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GPAA_REFERRAL_ALWAYS_MEMBERSHIP_PRODUCT_ID,
  cartHasMembershipForReferral,
  cartLineIsMembershipForReferral,
  gpaaMrefCookieOptions,
  nextReferralCartAttributes,
  sanitizeGpaaMref,
  shopifyNumericProductId,
} from "./gpaa-mref.ts";

describe("sanitizeGpaaMref", () => {
  it("trims, uppercases, and keeps alphanumeric codes", () => {
    assert.equal(sanitizeGpaaMref(" gregmillerfm5z "), "GREGMILLERFM5Z");
    assert.equal(sanitizeGpaaMref("TESTCODE"), "TESTCODE");
    assert.equal(sanitizeGpaaMref("Ab1"), "AB1");
  });

  it("rejects invalid values", () => {
    assert.equal(sanitizeGpaaMref(null), null);
    assert.equal(sanitizeGpaaMref(""), null);
    assert.equal(sanitizeGpaaMref("  "), null);
    assert.equal(sanitizeGpaaMref("ab"), null);
    assert.equal(sanitizeGpaaMref("A".repeat(33)), null);
    assert.equal(sanitizeGpaaMref("GREG-MILLER"), null);
    assert.equal(sanitizeGpaaMref("TEST CODE"), null);
    assert.equal(sanitizeGpaaMref("ref!"), null);
  });
});

describe("shopifyNumericProductId", () => {
  it("parses GIDs and numeric ids", () => {
    assert.equal(
      shopifyNumericProductId(`gid://shopify/Product/${GPAA_REFERRAL_ALWAYS_MEMBERSHIP_PRODUCT_ID}`),
      GPAA_REFERRAL_ALWAYS_MEMBERSHIP_PRODUCT_ID
    );
    assert.equal(
      shopifyNumericProductId(GPAA_REFERRAL_ALWAYS_MEMBERSHIP_PRODUCT_ID),
      GPAA_REFERRAL_ALWAYS_MEMBERSHIP_PRODUCT_ID
    );
    assert.equal(shopifyNumericProductId("gid://shopify/ProductVariant/1"), null);
  });
});

describe("cartLineIsMembershipForReferral", () => {
  it("matches the membership collection handle", () => {
    assert.equal(
      cartLineIsMembershipForReferral({
        merchandise: {
          product: {
            id: "gid://shopify/Product/1",
            collections: { edges: [{ node: { handle: "membership" } }] },
          },
        },
      }),
      true
    );
  });

  it("matches memberships plural as a fallback handle", () => {
    assert.equal(
      cartLineIsMembershipForReferral({
        merchandise: {
          product: {
            id: "gid://shopify/Product/1",
            collections: { edges: [{ node: { handle: "memberships" } }] },
          },
        },
      }),
      true
    );
  });

  it("matches the Axiom Lite dual Lifetime product even without collections", () => {
    assert.equal(
      cartLineIsMembershipForReferral({
        merchandise: {
          product: {
            id: `gid://shopify/Product/${GPAA_REFERRAL_ALWAYS_MEMBERSHIP_PRODUCT_ID}`,
          },
        },
      }),
      true
    );
  });

  it("does not match merch-only lines", () => {
    assert.equal(
      cartLineIsMembershipForReferral({
        merchandise: {
          product: {
            id: "gid://shopify/Product/9",
            collections: { edges: [{ node: { handle: "merch" } }] },
          },
        },
      }),
      false
    );
    assert.equal(cartHasMembershipForReferral([]), false);
  });
});

describe("nextReferralCartAttributes", () => {
  it("sets referral_code on membership carts and keeps other attributes", () => {
    const result = nextReferralCartAttributes(
      [{ key: "source", value: "web" }],
      "TESTCODE",
      true
    );
    assert.equal(result.changed, true);
    assert.deepEqual(result.attributes, [
      { key: "source", value: "web" },
      { key: "referral_code", value: "TESTCODE" },
    ]);
  });

  it("clears referral_code when the cart is no longer membership", () => {
    const result = nextReferralCartAttributes(
      [{ key: "referral_code", value: "TESTCODE" }, { key: "source", value: "web" }],
      "TESTCODE",
      false
    );
    assert.equal(result.changed, true);
    assert.deepEqual(result.attributes, [
      { key: "source", value: "web" },
      { key: "referral_code", value: "" },
    ]);
  });

  it("is a no-op when the value is already correct", () => {
    const result = nextReferralCartAttributes(
      [{ key: "referral_code", value: "TESTCODE" }],
      "TESTCODE",
      true
    );
    assert.equal(result.changed, false);
  });
});

describe("gpaaMrefCookieOptions", () => {
  it("sets the apex domain on myldma.com hosts", () => {
    assert.equal(gpaaMrefCookieOptions("www.myldma.com").domain, ".myldma.com");
    assert.equal(gpaaMrefCookieOptions("myldma.com:443").domain, ".myldma.com");
  });

  it("omits Domain on localhost", () => {
    assert.equal("domain" in gpaaMrefCookieOptions("localhost"), false);
  });
});
