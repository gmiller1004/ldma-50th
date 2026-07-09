import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { memberQualifiesForCampBooking } from "./reservation-member.ts";

describe("memberQualifiesForCampBooking", () => {
  it("allows active LDMA members including Is_New_LDMA_Member__c", () => {
    assert.equal(
      memberQualifiesForCampBooking({
        valid: true,
        active: true,
      }),
      true
    );
  });

  it("rejects inactive contacts", () => {
    assert.equal(
      memberQualifiesForCampBooking({
        valid: true,
        active: false,
      }),
      false
    );
  });
});
