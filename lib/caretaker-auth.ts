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

/** Admin: read-only multi-camp dashboard. Camp: single-camp portal with check-in writes. */
export type CaretakerAccess =
  | { mode: "admin"; contactId: string; memberNumber: string }
  | ({ mode: "camp" } & CaretakerContext);

/**
 * Resolves portal mode from Salesforce. If both Caretaker_Admin__c and caretaker at a camp,
 * mode is admin only (admin dashboard, no camp write APIs via getCaretakerContext).
 */
export async function getCaretakerAccess(): Promise<CaretakerAccess | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("member_session")?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  const member = await lookupMember(session.memberNumber);
  if (!member.valid || !member.contactId) return null;

  if (member.isCaretakerAdmin) {
    return {
      mode: "admin",
      contactId: member.contactId,
      memberNumber: session.memberNumber,
    };
  }

  if (!member.isCaretaker || !member.caretakerAtCamp) return null;

  const campSlug = caretakerCampToSlug(member.caretakerAtCamp);
  if (!campSlug) return null;

  const camp = getCampBySlug(campSlug);
  const campName = camp?.name ?? campSlug;

  return {
    mode: "camp",
    contactId: member.contactId,
    memberNumber: session.memberNumber,
    campSlug,
    campName,
  };
}

/**
 * Camp-scoped caretaker for write APIs. Null for non-caretakers, unmapped camps, and
 * Caretaker_Admin__c users (including admin+caretaker — they use the admin dashboard only).
 */
export async function getCaretakerContext(): Promise<CaretakerContext | null> {
  return getCaretakerWriteContext();
}

/**
 * Write context for camp caretakers, or admin manual reservation when campSlug is provided.
 */
export async function getCaretakerWriteContext(
  campSlugOverride?: string
): Promise<CaretakerContext | null> {
  const access = await getCaretakerAccess();
  if (!access) return null;

  if (access.mode === "camp") {
    return {
      contactId: access.contactId,
      memberNumber: access.memberNumber,
      campSlug: access.campSlug,
      campName: access.campName,
    };
  }

  if (access.mode === "admin" && campSlugOverride) {
    const camp = getCampBySlug(campSlugOverride);
    if (!camp) return null;
    return {
      contactId: access.contactId,
      memberNumber: access.memberNumber,
      campSlug: campSlugOverride,
      campName: camp.name,
    };
  }

  return null;
}
