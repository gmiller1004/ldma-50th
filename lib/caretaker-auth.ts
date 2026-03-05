import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";
import { lookupMember } from "@/lib/salesforce";
import { caretakerCampToSlug } from "@/lib/caretaker-camps";
import { getCampBySlug } from "@/lib/directory-camps";

export type CaretakerContext = {
  contactId: string;
  memberNumber: string;
  campSlug: string;
  campName: string;
};

/**
 * Get the authenticated caretaker's context. Returns null if not logged in, not a caretaker, or camp not mapped.
 */
export async function getCaretakerContext(): Promise<CaretakerContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("member_session")?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  const member = await lookupMember(session.memberNumber);
  if (!member.valid || !member.contactId || !member.isCaretaker) return null;

  const campSlug = caretakerCampToSlug(member.caretakerAtCamp);
  if (!campSlug) return null;

  const camp = getCampBySlug(campSlug);
  const campName = camp?.name ?? campSlug;

  return {
    contactId: member.contactId,
    memberNumber: session.memberNumber,
    campSlug,
    campName,
  };
}
