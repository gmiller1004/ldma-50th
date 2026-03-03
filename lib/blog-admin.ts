import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/session";
import { lookupMember } from "@/lib/salesforce";

export type AdminMember = {
  memberNumber: string;
  contactId: string;
  email: string;
  firstName?: string;
  lastName?: string;
};

/**
 * Verify session and that the member has Is_LDMA_Admin__c = true.
 * Returns the member info for admin context, or null if not admin.
 */
export async function getAdminMember(): Promise<AdminMember | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("member_session")?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  const member = await lookupMember(session.memberNumber);
  if (!member.valid || !member.isLdmaAdmin || !member.contactId || !member.email)
    return null;

  return {
    memberNumber: session.memberNumber,
    contactId: member.contactId,
    email: member.email,
    firstName: member.firstName,
    lastName: member.lastName,
  };
}

/**
 * Use in API routes. Returns 403 Response if not admin; otherwise returns null (caller proceeds).
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const admin = await getAdminMember();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
