import { NextRequest, NextResponse } from "next/server";
import { getCaretakerAccess } from "@/lib/caretaker-auth";
import { hasDb } from "@/lib/db";
import { getValidCampSlugs } from "@/lib/directory-camps";
import { campUsesReservations } from "@/lib/reservation-camps";
import { isValidDateRange } from "@/lib/camp-capacity";
import { enumerateMonthRange, isIsoMonth } from "@/lib/director-season-totals";
import { listMonthlyBookingTotals } from "@/lib/director-season-totals-db";

/**
 * GET /api/members/caretaker/admin/monthly-bookings
 * New reservations by creation month and their site nights within a selected season.
 */
export async function GET(request: NextRequest) {
  const access = await getCaretakerAccess();
  if (!access || access.mode !== "admin") {
    return NextResponse.json({ error: "Caretaker admin access required" }, { status: 403 });
  }
  if (!hasDb()) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  const params = request.nextUrl.searchParams;
  const campSlug = params.get("campSlug")?.trim() ?? "";
  const seasonFrom = params.get("seasonFrom")?.trim() ?? "";
  const seasonTo = params.get("seasonTo")?.trim() ?? "";
  const bookingFrom = params.get("bookingFrom")?.trim() ?? "";
  const bookingTo = params.get("bookingTo")?.trim() ?? "";

  if (!campSlug || !getValidCampSlugs().includes(campSlug)) {
    return NextResponse.json({ error: "Valid campSlug required" }, { status: 400 });
  }
  if (!campUsesReservations(campSlug)) {
    return NextResponse.json(
      { error: "Reservation system not available for this camp" },
      { status: 403 }
    );
  }
  if (!isValidDateRange(seasonFrom, seasonTo)) {
    return NextResponse.json(
      { error: "Valid seasonFrom and seasonTo required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }
  const months = enumerateMonthRange(bookingFrom, bookingTo);
  if (!isIsoMonth(bookingFrom) || !isIsoMonth(bookingTo) || months.length === 0) {
    return NextResponse.json(
      { error: "Valid bookingFrom and bookingTo required (YYYY-MM)" },
      { status: 400 }
    );
  }
  if (months.length > 24) {
    return NextResponse.json(
      { error: "Booking month range cannot exceed 24 months" },
      { status: 400 }
    );
  }

  try {
    const totals = await listMonthlyBookingTotals({
      campSlug,
      seasonFrom,
      seasonTo,
      bookingFrom,
      bookingTo,
    });
    return NextResponse.json(
      { campSlug, seasonFrom, seasonTo, bookingFrom, bookingTo, totals },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[monthly-bookings GET]", error);
    const message = error instanceof Error ? error.message : "Failed to load monthly bookings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
