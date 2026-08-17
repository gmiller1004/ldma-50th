import type { MemberLookupResult } from "@/lib/salesforce";

/** Active LDMA member or named companion of an active LDMA member. */
export function memberQualifiesForCampBooking(member: MemberLookupResult): boolean {
  if (member.valid !== true) return false;
  if (member.hasMemberAccess === true) return true;
  return member.active === true && member.accessRole !== "companion";
}
