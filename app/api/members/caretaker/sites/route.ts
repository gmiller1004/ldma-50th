import { NextRequest, NextResponse } from "next/server";
import { getCaretakerContext } from "@/lib/caretaker-auth";
import { sql, hasDb } from "@/lib/db";
import { campUsesReservations } from "@/lib/reservation-camps";

type SiteRow = {
  id: string;
  camp_slug: string;
  name: string;
  site_type: string;
  sort_order: number;
  member_rate_daily: number | null;
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
    nonMemberRateDaily: row.non_member_rate_daily,
    notes: row.notes,
  };
}

/**
 * GET /api/members/caretaker/sites
 * List sites for the caretaker's camp. Only available for camps using the reservation system (e.g. Burnt River).
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

  const rows = await sql`
    SELECT id, camp_slug, name, site_type, sort_order, member_rate_daily, non_member_rate_daily, notes
    FROM camp_sites
    WHERE camp_slug = ${caretaker.campSlug}
    ORDER BY sort_order ASC, name ASC
  `;
  const list = (Array.isArray(rows) ? rows : []) as SiteRow[];
  return NextResponse.json({ campSlug: caretaker.campSlug, sites: list.map(rowToJson) });
}
