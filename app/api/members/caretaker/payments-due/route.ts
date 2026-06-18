import { NextRequest, NextResponse } from "next/server";
import { getAdminViewCampSlug, getCaretakerAccess } from "@/lib/caretaker-auth";
import { campUsesReservations } from "@/lib/reservation-camps";
import { fetchPaymentsDueForCamp } from "@/lib/caretaker-site-ar";
import { getValidCampSlugs } from "@/lib/directory-camps";

/**
 * GET /api/members/caretaker/payments-due
 * Site fees due within 7 days or overdue.
 * Camp caretakers: their camp. Directors: ?campSlug= required.
 */
export async function GET(request: NextRequest) {
  const access = await getCaretakerAccess();
  if (!access) {
    return NextResponse.json({ error: "Caretaker access required" }, { status: 403 });
  }

  let campSlug: string;
  if (access.mode === "admin") {
    const slug =
      request.nextUrl.searchParams.get("campSlug")?.trim() ?? (await getAdminViewCampSlug()) ?? "";
    if (!slug || !getValidCampSlugs().includes(slug)) {
      return NextResponse.json({ error: "Valid campSlug query param required" }, { status: 400 });
    }
    campSlug = slug;
  } else {
    campSlug = access.campSlug;
  }

  if (!campUsesReservations(campSlug)) {
    return NextResponse.json({ items: [] });
  }

  const items = await fetchPaymentsDueForCamp(campSlug, 7);
  return NextResponse.json({ items });
}
