import { NextRequest, NextResponse } from "next/server";
import { getCaretakerContext, getCaretakerWriteContext } from "@/lib/caretaker-auth";
import { sql, hasDb } from "@/lib/db";
import { campUsesReservations, isNonBookableSite } from "@/lib/reservation-camps";
import { computeStayPricing } from "@/lib/reservation-pricing";
import { siteRatesFromRow } from "@/lib/reservation-billing";

/**
 * GET /api/members/caretaker/reservations/quote
 * Authoritative stay total for create-reservation UI (matches POST /reservations pricing).
 */
export async function GET(request: NextRequest) {
  const campSlugOverride = searchParams.get("campSlug")?.trim() || undefined;
  const caretaker = campSlugOverride
    ? await getCaretakerWriteContext(campSlugOverride)
    : await getCaretakerContext();
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
  const siteId = searchParams.get("siteId")?.trim() ?? "";
  const checkInDate = searchParams.get("checkInDate")?.trim() ?? "";
  const checkOutDate = searchParams.get("checkOutDate")?.trim() ?? "";
  const type = searchParams.get("type") === "guest" ? "guest" : "member";

  if (!siteId || !/^\d{4}-\d{2}-\d{2}$/.test(checkInDate) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOutDate)) {
    return NextResponse.json(
      { error: "siteId, checkInDate, checkOutDate required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }
  if (checkInDate >= checkOutDate) {
    return NextResponse.json({ error: "checkOutDate must be after checkInDate" }, { status: 400 });
  }

  const siteRows = await sql`
    SELECT id, name, site_code, member_rate_daily, member_rate_monthly, non_member_rate_daily
    FROM camp_sites
    WHERE id = ${siteId} AND camp_slug = ${caretaker.campSlug}
    LIMIT 1
  `;
  const siteRow = (Array.isArray(siteRows) ? siteRows : [])[0] as
    | {
        id: string;
        name: string;
        site_code: string | null;
        member_rate_daily: number | string | null;
        member_rate_monthly: number | string | null;
        non_member_rate_daily: number | string | null;
      }
    | undefined;

  if (!siteRow) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }
  if (isNonBookableSite(caretaker.campSlug, siteRow.name, siteRow.site_code)) {
    return NextResponse.json({ error: "This site cannot be booked" }, { status: 400 });
  }

  const rates = siteRatesFromRow(siteRow);
  const pricing = computeStayPricing({
    checkInDate,
    checkOutDate,
    isMember: type === "member",
    rates,
  });

  return NextResponse.json({
    nights: pricing.totalNights,
    calculatedTotalCents: pricing.totalCents,
    pricingBasis: pricing.pricingBasis,
    rates: {
      memberRateDaily: rates.memberRateDaily,
      memberRateMonthly: rates.memberRateMonthly,
      nonMemberRateDaily: rates.nonMemberRateDaily,
    },
  });
}
