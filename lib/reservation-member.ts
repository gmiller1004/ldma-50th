import type { MemberLookupResult } from "@/lib/salesforce";

/** Active LDMA member (including Is_New_LDMA_Member__c) eligible for member rates and stays >10 nights. */
export function memberQualifiesForCampBooking(member: MemberLookupResult): boolean {
  return member.valid === true && member.active === true;
}
