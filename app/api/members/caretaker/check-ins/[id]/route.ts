import { NextRequest, NextResponse } from "next/server";
import { getCaretakerContext } from "@/lib/caretaker-auth";
import { sql, hasDb } from "@/lib/db";
import { adjustPointsForCaretakerCheckIn } from "@/lib/rewards";
import { POINTS } from "@/lib/rewards";

type CheckInRow = {
  id: string;
  camp_slug: string;
  member_contact_id: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  points_awarded: number;
};

/**
 * PATCH /api/members/caretaker/check-ins/[id]
 * Body: { checkOutDate: "YYYY-MM-DD" }
 * Update checkout date; recalc nights and adjust points (50 per night delta).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caretaker = await getCaretakerContext();
  if (!caretaker) {
    return NextResponse.json({ error: "Caretaker access required" }, { status: 403 });
  }
  if (!hasDb() || !sql) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Check-in id required" }, { status: 400 });
  }

  let body: { checkOutDate?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const checkOutDateRaw = typeof body.checkOutDate === "string" ? body.checkOutDate.trim() : "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(checkOutDateRaw);
  if (!match) {
    return NextResponse.json({ error: "checkOutDate required (YYYY-MM-DD)" }, { status: 400 });
  }
  const checkOutDateStr = checkOutDateRaw;

  const existing = await sql`
    SELECT id, camp_slug, member_contact_id, check_in_date, check_out_date, nights, points_awarded
    FROM caretaker_check_ins
    WHERE id = ${id} AND camp_slug = ${caretaker.campSlug}
    LIMIT 1
  `;
  const existingArr = Array.isArray(existing) ? existing : [];
  const existingRow = existingArr[0] as CheckInRow | undefined;
  if (!existingRow) {
    return NextResponse.json({ error: "Check-in not found" }, { status: 404 });
  }

  const checkInDateStr = existingRow.check_in_date;
  if (checkOutDateStr <= checkInDateStr) {
    return NextResponse.json(
      { error: "Check-out date must be after check-in date" },
      { status: 400 }
    );
  }

  const checkIn = new Date(checkInDateStr);
  const checkOut = new Date(checkOutDateStr);
  const newNights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (24 * 60 * 60 * 1000)));
  const oldNights = existingRow.nights;
  const nightsDelta = newNights - oldNights;
  const pointsDelta = nightsDelta * POINTS.caretaker_check_in_per_night;

  await sql`
    UPDATE caretaker_check_ins
    SET check_out_date = ${checkOutDateStr}, nights = ${newNights},
        points_awarded = ${newNights * POINTS.caretaker_check_in_per_night},
        updated_at = NOW()
    WHERE id = ${id}
  `;

  if (pointsDelta !== 0) {
    adjustPointsForCaretakerCheckIn(existingRow.member_contact_id, pointsDelta, id).catch((e) =>
      console.error("[caretaker] adjust points failed:", e)
    );
  }

  const updated = await sql`
    SELECT id, camp_slug, member_contact_id, member_number, member_display_name,
           check_in_date, check_out_date, nights, points_awarded,
           created_by_contact_id, created_at, updated_at
    FROM caretaker_check_ins WHERE id = ${id} LIMIT 1
  `;
  const updatedArr = Array.isArray(updated) ? updated : [];
  const row = updatedArr[0] as
    | {
        id: string;
        camp_slug: string;
        member_contact_id: string;
        member_number: string;
        member_display_name: string | null;
        check_in_date: string;
        check_out_date: string;
        nights: number;
        points_awarded: number;
        created_at: string;
        updated_at: string;
      }
    | undefined;
  if (!row) {
    return NextResponse.json({ ok: true, id });
  }

  return NextResponse.json({
    id: row.id,
    campSlug: row.camp_slug,
    memberContactId: row.member_contact_id,
    memberNumber: row.member_number,
    memberDisplayName: row.member_display_name,
    checkInDate: row.check_in_date,
    checkOutDate: row.check_out_date,
    nights: row.nights,
    pointsAwarded: row.points_awarded,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

/**
 * DELETE /api/members/caretaker/check-ins/[id]
 * Cancel reservation: deduct points and set check-out to yesterday so it moves to archives.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caretaker = await getCaretakerContext();
  if (!caretaker) {
    return NextResponse.json({ error: "Caretaker access required" }, { status: 403 });
  }
  if (!hasDb() || !sql) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Check-in id required" }, { status: 400 });
  }

  const existing = await sql`
    SELECT id, camp_slug, member_contact_id, check_in_date, points_awarded
    FROM caretaker_check_ins
    WHERE id = ${id} AND camp_slug = ${caretaker.campSlug}
    LIMIT 1
  `;
  const existingArr = Array.isArray(existing) ? existing : [];
  const existingRow = existingArr[0] as CheckInRow | undefined;
  if (!existingRow) {
    return NextResponse.json({ error: "Check-in not found" }, { status: 404 });
  }

  const pointsToDeduct = existingRow.points_awarded ?? 0;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (pointsToDeduct > 0) {
    adjustPointsForCaretakerCheckIn(
      existingRow.member_contact_id,
      -pointsToDeduct,
      id
    ).catch((e) => console.error("[caretaker] cancel deduct points failed:", e));
  }

  await sql`
    UPDATE caretaker_check_ins
    SET check_out_date = ${yesterdayStr}, nights = 0, points_awarded = 0, updated_at = NOW()
    WHERE id = ${id}
  `;

  return NextResponse.json({ ok: true, cancelled: true });
}
