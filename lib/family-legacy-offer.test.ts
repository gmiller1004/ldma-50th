import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildFamilyLegacyTaskDescription,
  describeLegacyCheckboxes,
  familyLegacyEligibility,
  isLegacyPaidPendingAddendum,
  parseFamilyLegacyIntake,
} from "./family-legacy-offer.ts";

const active = { active: true, accessRole: "primary" as const };

describe("familyLegacyEligibility", () => {
  it("offers the package to any active primary member, whatever Salesforce shows they have", () => {
    assert.deepEqual(familyLegacyEligibility({ ...active }), { eligible: true });
  });

  it("excludes inactive members and companion logins", () => {
    assert.deepEqual(familyLegacyEligibility({ active: false }), { eligible: false, reason: "not_active" });
    assert.deepEqual(familyLegacyEligibility({ active: true, accessRole: "companion" }), {
      eligible: false,
      reason: "companion_login",
    });
  });

  it("sends members with a completed earlier offer to call for details", () => {
    assert.deepEqual(familyLegacyEligibility({ ...active, legacyOfferStatus: "Completed Offer" }), {
      eligible: false,
      reason: "completed_offer",
    });
  });

  it("treats a completed offer from this purchase as already purchased", () => {
    assert.deepEqual(familyLegacyEligibility({ ...active, legacyOfferStatus: "Completed Offer" }, true), {
      eligible: false,
      reason: "already_purchased",
    });
  });

  it("blocks a second purchase from a paid order or the Salesforce status", () => {
    assert.deepEqual(familyLegacyEligibility({ ...active }, true), { eligible: false, reason: "already_purchased" });
    assert.deepEqual(familyLegacyEligibility({ ...active, legacyOfferStatus: "Paid - Addendum Pending" }), {
      eligible: false,
      reason: "already_purchased",
    });
  });
});

describe("legacy status helpers", () => {
  it("recognizes the paid status regardless of case", () => {
    assert.equal(isLegacyPaidPendingAddendum("paid - addendum pending"), true);
    assert.equal(isLegacyPaidPendingAddendum("Reviewed - Email Sent"), false);
    assert.equal(isLegacyPaidPendingAddendum(null), false);
  });

  it("summarizes the Salesforce checkboxes for Member Services", () => {
    assert.equal(
      describeLegacyCheckboxes({ isTransferable: true }),
      "Is Transferable checked, Is Companion not checked, Is PrePay Transfer not checked"
    );
  });
});

describe("parseFamilyLegacyIntake", () => {
  it("treats every field as optional and trims input", () => {
    assert.deepEqual(parseFamilyLegacyIntake({ heirName: "  Jane   Doe ", companionName: 42 }), {
      companionName: "",
      companionRelationship: "",
      heirName: "Jane Doe",
      heirRelationship: "",
      notes: "",
    });
    assert.equal(parseFamilyLegacyIntake(null).notes, "");
  });
});

describe("buildFamilyLegacyTaskDescription", () => {
  const base = {
    memberName: "Loren Simmons",
    memberNumber: "2910229",
    checkboxesBefore: "Is Transferable checked, Is Companion not checked, Is PrePay Transfer not checked",
    amountCents: 60000,
    paidAtIso: "2026-10-30T19:00:00Z",
    stripePaymentIntentId: "pi_123",
    intake: parseFamilyLegacyIntake({ companionName: "Mary Simmons", companionRelationship: "spouse" }),
    statusUpdated: true,
  };

  it("gives Member Services the order details and next steps", () => {
    const text = buildFamilyLegacyTaskDescription(base);
    assert.match(text, /Loren Simmons \(#2910229\) purchased/);
    assert.match(text, /Paid: \$600\.00 by card \(Stripe\) on 2026-10-30/);
    assert.match(text, /Add-ons to apply: all three \(Transferability, Companion, Pre-Paid Transfer Fee\)/);
    assert.match(text, /Salesforce before purchase: Is Transferable checked, .*member was not shown this/);
    assert.match(text, /Companion: Mary Simmons \(spouse\)/);
    assert.match(text, /Heir: Not provided yet/);
    assert.match(text, /Adobe Sign/);
    assert.match(text, /"Is Transferable", "Is Companion", and "Is PrePay Transfer"/);
    assert.doesNotMatch(text, /could not set/);
  });

  it("asks for a manual status update when Salesforce rejected it", () => {
    const text = buildFamilyLegacyTaskDescription({ ...base, statusUpdated: false });
    assert.match(text, /could not set Legacy Offer Status to "Paid - Addendum Pending"/);
  });
});
