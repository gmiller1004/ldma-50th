import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyMemberAccess,
  contactIsActiveLdma,
  memberCanUseLegacyOffers,
  memberHasWebsiteAccess,
  pickSponsoringPrimary,
} from "./member-access.ts";
import { memberQualifiesForCampBooking } from "./reservation-member.ts";
import type { MemberLookupResult } from "./salesforce.ts";

const companionContact: MemberLookupResult = {
  valid: true,
  active: false,
  contactId: "003companion",
  email: "knx.michael@gmail.com",
  firstName: "Kathleen",
  lastName: "Michael",
  showMaintenance: false,
  hideMaintenance: false,
};

const kaylene = {
  Id: "003primary",
  Name: "Kaylene Monson",
  Customer_Number__c: "2935760",
  Active_Membership_Type__c: "LDMA",
  Active_Membership_Type_Text_Copy__c: "LDMA",
  Is_New_LDMA_Member__c: false,
  Companion_Transferable__c: false,
  Is_Companion__c: true,
};

describe("contactIsActiveLdma", () => {
  it("treats LDMA type as active", () => {
    assert.equal(contactIsActiveLdma({ Active_Membership_Type__c: "LDMA" }), true);
  });

  it("treats new-member flag as active", () => {
    assert.equal(contactIsActiveLdma({ Is_New_LDMA_Member__c: true }), true);
  });

  it("rejects a contact with no LDMA membership", () => {
    assert.equal(contactIsActiveLdma({}), false);
  });
});

describe("pickSponsoringPrimary", () => {
  it("selects an active LDMA primary even when Companion_Transferable__c is false", () => {
    const sponsor = pickSponsoringPrimary([kaylene]);
    assert.equal(sponsor, kaylene);
  });

  it("ignores a primary who named the companion but is not active LDMA", () => {
    const inactive = {
      ...kaylene,
      Active_Membership_Type__c: null,
      Active_Membership_Type_Text_Copy__c: null,
    };
    assert.equal(pickSponsoringPrimary([inactive]), null);
  });
});

describe("applyMemberAccess", () => {
  it("gives companion website and camp access without treating them as the membership owner", () => {
    const result = applyMemberAccess(companionContact, "companion", {
      contactId: "003primary",
      memberNumber: "2935760",
      name: "Kaylene Monson",
    });
    assert.equal(result.hasMemberAccess, true);
    assert.equal(result.accessRole, "companion");
    assert.equal(result.active, false);
    assert.equal(result.companionOfName, "Kaylene Monson");
    assert.equal(result.hideMaintenance, true);
    assert.equal(memberHasWebsiteAccess(result), true);
    assert.equal(memberQualifiesForCampBooking(result), true);
    assert.equal(memberCanUseLegacyOffers(result), false);
  });

  it("does not grant access when the companion has no active LDMA sponsor", () => {
    const result = applyMemberAccess(companionContact, "primary");
    assert.equal(result.hasMemberAccess, false);
    assert.equal(result.accessRole, "primary");
    assert.equal(memberHasWebsiteAccess(result), false);
    assert.equal(memberQualifiesForCampBooking(result), false);
  });

  it("keeps full access for an active LDMA primary", () => {
    const primary: MemberLookupResult = {
      valid: true,
      active: true,
      email: "marykaymon@gmail.com",
    };
    const result = applyMemberAccess(primary, "primary");
    assert.equal(result.hasMemberAccess, true);
    assert.equal(result.accessRole, "primary");
    assert.equal(memberHasWebsiteAccess(result), true);
    assert.equal(memberQualifiesForCampBooking(result), true);
    assert.equal(memberCanUseLegacyOffers(result), true);
  });
});
