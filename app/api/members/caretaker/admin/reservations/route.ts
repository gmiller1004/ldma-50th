import { NextRequest, NextResponse } from "next/server";
import { getCaretakerAccess } from "@/lib/caretaker-auth";
import { getValidCampSlugs } from "@/lib/directory-camps";
import { sql, hasDb } from "@/lib/db";
import { summarizeReservationBalances } from "@/lib/reservation-billing";

type ReservationRow = {
  id: string;
  site_name: string | null;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  reservation_type: string;
  member_display_name: string | null;
  member_number: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  guest_email: string | null;
  status: string;
  checked_in_at: string | null;
  created_at: string;
  invoice_number: string | null;
  cancellation_fee_waived?: boolean | null;
  cancellation_fee_waived_cents?: number | null;
};

function rowToJson(row: ReservationRow) {
  return {
    id: row.id,
    siteName: row.site_name,
    checkInDate: row.check_in_date,
    checkOutDate: row.check_out_date,
    nights: row.nights,
    reservationType: row.reservation_type,
    memberDisplayName: row.member_display_name,
    memberNumber: row.member_number,
    guestFirstName: row.guest_first_name,
    guestLastName: row.guest_last_name,
    guestEmail: row.guest_email,
    status: row.status,
    checkedInAt: row.checked_in_at,
    createdAt: row.created_at,
    invoiceNumber: row.invoice_number,
    cancellationFeeWaived: Boolean(row.cancellation_fee_waived),
    cancellationFeeWaivedCents: row.cancellation_fee_waived_cents ?? null,
  };
}

/**
 * GET /api/members/caretaker/admin/reservations?campSlug=
 * List reservations for a camp (director dashboard).
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
    return NextResponse.json({ error: "Valid campSlug required" }, { status: 400 });
  }

  const rows = await sql`
    SELECT r.id, s.name AS site_name, r.check_in_date, r.check_out_date, r.nights,
           r.reservation_type, r.member_display_name, r.member_number,
           r.guest_first_name, r.guest_last_name, r.guest_email,
           r.status, r.checked_in_at, r.created_at, r.invoice_number,
           r.cancellation_fee_waived, r.cancellation_fee_waived_cents
    FROM camp_reservations r
    LEFT JOIN camp_sites s ON s.id = r.site_id
    WHERE r.camp_slug = ${campSlug}
    ORDER BY r.check_out_date DESC, r.created_at DESC
    LIMIT 300
  `;
  const list = (Array.isArray(rows) ? rows : []) as ReservationRow[];
  const balanceMap = await summarizeReservationBalances(list.map((r) => r.id));

  return NextResponse.json({
    reservations: list.map((row) => {
      const balance = balanceMap.get(row.id);
      return {
        ...rowToJson(row),
        balanceDueCents: balance?.balanceDueCents ?? 0,
        siteFeesPaidCents: balance?.totalPaidCents ?? 0,
        siteFeesDueCents: balance?.totalDueCents ?? 0,
        hasOverdueSiteFee: balance?.hasOverduePeriod ?? false,
        nextSiteFeeDueDate: balance?.nextDueDate ?? null,
      };
    }),
  });
}

/**
 * POST /api/members/caretaker/admin/reservations
 * Manual reservation create for any camp (admin). Body: campSlug + same fields as caretaker create.
 */
export async function POST(request: NextRequest) {
  const access = await getCaretakerAccess();
  if (!access || access.mode !== "admin") {
    return NextResponse.json({ error: "Caretaker admin access required" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const campSlug = typeof body.campSlug === "string" ? body.campSlug.trim() : "";
  if (!campSlug || !getValidCampSlugs().includes(campSlug)) {
    return NextResponse.json({ error: "Valid campSlug required" }, { status: 400 });
  }

  const origin = request.nextUrl.origin;
  const res = await fetch(`${origin}/api/members/caretaker/reservations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: request.headers.get("cookie") ?? "",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
