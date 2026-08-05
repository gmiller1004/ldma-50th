import { NextRequest, NextResponse } from "next/server";
import { getCaretakerAccess } from "@/lib/caretaker-auth";
import { hasDb } from "@/lib/db";
import { getValidCampSlugs } from "@/lib/directory-camps";
import { campUsesReservations } from "@/lib/reservation-camps";
import { isValidDateRange } from "@/lib/camp-capacity";
import { buildSeasonTotalsCsv } from "@/lib/director-season-totals";
import { listSeasonTotalSnapshots } from "@/lib/director-season-totals-db";

/**
 * GET /api/members/caretaker/admin/season-totals-export?campSlug=&seasonFrom=&seasonTo=
 * CSV of saved Season Totals snapshots for weekly trend analysis.
 */
export async function GET(request: NextRequest) {
  const access = await getCaretakerAccess();
  if (!access || access.mode !== "admin") {
    return NextResponse.json({ error: "Caretaker admin access required" }, { status: 403 });
  }
  if (!hasDb()) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  const campSlug = request.nextUrl.searchParams.get("campSlug")?.trim() ?? "";
  const seasonFrom = request.nextUrl.searchParams.get("seasonFrom")?.trim() ?? "";
  const seasonTo = request.nextUrl.searchParams.get("seasonTo")?.trim() ?? "";

  if (!campSlug || !getValidCampSlugs().includes(campSlug)) {
    return NextResponse.json({ error: "Valid campSlug required" }, { status: 400 });
  }
  if (!campUsesReservations(campSlug)) {
    return NextResponse.json({ error: "Reservation system not available for this camp" }, { status: 403 });
  }
  if (!isValidDateRange(seasonFrom, seasonTo)) {
    return NextResponse.json(
      { error: "Valid seasonFrom and seasonTo required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  try {
    const snapshots = await listSeasonTotalSnapshots({ campSlug, seasonFrom, seasonTo });
    const csv = buildSeasonTotalsCsv(snapshots);
    const filename = `ldma-season-totals-${campSlug}-${seasonFrom}-to-${seasonTo}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[season-totals-export]", e);
    return NextResponse.json({ error: "Failed to export season totals" }, { status: 500 });
  }
}
