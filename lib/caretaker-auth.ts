import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/session";
import { lookupMember } from "@/lib/salesforce";
import { caretakerCampToSlug } from "@/lib/caretaker-camps";
import { getCampBySlug, getValidCampSlugs } from "@/lib/directory-camps";

/** When set, Caretaker_Admin__c users operate as that camp's caretaker in the portal. */
export const CARETAKER_ADMIN_CAMP_COOKIE = "caretaker_admin_camp_slug";

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
 * Camp-scoped caretaker for portal and write APIs. Directors get context when viewing a camp
 * (cookie or explicit campSlug); camp caretakers use their assigned camp.
 */
export async function getCaretakerContext(): Promise<CaretakerContext | null> {
  return getCaretakerWriteContext();
}

/** Camp slug when a director is viewing the caretaker portal for a specific camp. */
export async function getAdminViewCampSlug(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const slug = cookieStore.get(CARETAKER_ADMIN_CAMP_COOKIE)?.value?.trim();
  if (!slug || !getValidCampSlugs().includes(slug)) return undefined;
  return slug;
}

/**
 * Write context for camp caretakers, or admin acting on a camp (view-camp cookie or campSlug).
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

  if (access.mode === "admin") {
    const slug = campSlugOverride ?? (await getAdminViewCampSlug());
    if (!slug) return null;
    const camp = getCampBySlug(slug);
    if (!camp) return null;
    return {
      contactId: access.contactId,
      memberNumber: access.memberNumber,
      campSlug: slug,
      campName: camp.name,
    };
  }

  return null;
}

/** campSlug query param lets Caretaker_Admin__c users act on a specific camp. */
export function campSlugQueryParam(request: { nextUrl: URL }): string | undefined {
  const slug = request.nextUrl.searchParams.get("campSlug")?.trim();
  return slug || undefined;
}

export async function getCaretakerWriteContextFromRequest(
  request: { nextUrl: URL },
  campSlugOverride?: string
): Promise<CaretakerContext | null> {
  return getCaretakerWriteContext(campSlugOverride ?? campSlugQueryParam(request));
}
