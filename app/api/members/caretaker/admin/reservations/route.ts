import { NextRequest, NextResponse } from "next/server";
import { getCaretakerAccess } from "@/lib/caretaker-auth";
import { sql, hasDb } from "@/lib/db";
import { getValidCampSlugs } from "@/lib/directory-camps";

type ReservationRow = {
  id: string;
  site_id: string;
  site_name: string | null;
  camp_slug: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  reservation_type: string;
  member_contact_id: string | null;
  member_number: string | null;
  member_display_name: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  status: string;
  checked_in_at: string | null;
  created_at: string;
  updated_at: string;
  event_product_handle: string | null;
  event_site_type: string | null;
};

function rowToJson(row: ReservationRow) {
  return {
    id: row.id,
    siteId: row.site_id,
    siteName: row.site_name,
    campSlug: row.camp_slug,
    checkInDate: row.check_in_date,
    checkOutDate: row.check_out_date,
    nights: row.nights,
    reservationType: row.reservation_type,
    memberContactId: row.member_contact_id,
    memberNumber: row.member_number,
    memberDisplayName: row.member_display_name,
    guestFirstName: row.guest_first_name,
    guestLastName: row.guest_last_name,
    guestEmail: row.guest_email,
    guestPhone: row.guest_phone,
    status: row.status,
    checkedInAt: row.checked_in_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    eventProductHandle: row.event_product_handle,
    eventSiteType: row.event_site_type,
  };
}

const MAX_ROWS = 300;

/**
 * GET /api/members/caretaker/admin/reservations?campSlug=...
 * Reservation history for one directory camp (admin read-only).
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
    return NextResponse.json({ error: "Invalid camp" }, { status: 400 });
  }

  try {
    const r = await sql`
      SELECT r.id, r.site_id, s.name AS site_name, r.camp_slug, r.check_in_date, r.check_out_date, r.nights,
             r.reservation_type, r.member_contact_id, r.member_number, r.member_display_name,
             r.guest_first_name, r.guest_last_name, r.guest_email, r.guest_phone,
             r.status, r.checked_in_at, r.created_at, r.updated_at, r.event_product_handle, r.event_site_type
      FROM camp_reservations r
      LEFT JOIN camp_sites s ON s.id = r.site_id
      WHERE r.camp_slug = ${campSlug}
      ORDER BY r.check_out_date DESC, r.created_at DESC
      LIMIT ${MAX_ROWS}
    `;
    const rows = (Array.isArray(r) ? r : []) as ReservationRow[];
    return NextResponse.json({ reservations: rows.map(rowToJson) });
  } catch (e) {
    console.error("[caretaker-admin] reservations query failed:", e);
    return NextResponse.json({ error: "Failed to load reservations" }, { status: 500 });
  }
}
