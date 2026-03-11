import { NextRequest, NextResponse } from "next/server";
import { getCaretakerContext } from "@/lib/caretaker-auth";
import { sql, hasDb } from "@/lib/db";
import { campUsesReservations } from "@/lib/reservation-camps";

/**
 * GET /api/members/caretaker/sites/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns site IDs that have no overlapping reservation (status != cancelled) in the given date range.
 * Only for camps using the reservation system.
 */
export async function GET(request: NextRequest) {
  const caretaker = await getCaretakerContext();
  if (!caretaker) {
    return NextResponse.json({ error: "Caretaker access required" }, { status: 403 });
  }
  if (!campUsesReservations(caretaker.campSlug)) {
    return NextResponse.json({ error: "Reservation system not available for this camp" }, { status: 403 });
  }
  if (!hasDb() || !sql) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from")?.trim() || "";
  const to = searchParams.get("to")?.trim() || "";
  const fromMatch = /^\d{4}-\d{2}-\d{2}$/.test(from);
  const toMatch = /^\d{4}-\d{2}-\d{2}$/.test(to);
  if (!fromMatch || !toMatch || from > to) {
    return NextResponse.json(
      { error: "Query params 'from' and 'to' required (YYYY-MM-DD), from <= to" },
      { status: 400 }
    );
  }

  // Sites that have at least one overlapping reservation in [from, to] (excluding cancelled)
  const occupied = await sql`
    SELECT DISTINCT site_id
    FROM camp_reservations
    WHERE camp_slug = ${caretaker.campSlug}
      AND status != 'cancelled'
      AND check_in_date < ${to}
      AND check_out_date > ${from}
  `;
  const occupiedRows = (Array.isArray(occupied) ? occupied : []) as { site_id: string }[];
  const occupiedIds = new Set(occupiedRows.map((r) => r.site_id));

  // All sites for this camp
  const allSites = await sql`
    SELECT id FROM camp_sites WHERE camp_slug = ${caretaker.campSlug} ORDER BY sort_order ASC, name ASC
  `;
  const allSitesRows = (Array.isArray(allSites) ? allSites : []) as { id: string }[];
  const allIds = allSitesRows.map((r) => r.id);
  const availableIds = allIds.filter((id) => !occupiedIds.has(id));

  return NextResponse.json({ availableSiteIds: availableIds });
}
