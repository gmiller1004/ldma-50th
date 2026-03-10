import { NextRequest, NextResponse } from "next/server";
import { getCaretakerContext } from "@/lib/caretaker-auth";
import { sql, hasDb } from "@/lib/db";

type GuestCheckInRow = {
  id: string;
  camp_slug: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  created_at: string;
  updated_at: string;
};

function rowToJson(row: GuestCheckInRow) {
  return {
    id: row.id,
    campSlug: row.camp_slug,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    checkInDate: row.check_in_date,
    checkOutDate: row.check_out_date,
    nights: row.nights,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * PATCH /api/members/caretaker/guest-check-ins/[id]
 * Body: { checkOutDate: "YYYY-MM-DD" }
 * Update guest checkout date; recalc nights.
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
    SELECT id, camp_slug, check_in_date, check_out_date, nights
    FROM caretaker_guest_check_ins
    WHERE id = ${id} AND camp_slug = ${caretaker.campSlug}
    LIMIT 1
  `;
  const existingArr = Array.isArray(existing) ? existing : [];
  const existingRow = existingArr[0] as { check_in_date: string } | undefined;
  if (!existingRow) {
    return NextResponse.json({ error: "Guest check-in not found" }, { status: 404 });
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

  await sql`
    UPDATE caretaker_guest_check_ins
    SET check_out_date = ${checkOutDateStr}, nights = ${newNights}, updated_at = NOW()
    WHERE id = ${id}
  `;

  const updated = await sql`
    SELECT id, camp_slug, first_name, last_name, email, phone,
           check_in_date, check_out_date, nights, created_at, updated_at
    FROM caretaker_guest_check_ins WHERE id = ${id} LIMIT 1
  `;
  const updatedArr = Array.isArray(updated) ? updated : [];
  const row = updatedArr[0] as GuestCheckInRow | undefined;
  if (!row) {
    return NextResponse.json({ ok: true, id });
  }

  return NextResponse.json(rowToJson(row));
}

/**
 * DELETE /api/members/caretaker/guest-check-ins/[id]
 * Cancel guest reservation: set check-out to yesterday so it moves to archives.
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
    SELECT id FROM caretaker_guest_check_ins
    WHERE id = ${id} AND camp_slug = ${caretaker.campSlug}
    LIMIT 1
  `;
  const existingArr = Array.isArray(existing) ? existing : [];
  if (existingArr.length === 0) {
    return NextResponse.json({ error: "Guest check-in not found" }, { status: 404 });
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  await sql`
    UPDATE caretaker_guest_check_ins
    SET check_out_date = ${yesterdayStr}, nights = 0, updated_at = NOW()
    WHERE id = ${id}
  `;

  return NextResponse.json({ ok: true, cancelled: true });
}
