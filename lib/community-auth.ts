import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";
import { lookupMember } from "@/lib/salesforce";

/**
 * Format display name as "FirstName L." (e.g. "Greg M.")
 * Used for accountable posting in the community.
 */
export function formatMemberDisplayName(
  firstName?: string | null,
  lastName?: string | null
): string {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();
  if (first && last) {
    return `${first} ${last.charAt(0).toUpperCase()}.`;
  }
  if (first) return first;
  if (last) return `${last.charAt(0).toUpperCase()}.`;
  return "LDMA Member";
}

/**
 * Get the authenticated member's display name from session + Salesforce.
 * Returns null if not authenticated or lookup fails.
 */
export async function getAuthenticatedMemberForPost(): Promise<{
  displayName: string;
  contactId?: string;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("member_session")?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  const member = await lookupMember(session.memberNumber);
  if (!member.valid) return null;

  const displayName = formatMemberDisplayName(member.firstName, member.lastName);
  return { displayName, contactId: member.contactId };
}
