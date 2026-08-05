import { NextRequest, NextResponse } from "next/server";
import { getCaretakerAccess } from "@/lib/caretaker-auth";
import { hasDb } from "@/lib/db";
import { getValidCampSlugs } from "@/lib/directory-camps";
import { campUsesReservations } from "@/lib/reservation-camps";
import { isValidDateRange } from "@/lib/camp-capacity";
import { buildSeasonMonthRanges } from "@/lib/director-season-totals";
import { listSeasonMonthTotals } from "@/lib/director-season-totals-db";

/**
 * GET /api/members/caretaker/admin/season-months
 * Live reservation and site-night totals for each month in a camp season.
 */
export async function GET(request: NextRequest) {
  const access = await getCaretakerAccess();
  if (!access || access.mode !== "admin") {
    return NextResponse.json({ error: "Caretaker admin access required" }, { status: 403 });
  }
  if (!hasDb()) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  const params = request.nextUrl.searchParams;
  const campSlug = params.get("campSlug")?.trim() ?? "";
  const seasonFrom = params.get("seasonFrom")?.trim() ?? "";
  const seasonTo = params.get("seasonTo")?.trim() ?? "";

  if (!campSlug || !getValidCampSlugs().includes(campSlug)) {
    return NextResponse.json({ error: "Valid campSlug required" }, { status: 400 });
  }
  if (!campUsesReservations(campSlug)) {
    return NextResponse.json(
      { error: "Reservation system not available for this camp" },
      { status: 403 }
    );
  }
  const months = buildSeasonMonthRanges(seasonFrom, seasonTo);
  if (!isValidDateRange(seasonFrom, seasonTo) || months.length === 0) {
    return NextResponse.json(
      { error: "Valid seasonFrom and seasonTo required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }
  if (months.length > 24) {
    return NextResponse.json({ error: "Season range cannot exceed 24 months" }, { status: 400 });
  }

  try {
    const totals = await listSeasonMonthTotals({ campSlug, seasonFrom, seasonTo });
    return NextResponse.json(
      { campSlug, seasonFrom, seasonTo, totals },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[season-months GET]", error);
    const message = error instanceof Error ? error.message : "Failed to load season months";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
