import { NextRequest, NextResponse } from "next/server";
import { getCaretakerContext } from "@/lib/caretaker-auth";
import { sql, hasDb } from "@/lib/db";
import { campUsesReservations } from "@/lib/reservation-camps";

type ReservationRow = {
  id: string;
  site_id: string;
  site_name?: string;
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
};

function rowToJson(row: ReservationRow) {
  return {
    id: row.id,
    siteId: row.site_id,
    siteName: row.site_name ?? null,
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
  };
}

/**
 * GET /api/members/caretaker/reservations?status=active|archived|all
 * List reservations for the caretaker's camp. Only for reservation-system camps.
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
  const status = searchParams.get("status") || "active";
  const today = new Date().toISOString().slice(0, 10);

  let rows: ReservationRow[];
  if (status === "active") {
    const r = await sql`
      SELECT r.id, r.site_id, s.name AS site_name, r.camp_slug, r.check_in_date, r.check_out_date, r.nights,
             r.reservation_type, r.member_contact_id, r.member_number, r.member_display_name,
             r.guest_first_name, r.guest_last_name, r.guest_email, r.guest_phone,
             r.status, r.checked_in_at, r.created_at, r.updated_at
      FROM camp_reservations r
      LEFT JOIN camp_sites s ON s.id = r.site_id
      WHERE r.camp_slug = ${caretaker.campSlug} AND r.check_out_date >= ${today} AND r.status != 'cancelled'
      ORDER BY r.check_in_date ASC, r.created_at ASC
    `;
    rows = (Array.isArray(r) ? r : []) as ReservationRow[];
  } else if (status === "archived") {
    const r = await sql`
      SELECT r.id, r.site_id, s.name AS site_name, r.camp_slug, r.check_in_date, r.check_out_date, r.nights,
             r.reservation_type, r.member_contact_id, r.member_number, r.member_display_name,
             r.guest_first_name, r.guest_last_name, r.guest_email, r.guest_phone,
             r.status, r.checked_in_at, r.created_at, r.updated_at
      FROM camp_reservations r
      LEFT JOIN camp_sites s ON s.id = r.site_id
      WHERE r.camp_slug = ${caretaker.campSlug} AND (r.check_out_date < ${today} OR r.status = 'cancelled')
      ORDER BY r.check_out_date DESC, r.created_at DESC
    `;
    rows = (Array.isArray(r) ? r : []) as ReservationRow[];
  } else {
    const r = await sql`
      SELECT r.id, r.site_id, s.name AS site_name, r.camp_slug, r.check_in_date, r.check_out_date, r.nights,
             r.reservation_type, r.member_contact_id, r.member_number, r.member_display_name,
             r.guest_first_name, r.guest_last_name, r.guest_email, r.guest_phone,
             r.status, r.checked_in_at, r.created_at, r.updated_at
      FROM camp_reservations r
      LEFT JOIN camp_sites s ON s.id = r.site_id
      WHERE r.camp_slug = ${caretaker.campSlug}
      ORDER BY r.check_out_date DESC, r.created_at DESC
    `;
    rows = (Array.isArray(r) ? r : []) as ReservationRow[];
  }

  return NextResponse.json({ reservations: rows.map(rowToJson) });
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/members/caretaker/reservations
 * Body: { siteId, checkInDate, checkOutDate, type: 'member'|'guest', memberContactId?, memberNumber?, memberDisplayName?, guestFirstName?, guestLastName?, guestEmail?, guestPhone? }
 * Create reservation. Enforces no overlap for the site in the date range.
 */
