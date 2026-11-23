import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ACADEMY_DISCOUNT_CODE,
  parseAcademyDiscount,
  qualifiesForAcademyDiscount,
  academyDiscountKlaviyoProperties,
} from "./detector-academy-discount.ts";

const base = {
  firstName: "Pat",
  lastName: "Prospector",
  email: "Pat@Example.com",
  membership: "ldma",
  qualifier: "military",
  bringDetector: "axiom_lite",
  experience: "some",
  heardAbout: "facebook",
  camping: "yes",
};

describe("parseAcademyDiscount", () => {
  it("accepts a full application and lowercases email", () => {
    const r = parseAcademyDiscount(base);
    assert.ok(r.ok);
    assert.equal(r.value.email, "pat@example.com");
    assert.equal(r.value.qualifier, "military");
    assert.equal(qualifiesForAcademyDiscount(r.value), true);
  });

  it("qualifies members even without a service/profession tag", () => {
    const r = parseAcademyDiscount({ ...base, membership: "gpaa", qualifier: "none" });
    assert.ok(r.ok);
    assert.equal(qualifiesForAcademyDiscount(r.value), true);
  });

  it("does not qualify without membership or a service/profession tag", () => {
    const r = parseAcademyDiscount({ ...base, membership: "none", qualifier: "none" });
    assert.ok(r.ok);
    assert.equal(qualifiesForAcademyDiscount(r.value), false);
  });

  it("rejects bad email or missing answers", () => {
    assert.equal(parseAcademyDiscount({ ...base, email: "nope" }).ok, false);
    assert.equal(parseAcademyDiscount({ ...base, firstName: " " }).ok, false);
    assert.equal(parseAcademyDiscount({ ...base, membership: "vip" }).ok, false);
  });

  it("exposes discount code and labels for Klaviyo", () => {
    const r = parseAcademyDiscount(base);
    assert.ok(r.ok);
    const props = academyDiscountKlaviyoProperties(r.value);
    assert.equal(props.academy_discount_code, ACADEMY_DISCOUNT_CODE);
    assert.equal(props.academy_discount_qualifies, true);
    assert.match(String(props.academy_qualifier_label), /Military/);
  });
});
