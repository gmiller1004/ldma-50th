import { NextRequest, NextResponse } from "next/server";
import { getCaretakerContext } from "@/lib/caretaker-auth";
import { sql, hasDb } from "@/lib/db";
import { awardPointsForCaretakerCheckIn } from "@/lib/rewards";
import { getValidCampSlugs } from "@/lib/caretaker-camps";
import { lookupMember } from "@/lib/salesforce";
import { sendCaretakerCheckInWelcomeEmail } from "@/lib/sendgrid";
import { upsertCampStayProfile } from "@/lib/klaviyo-camp-stay";

type CheckInRow = {
  id: string;
  camp_slug: string;
  member_contact_id: string;
  member_number: string;
  member_display_name: string | null;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  points_awarded: number;
  created_by_contact_id: string;
  created_at: string;
  updated_at: string;
};

function rowToJson(row: CheckInRow) {
  return {
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
  };
}

/**
 * GET /api/members/caretaker/check-ins?status=active|archived|all
 * List check-ins for the caretaker's camp.
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

  let rows: CheckInRow[];
  if (status === "active") {
    const r = await sql`
      SELECT id, camp_slug, member_contact_id, member_number, member_display_name,
             check_in_date, check_out_date, nights, points_awarded,
             created_by_contact_id, created_at, updated_at
      FROM caretaker_check_ins
      WHERE camp_slug = ${caretaker.campSlug} AND check_out_date >= ${today}
      ORDER BY check_in_date DESC, created_at DESC
    `;
    rows = (Array.isArray(r) ? r : []) as CheckInRow[];
  } else if (status === "archived") {
    const r = await sql`
      SELECT id, camp_slug, member_contact_id, member_number, member_display_name,
             check_in_date, check_out_date, nights, points_awarded,
             created_by_contact_id, created_at, updated_at
      FROM caretaker_check_ins
      WHERE camp_slug = ${caretaker.campSlug} AND check_out_date < ${today}
      ORDER BY check_out_date DESC, created_at DESC
    `;
    rows = (Array.isArray(r) ? r : []) as CheckInRow[];
  } else {
    const r = await sql`
      SELECT id, camp_slug, member_contact_id, member_number, member_display_name,
             check_in_date, check_out_date, nights, points_awarded,
             created_by_contact_id, created_at, updated_at
      FROM caretaker_check_ins
      WHERE camp_slug = ${caretaker.campSlug}
      ORDER BY check_out_date DESC, created_at DESC
    `;
    rows = (Array.isArray(r) ? r : []) as CheckInRow[];
  }

  return NextResponse.json({ checkIns: rows.map(rowToJson) });
}

/**
 * POST /api/members/caretaker/check-ins
 * Body: { memberContactId, memberNumber, memberDisplayName, nights }
 * Create check-in (check-in date = today), award 50 pts per night.
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

  let body: { memberContactId?: string; memberNumber?: string; memberDisplayName?: string; nights?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const memberContactId = typeof body.memberContactId === "string" ? body.memberContactId.trim() : "";
  const memberNumber = typeof body.memberNumber === "string" ? body.memberNumber.trim() : "";
  const memberDisplayName = typeof body.memberDisplayName === "string" ? body.memberDisplayName.trim() : null;
  const nights = typeof body.nights === "number" ? Math.max(1, Math.min(365, Math.floor(body.nights))) : 1;

  if (!memberContactId || !memberNumber) {
    return NextResponse.json({ error: "memberContactId and memberNumber required" }, { status: 400 });
  }

  const checkInDate = new Date();
  checkInDate.setHours(0, 0, 0, 0);
  const checkOutDate = new Date(checkInDate);
  checkOutDate.setDate(checkOutDate.getDate() + nights);

  const checkInDateStr = checkInDate.toISOString().slice(0, 10);
  const checkOutDateStr = checkOutDate.toISOString().slice(0, 10);
  const pointsAwarded = nights * 50;

  const inserted = await sql`
    INSERT INTO caretaker_check_ins (
      camp_slug, member_contact_id, member_number, member_display_name,
      check_in_date, check_out_date, nights, points_awarded, created_by_contact_id
    )
    VALUES (
      ${caretaker.campSlug}, ${memberContactId}, ${memberNumber}, ${memberDisplayName},
      ${checkInDateStr}, ${checkOutDateStr}, ${nights}, ${pointsAwarded}, ${caretaker.contactId}
    )
    RETURNING id, camp_slug, member_contact_id, member_number, member_display_name,
              check_in_date, check_out_date, nights, points_awarded,
              created_by_contact_id, created_at, updated_at
  `;
  const arr = Array.isArray(inserted) ? inserted : [];
  const row = arr[0] as CheckInRow | undefined;
  if (!row) {
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }

  awardPointsForCaretakerCheckIn(memberContactId, nights, row.id).catch((e) =>
    console.error("[caretaker] award points failed:", e)
  );

  // Send welcome email and sync to Klaviyo (fire-and-forget)
  const todayStr = new Date().toISOString().slice(0, 10);
  const stayStatus = checkOutDateStr >= todayStr ? "in_progress" : "completed";
  lookupMember(memberNumber)
    .then(async (member) => {
      const email = member.valid && member.email && member.email.trim() ? member.email.trim() : null;
      if (!email) return;
      const displayName = memberDisplayName || `#${memberNumber}`;
      await sendCaretakerCheckInWelcomeEmail(
        email,
        caretaker.campName,
        displayName,
        checkInDateStr,
        checkOutDateStr
      );
      await upsertCampStayProfile({
        email,
        firstName: member.firstName ?? undefined,
        lastName: member.lastName ?? undefined,
        campSlug: caretaker.campSlug,
        checkOutDate: checkOutDateStr,
        status: stayStatus,
        lastStayAs: "member",
      });
    })
    .catch((e) => console.error("[caretaker] welcome email / Klaviyo sync failed:", e));

  return NextResponse.json(rowToJson(row), { status: 201 });
}
