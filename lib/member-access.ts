import type { MemberLookupResult } from "@/lib/salesforce";

export type MemberAccessRole = "primary" | "companion";

export type CompanionSponsor = {
  contactId: string;
  memberNumber: string | null;
  name: string;
};

/** Salesforce Contact fields that mark an active LDMA membership. */
export function contactIsActiveLdma(fields: {
  Active_Membership_Type__c?: unknown;
  Active_Membership_Type_Text_Copy__c?: unknown;
  Is_New_LDMA_Member__c?: unknown;
}): boolean {
  const membershipType = String(fields.Active_Membership_Type__c || "");
  const membershipTypeText = String(fields.Active_Membership_Type_Text_Copy__c || "");
  return (
    membershipType === "LDMA" ||
    membershipTypeText === "LDMA" ||
    fields.Is_New_LDMA_Member__c === true
  );
}

/** First active LDMA contact among people who named this person as Companion__c. */
export function pickSponsoringPrimary(
  primaries: Array<{
    Active_Membership_Type__c?: unknown;
    Active_Membership_Type_Text_Copy__c?: unknown;
    Is_New_LDMA_Member__c?: unknown;
  }>
): (typeof primaries)[number] | null {
  return primaries.find((row) => contactIsActiveLdma(row)) ?? null;
}

export function applyMemberAccess(
  member: MemberLookupResult,
  role: MemberAccessRole,
  sponsor?: CompanionSponsor | null
): MemberLookupResult {
  if (role === "companion" && sponsor) {
    return {
      ...member,
      hasMemberAccess: true,
      accessRole: "companion",
      companionOfName: sponsor.name,
      companionOfMemberNumber: sponsor.memberNumber ?? undefined,
      companionOfContactId: sponsor.contactId,
      showMaintenance: false,
      hideMaintenance: true,
    };
  }
  return {
    ...member,
    hasMemberAccess: member.active === true,
    accessRole: "primary",
    companionOfName: undefined,
    companionOfMemberNumber: undefined,
    companionOfContactId: undefined,
  };
}

export function memberHasWebsiteAccess(
  member: MemberLookupResult
): member is MemberLookupResult & { email: string; hasMemberAccess: true } {
  return Boolean(member.valid && member.hasMemberAccess && member.email);
}

export function memberCanUseLegacyOffers(member: MemberLookupResult): boolean {
  return member.accessRole !== "companion" && member.active === true;
}
