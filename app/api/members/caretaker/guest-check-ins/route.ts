import { NextRequest, NextResponse } from "next/server";
import { getCaretakerContext } from "@/lib/caretaker-auth";
import { sql, hasDb } from "@/lib/db";
import { getValidCampSlugs } from "@/lib/caretaker-camps";
import { sendCaretakerGuestCheckInWelcomeEmail } from "@/lib/sendgrid";

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
  created_by_contact_id: string;
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
 * GET /api/members/caretaker/guest-check-ins?status=active|archived|all
 * List guest check-ins for the caretaker's camp.
 */
export async function GET(request: NextRequest) {
  const caretaker = await getCaretakerContext();
  if (!caretaker) {
    return NextResponse.json({ error: "Caretaker access required" }, { status: 403 });
  }
  if (!hasDb() || !sql) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "active";
  const today = new Date().toISOString().slice(0, 10);

  let rows: GuestCheckInRow[];
  if (status === "active") {
    const r = await sql`
      SELECT id, camp_slug, first_name, last_name, email, phone,
             check_in_date, check_out_date, nights,
             created_by_contact_id, created_at, updated_at
      FROM caretaker_guest_check_ins
      WHERE camp_slug = ${caretaker.campSlug} AND check_out_date >= ${today}
      ORDER BY check_in_date DESC, created_at DESC
    `;
    rows = (Array.isArray(r) ? r : []) as GuestCheckInRow[];
  } else if (status === "archived") {
    const r = await sql`
      SELECT id, camp_slug, first_name, last_name, email, phone,
             check_in_date, check_out_date, nights,
             created_by_contact_id, created_at, updated_at
      FROM caretaker_guest_check_ins
      WHERE camp_slug = ${caretaker.campSlug} AND check_out_date < ${today}
      ORDER BY check_out_date DESC, created_at DESC
    `;
    rows = (Array.isArray(r) ? r : []) as GuestCheckInRow[];
  } else {
    const r = await sql`
      SELECT id, camp_slug, first_name, last_name, email, phone,
             check_in_date, check_out_date, nights,
             created_by_contact_id, created_at, updated_at
      FROM caretaker_guest_check_ins
      WHERE camp_slug = ${caretaker.campSlug}
      ORDER BY check_out_date DESC, created_at DESC
    `;
    rows = (Array.isArray(r) ? r : []) as GuestCheckInRow[];
  }

  return NextResponse.json({ checkIns: rows.map(rowToJson) });
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/members/caretaker/guest-check-ins
 * Body: { firstName, lastName, email, phone?, nights? }
 * Create guest check-in (check-in date = today), send guest welcome email.
 */
export async function POST(request: NextRequest) {
  const caretaker = await getCaretakerContext();
  if (!caretaker) {
    return NextResponse.json({ error: "Caretaker access required" }, { status: 403 });
  }
  if (!hasDb() || !sql) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  if (!getValidCampSlugs().includes(caretaker.campSlug)) {
    return NextResponse.json({ error: "Invalid camp" }, { status: 400 });
  }

  let body: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    nights?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
  const nights = typeof body.nights === "number" ? Math.max(1, Math.min(365, Math.floor(body.nights))) : 1;

  if (!firstName || !lastName) {
    return NextResponse.json({ error: "First name and last name required" }, { status: 400 });
  }
  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const checkInDate = new Date();
  checkInDate.setHours(0, 0, 0, 0);
  const checkOutDate = new Date(checkInDate);
  checkOutDate.setDate(checkOutDate.getDate() + nights);

  const checkInDateStr = checkInDate.toISOString().slice(0, 10);
  const checkOutDateStr = checkOutDate.toISOString().slice(0, 10);

  const inserted = await sql`
    INSERT INTO caretaker_guest_check_ins (
      camp_slug, first_name, last_name, email, phone,
      check_in_date, check_out_date, nights, created_by_contact_id
    )
    VALUES (
      ${caretaker.campSlug}, ${firstName}, ${lastName}, ${email}, ${phone},
      ${checkInDateStr}, ${checkOutDateStr}, ${nights}, ${caretaker.contactId}
    )
    RETURNING id, camp_slug, first_name, last_name, email, phone,
              check_in_date, check_out_date, nights,
              created_by_contact_id, created_at, updated_at
  `;
  const arr = Array.isArray(inserted) ? inserted : [];
  const row = arr[0] as GuestCheckInRow | undefined;
  if (!row) {
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ldma-50th.vercel.app";
  sendCaretakerGuestCheckInWelcomeEmail(
    email,
    caretaker.campName,
    firstName,
    checkInDateStr,
    checkOutDateStr,
    baseUrl
  ).catch((e) => console.error("[caretaker] guest welcome email failed:", e));

  return NextResponse.json(rowToJson(row), { status: 201 });
}