export async function POST(request: NextRequest) {
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

  let body: {
    siteId?: string;
    checkInDate?: string;
    checkOutDate?: string;
    type?: string;
    memberContactId?: string;
    memberNumber?: string;
    memberDisplayName?: string;
    guestFirstName?: string;
    guestLastName?: string;
    guestEmail?: string;
    guestPhone?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const siteId = typeof body.siteId === "string" ? body.siteId.trim() : "";
  const checkInDate = typeof body.checkInDate === "string" ? body.checkInDate.trim() : "";
  const checkOutDate = typeof body.checkOutDate === "string" ? body.checkOutDate.trim() : "";
  const type = (body.type === "member" || body.type === "guest") ? body.type : null;

  if (!siteId || !/^\d{4}-\d{2}-\d{2}$/.test(checkInDate) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOutDate) || checkInDate >= checkOutDate) {
    return NextResponse.json(
      { error: "siteId, checkInDate, checkOutDate required (checkOutDate > checkInDate)" },
      { status: 400 }
    );
  }
  if (!type) {
    return NextResponse.json({ error: "type required: 'member' or 'guest'" }, { status: 400 });
  }

  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);
  const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (24 * 60 * 60 * 1000)));

  // Verify site belongs to this camp
  const siteCheck = await sql`
    SELECT id FROM camp_sites WHERE id = ${siteId} AND camp_slug = ${caretaker.campSlug} LIMIT 1
  `;
  if (!Array.isArray(siteCheck) || siteCheck.length === 0) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  // Overlap check: no other non-cancelled reservation for this site in [checkInDate, checkOutDate)
  const overlap = await sql`
    SELECT id FROM camp_reservations
    WHERE site_id = ${siteId}
      AND status != 'cancelled'
      AND check_in_date < ${checkOutDate}
      AND check_out_date > ${checkInDate}
    LIMIT 1
  `;
  if (Array.isArray(overlap) && overlap.length > 0) {
    return NextResponse.json({ error: "Site is not available for the selected dates" }, { status: 400 });
  }

  if (type === "member") {
    const memberContactId = typeof body.memberContactId === "string" ? body.memberContactId.trim() : "";
    const memberNumber = typeof body.memberNumber === "string" ? body.memberNumber.trim() : "";
    const memberDisplayName = typeof body.memberDisplayName === "string" ? body.memberDisplayName.trim() : null;
    if (!memberContactId || !memberNumber) {
      return NextResponse.json({ error: "memberContactId and memberNumber required for member reservation" }, { status: 400 });
    }
    const inserted = await sql`
      INSERT INTO camp_reservations (
        site_id, camp_slug, check_in_date, check_out_date, nights,
        reservation_type, member_contact_id, member_number, member_display_name,
        status, created_by_contact_id
      )
      VALUES (
        ${siteId}, ${caretaker.campSlug}, ${checkInDate}, ${checkOutDate}, ${nights},
        'member', ${memberContactId}, ${memberNumber}, ${memberDisplayName},
        'reserved', ${caretaker.contactId}
      )
      RETURNING id, site_id, camp_slug, check_in_date, check_out_date, nights,
                reservation_type, member_contact_id, member_number, member_display_name,
                guest_first_name, guest_last_name, guest_email, guest_phone,
                status, checked_in_at, created_at, updated_at
    `;
    const row = (Array.isArray(inserted) ? inserted : [])[0] as ReservationRow | undefined;
    if (!row) return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    return NextResponse.json(rowToJson(row), { status: 201 });
  }

  // type === 'guest'
  const guestFirstName = typeof body.guestFirstName === "string" ? body.guestFirstName.trim() : "";
  const guestLastName = typeof body.guestLastName === "string" ? body.guestLastName.trim() : "";
  const guestEmail = typeof body.guestEmail === "string" ? body.guestEmail.trim() : "";
  const guestPhone = typeof body.guestPhone === "string" ? body.guestPhone.trim() || null : null;
  if (!guestFirstName || !guestLastName || !guestEmail || !EMAIL_REGEX.test(guestEmail)) {
    return NextResponse.json(
      { error: "guestFirstName, guestLastName, and valid guestEmail required for guest reservation" },
      { status: 400 }
    );
  }
  const inserted = await sql`
    INSERT INTO camp_reservations (
      site_id, camp_slug, check_in_date, check_out_date, nights,
      reservation_type, guest_first_name, guest_last_name, guest_email, guest_phone,
      status, created_by_contact_id
    )
    VALUES (
      ${siteId}, ${caretaker.campSlug}, ${checkInDate}, ${checkOutDate}, ${nights},
      'guest', ${guestFirstName}, ${guestLastName}, ${guestEmail}, ${guestPhone},
      'reserved', ${caretaker.contactId}
    )
    RETURNING id, site_id, camp_slug, check_in_date, check_out_date, nights,
              reservation_type, member_contact_id, member_number, member_display_name,
              guest_first_name, guest_last_name, guest_email, guest_phone,
              status, checked_in_at, created_at, updated_at
  `;
  const row = (Array.isArray(inserted) ? inserted : [])[0] as ReservationRow | undefined;
  if (!row) return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  return NextResponse.json(rowToJson(row), { status: 201 });
}
