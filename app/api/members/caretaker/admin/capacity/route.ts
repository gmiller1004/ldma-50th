import { NextRequest, NextResponse } from "next/server";
import { getCaretakerAccess } from "@/lib/caretaker-auth";
import { sql, hasDb } from "@/lib/db";
import {
  campUsesReservations,
  isNonBookableSite,
  parseCapacitySiteFilter,
  siteMatchesCapacityFilter,
} from "@/lib/reservation-camps";
import { getCampBySlug, getValidCampSlugs } from "@/lib/directory-camps";
import {
  computeCapacityStats,
  computeSiteNightOccupancy,
  isValidDateRange,
} from "@/lib/camp-capacity";
import { addDays, toDateOnlyStr } from "@/lib/reservation-dates";

type SiteRow = {
  id: string;
  name: string;
  site_code: string | null;
  site_type: string;
};

/**
 * GET /api/members/caretaker/admin/capacity?campSlug=...&from=YYYY-MM-DD&to=YYYY-MM-DD&siteFilter=all|hookup|dry
 * Booked vs available bookable sites for a camp over a date range.
 */
export async function GET(request: NextRequest) {
  const access = await getCaretakerAccess();
  if (!access || access.mode !== "admin") {
    return NextResponse.json({ error: "Caretaker admin access required" }, { status: 403 });
  }
  if (!hasDb() || !sql) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  const campSlug = request.nextUrl.searchParams.get("campSlug")?.trim() ?? "";
  const from = request.nextUrl.searchParams.get("from")?.trim() ?? "";
  const to = request.nextUrl.searchParams.get("to")?.trim() ?? "";
  const siteFilter = parseCapacitySiteFilter(request.nextUrl.searchParams.get("siteFilter"));

  if (!campSlug || !getValidCampSlugs().includes(campSlug)) {
    return NextResponse.json({ error: "Valid campSlug required" }, { status: 400 });
  }
  if (!campUsesReservations(campSlug)) {
    return NextResponse.json({ error: "Reservation system not available for this camp" }, { status: 403 });
  }
  if (!isValidDateRange(from, to)) {
    return NextResponse.json({ error: "Valid from and to dates required (YYYY-MM-DD)" }, { status: 400 });
  }

  const siteRows = await sql`
    SELECT id, name, site_code, site_type
    FROM camp_sites
    WHERE camp_slug = ${campSlug}
    ORDER BY sort_order ASC, name ASC
  `;
  const bookable = ((Array.isArray(siteRows) ? siteRows : []) as SiteRow[]).filter(
    (s) =>
      !isNonBookableSite(campSlug, s.name, s.site_code) &&
      siteMatchesCapacityFilter(s.site_type, siteFilter)
  );

  const rangeEndExclusive = addDays(to, 1);

  const occupied = await sql`
    SELECT DISTINCT site_id
    FROM camp_reservations
    WHERE camp_slug = ${campSlug}
      AND status != 'cancelled'
      AND check_in_date < ${rangeEndExclusive}::date
      AND check_out_date > ${from}::date
  `;
  const occupiedIds = new Set(
    ((Array.isArray(occupied) ? occupied : []) as { site_id: string }[]).map((r) => r.site_id)
  );
  const bookedSites = bookable.filter((s) => occupiedIds.has(s.id)).length;
  const siteStats = computeCapacityStats(bookedSites, bookable.length);

  const bookableIds = bookable.map((s) => s.id);
  let stays: { siteId: string; checkIn: string; checkOut: string }[] = [];
  if (bookableIds.length > 0) {
    const stayRows = await sql`
      SELECT site_id, check_in_date, check_out_date
      FROM camp_reservations
      WHERE camp_slug = ${campSlug}
        AND status != 'cancelled'
        AND site_id = ANY(${bookableIds}::uuid[])
        AND check_in_date < ${rangeEndExclusive}::date
        AND check_out_date > ${from}::date
    `;
    stays = (Array.isArray(stayRows) ? stayRows : []).map((r) => {
      const row = r as {
        site_id: string;
        check_in_date: string | Date;
        check_out_date: string | Date;
      };
      return {
        siteId: row.site_id,
        checkIn: toDateOnlyStr(row.check_in_date),
        checkOut: toDateOnlyStr(row.check_out_date),
      };
    });
  }
  const siteNights = computeSiteNightOccupancy(bookable.length, from, to, stays);

  const camp = getCampBySlug(campSlug);

  return NextResponse.json({
    campSlug,
    campName: camp?.name ?? campSlug,
    from,
    to,
    siteFilter,
    ...siteStats,
    siteNights,
  });
}
