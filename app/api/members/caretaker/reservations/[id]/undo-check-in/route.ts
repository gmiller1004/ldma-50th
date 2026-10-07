import { NextRequest, NextResponse } from "next/server";
import { getCaretakerWriteContextFromRequest } from "@/lib/caretaker-auth";
import { sql, hasDb } from "@/lib/db";
import { campUsesReservations } from "@/lib/reservation-camps";

/**
 * POST /api/members/caretaker/reservations/[id]/undo-check-in
 * Reverse a check-in recorded by mistake (camper hasn't arrived). Billing is unchanged; check-in
 * points are keyed to the reservation, so checking in again later does not award them twice.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caretaker = await getCaretakerWriteContextFromRequest(request);
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
  const rows = await sql`
    UPDATE camp_reservations
    SET status = 'reserved', checked_in_at = NULL, updated_at = NOW()
    WHERE id = ${id} AND camp_slug = ${caretaker.campSlug} AND status = 'checked_in'
    RETURNING id
  `;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "Reservation not found or not checked in" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, id });
}
