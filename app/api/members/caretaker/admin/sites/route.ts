import { NextRequest, NextResponse } from "next/server";
import { getCaretakerAccess } from "@/lib/caretaker-auth";
import { sql, hasDb } from "@/lib/db";
import { campUsesReservations, isNonBookableSite } from "@/lib/reservation-camps";
import { getValidCampSlugs } from "@/lib/directory-camps";

type SiteRow = {
  id: string;
  camp_slug: string;
  name: string;
  site_type: string;
  sort_order: number;
  member_rate_daily: number | null;
  member_rate_monthly: number | null;
  non_member_rate_daily: number | null;
  notes: string | null;
};

function rowToJson(row: SiteRow) {
  return {
    id: row.id,
    campSlug: row.camp_slug,
    name: row.name,
    siteType: row.site_type,
    sortOrder: row.sort_order,
    memberRateDaily: row.member_rate_daily,
    memberRateMonthly: row.member_rate_monthly,
    nonMemberRateDaily: row.non_member_rate_daily,
    notes: row.notes,
  };
}

/**
 * GET /api/members/caretaker/admin/sites?campSlug=...&from=...&to=...
 * List sites for a camp; optional availability filter for date range.
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
  if (!campSlug || !getValidCampSlugs().includes(campSlug)) {
    return NextResponse.json({ error: "Valid campSlug required" }, { status: 400 });
  }
  if (!campUsesReservations(campSlug)) {
    return NextResponse.json({ error: "Reservation system not available for this camp" }, { status: 403 });
  }

  const from = request.nextUrl.searchParams.get("from")?.trim() ?? "";
  const to = request.nextUrl.searchParams.get("to")?.trim() ?? "";

  const rows = await sql`
    SELECT id, camp_slug, name, site_type, site_code, sort_order, member_rate_daily, member_rate_monthly, non_member_rate_daily, notes
    FROM camp_sites
    WHERE camp_slug = ${campSlug}
    ORDER BY sort_order ASC, name ASC
  `;
  const sites = (Array.isArray(rows) ? rows : []) as (SiteRow & { site_code: string | null })[];
  const bookable = sites.filter((s) => !isNonBookableSite(campSlug, s.name, s.site_code));

  let availableSiteIds: string[] | undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to) {
    const occupied = await sql`
      SELECT DISTINCT site_id
      FROM camp_reservations
      WHERE camp_slug = ${campSlug}
        AND status != 'cancelled'
        AND check_in_date < ${to}
        AND check_out_date > ${from}
    `;
    const occupiedIds = new Set(
      ((Array.isArray(occupied) ? occupied : []) as { site_id: string }[]).map((r) => r.site_id)
    );
    availableSiteIds = bookable.filter((s) => !occupiedIds.has(s.id)).map((s) => s.id);
  }

  return NextResponse.json({
    campSlug,
    sites: bookable.map(rowToJson),
    availableSiteIds,
  });
}
