import { NextRequest, NextResponse } from "next/server";
import { getCaretakerAccess } from "@/lib/caretaker-auth";
import { hasDb } from "@/lib/db";
import { directoryCamps, getValidCampSlugs } from "@/lib/directory-camps";
import { campUsesReservations } from "@/lib/reservation-camps";
import { isValidDateRange } from "@/lib/camp-capacity";
import {
  buildDirectorReportCsv,
  buildSeasonMonthRanges,
  enumerateMonthRange,
  isIsoMonth,
} from "@/lib/director-season-totals";
import {
  listMonthlyBookingTotals,
  listSeasonMonthTotals,
  listSeasonTotalSnapshots,
} from "@/lib/director-season-totals-db";

/**
 * GET /api/members/caretaker/admin/season-totals-export
 * CSV of the full director report: season totals trend, new bookings by month, and season by month.
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
  const seasonLabel = params.get("seasonLabel")?.trim() ?? "";
  const bookingFrom = params.get("bookingFrom")?.trim() ?? "";
  const bookingTo = params.get("bookingTo")?.trim() ?? "";

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

  const bookingMonths = enumerateMonthRange(bookingFrom, bookingTo);
  const hasBookingRange =
    isIsoMonth(bookingFrom) &&
    isIsoMonth(bookingTo) &&
    bookingMonths.length > 0 &&
    bookingMonths.length <= 24;
  const seasonMonthCount = buildSeasonMonthRanges(seasonFrom, seasonTo).length;

  try {
    const [snapshots, monthlyBookings, seasonMonths] = await Promise.all([
      listSeasonTotalSnapshots({ campSlug, seasonFrom, seasonTo }),
      hasBookingRange
        ? listMonthlyBookingTotals({ campSlug, seasonFrom, seasonTo, bookingFrom, bookingTo })
        : Promise.resolve([]),
      seasonMonthCount > 0 && seasonMonthCount <= 24
        ? listSeasonMonthTotals({ campSlug, seasonFrom, seasonTo })
        : Promise.resolve([]),
    ]);

    const campName =
      directoryCamps.find((camp) => camp.slug === campSlug)?.name ??
      snapshots[0]?.campName ??
      campSlug;

    const csv = buildDirectorReportCsv({
      campName,
      seasonFrom,
      seasonTo,
      seasonLabel: seasonLabel || `${seasonFrom} – ${seasonTo}`,
      snapshots,
      monthlyBookings,
      seasonMonths,
    });
    const filename = `ldma-director-report-${campSlug}-${seasonFrom}-to-${seasonTo}.csv`;

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
