import { NextRequest, NextResponse } from "next/server";
import { getCaretakerContext } from "@/lib/caretaker-auth";
import { sql, hasDb } from "@/lib/db";
import { campUsesReservations } from "@/lib/reservation-camps";
import { lookupMember } from "@/lib/salesforce";
import {
  sendCaretakerCheckInWelcomeEmail,
  sendCaretakerGuestCheckInWelcomeEmail,
} from "@/lib/sendgrid";

type ReservationRow = {
  id: string;
  site_id: string;
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
 * PATCH /api/members/caretaker/reservations/[id]
 * Body: { checkOutDate?: "YYYY-MM-DD", checkIn?: true } — update checkout date and/or mark as checked in.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Reservation id required" }, { status: 400 });
  }

  let body: { checkOutDate?: string; checkIn?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await sql`
    SELECT id, site_id, camp_slug, check_in_date, check_out_date, nights, status,
           reservation_type, member_number, member_display_name, guest_first_name, guest_email
    FROM camp_reservations
    WHERE id = ${id} AND camp_slug = ${caretaker.campSlug}
    LIMIT 1
  `;
  const existingArr = Array.isArray(existing) ? existing : [];
  type ExistingRow = {
    site_id: string;
    check_in_date: string;
    check_out_date: string;
    status: string;
    reservation_type: string;
    member_number: string | null;
    member_display_name: string | null;
    guest_first_name: string | null;
    guest_email: string | null;
  };
  const existingRow = existingArr[0] as ExistingRow | undefined;
  if (!existingRow) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }
  if (existingRow.status === "cancelled") {
    return NextResponse.json({ error: "Cannot update cancelled reservation" }, { status: 400 });
  }

  const setCheckInRequested = body.checkIn === true;
  if (setCheckInRequested) {
    const today = new Date().toISOString().slice(0, 10);
    if (today < existingRow.check_in_date) {
      return NextResponse.json(
        { error: "Check-in is only allowed on or after the reservation check-in date. Edit the reservation to move the check-in date earlier if needed." },
        { status: 400 }
      );
    }
  }

  let checkOutDateStr: string | null = null;
  if (typeof body.checkOutDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.checkOutDate.trim())) {
    const candidate = body.checkOutDate.trim();
    if (candidate <= existingRow.check_in_date) {
      return NextResponse.json({ error: "Check-out date must be after check-in date" }, { status: 400 });
    }
    // Overlap check: no other non-cancelled reservation for this site overlapping new range (excluding this id)
    const overlap = await sql`
      SELECT id FROM camp_reservations
      WHERE site_id = ${existingRow.site_id}
        AND id != ${id}
        AND status != 'cancelled'
        AND check_in_date < ${candidate}
        AND check_out_date > ${existingRow.check_in_date}
      LIMIT 1
    `;
    if (Array.isArray(overlap) && overlap.length > 0) {
      return NextResponse.json({ error: "Site is not available for the new dates" }, { status: 400 });
    }
    checkOutDateStr = candidate;
  }

  const setCheckIn = body.checkIn === true;

  if (setCheckIn) {
    // Send welcome email (fire-and-forget)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ldma-50th.vercel.app";
    if (existingRow.reservation_type === "member" && existingRow.member_number) {
      lookupMember(existingRow.member_number)
        .then((m) => (m.valid && m.email?.trim() ? m.email.trim() : null))
        .then((email) => {
          if (!email) return;
          return sendCaretakerCheckInWelcomeEmail(
            email,
            caretaker.campName,
            existingRow.member_display_name || `#${existingRow.member_number}`,
            existingRow.check_in_date,
            existingRow.check_out_date
          );
        })
        .catch((e) => console.error("[caretaker] reservation check-in welcome email failed:", e));
    } else if (existingRow.reservation_type === "guest" && existingRow.guest_email) {
      sendCaretakerGuestCheckInWelcomeEmail(
        existingRow.guest_email,
        caretaker.campName,
        existingRow.guest_first_name || "Guest",
        existingRow.check_in_date,
        existingRow.check_out_date,
        baseUrl
      ).catch((e) => console.error("[caretaker] reservation check-in welcome email failed:", e));
    }
  }

  if (checkOutDateStr) {
    const checkIn = new Date(existingRow.check_in_date);
    const checkOut = new Date(checkOutDateStr);
    const newNights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (24 * 60 * 60 * 1000)));
    await sql`
      UPDATE camp_reservations
      SET check_out_date = ${checkOutDateStr}, nights = ${newNights}, updated_at = NOW()
      WHERE id = ${id}
    `;
  }
  if (setCheckIn) {
    await sql`
      UPDATE camp_reservations
      SET status = 'checked_in', checked_in_at = COALESCE(checked_in_at, NOW()), updated_at = NOW()
      WHERE id = ${id}
    `;
  }

  const updated = await sql`
    SELECT id, site_id, camp_slug, check_in_date, check_out_date, nights,
           reservation_type, member_contact_id, member_number, member_display_name,
           guest_first_name, guest_last_name, guest_email, guest_phone,
           status, checked_in_at, created_at, updated_at
    FROM camp_reservations WHERE id = ${id} LIMIT 1
  `;
  const row = (Array.isArray(updated) ? updated : [])[0] as ReservationRow | undefined;
  if (!row) return NextResponse.json({ ok: true, id });
  return NextResponse.json(rowToJson(row));
}

/**
 * DELETE /api/members/caretaker/reservations/[id]
 * Cancel reservation (set status = cancelled).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Reservation id required" }, { status: 400 });
  }

  const existing = await sql`
    SELECT id FROM camp_reservations
    WHERE id = ${id} AND camp_slug = ${caretaker.campSlug}
    LIMIT 1
  `;
  if (!Array.isArray(existing) || existing.length === 0) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  await sql`
    UPDATE camp_reservations
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = ${id}
  `;

  return NextResponse.json({ ok: true, cancelled: true });
}
