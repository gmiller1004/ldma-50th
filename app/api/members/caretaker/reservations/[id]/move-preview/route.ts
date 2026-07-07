import { NextRequest, NextResponse } from "next/server";
import { getCaretakerWriteContextFromRequest } from "@/lib/caretaker-auth";
import { sql, hasDb } from "@/lib/db";
import {
  campUsesReservations,
  caretakerAllowsCashCheckIn,
  isNonBookableSite,
} from "@/lib/reservation-camps";
import { computeStayPricing } from "@/lib/reservation-pricing";
import { getReservationBalance, siteRatesFromRow } from "@/lib/reservation-billing";
import {
  allocateRefundSplit,
  getReservationSiteFeeTotals,
} from "@/lib/reservation-refund";

/**
 * GET /api/members/caretaker/reservations/[id]/move-preview?newSiteId=...&campSlug=...
 * Preview moving a reservation to a different site: availability + price difference.
 */
export async function GET(
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
  const newSiteId = request.nextUrl.searchParams.get("newSiteId")?.trim() ?? "";
  if (!newSiteId) {
    return NextResponse.json({ error: "newSiteId is required" }, { status: 400 });
  }

  const resRows = await sql`
    SELECT id, site_id, check_in_date, check_out_date, nights, reservation_type, status
    FROM camp_reservations
    WHERE id = ${id} AND camp_slug = ${caretaker.campSlug}
    LIMIT 1
  `;
  const res = (Array.isArray(resRows) ? resRows[0] : undefined) as
    | {
        id: string;
        site_id: string;
        check_in_date: string;
        check_out_date: string;
        nights: number;
        reservation_type: string;
        status: string;
      }
    | undefined;
  if (!res) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  if (res.status === "cancelled") {
    return NextResponse.json({ error: "Cannot move a cancelled reservation" }, { status: 400 });
  }

  const checkInDate = String(res.check_in_date).slice(0, 10);
  const checkOutDate = String(res.check_out_date).slice(0, 10);
  const isMember = res.reservation_type === "member";

  const siteRows = await sql`
    SELECT id, name, site_code, member_rate_daily, member_rate_monthly, non_member_rate_daily
    FROM camp_sites
    WHERE id = ${newSiteId} AND camp_slug = ${caretaker.campSlug}
    LIMIT 1
  `;
  const newSite = (Array.isArray(siteRows) ? siteRows[0] : undefined) as
    | {
        id: string;
        name: string;
        site_code: string | null;
        member_rate_daily: number | string | null;
        member_rate_monthly: number | string | null;
        non_member_rate_daily: number | string | null;
      }
    | undefined;
  if (!newSite) return NextResponse.json({ error: "Destination site not found" }, { status: 404 });
  if (isNonBookableSite(caretaker.campSlug, newSite.name, newSite.site_code)) {
    return NextResponse.json({ error: "Destination site cannot be booked" }, { status: 400 });
  }

  const sameSite = newSite.id === res.site_id;

  let available = true;
  if (!sameSite) {
    const overlap = await sql`
      SELECT id FROM camp_reservations
      WHERE site_id = ${newSiteId}
        AND id != ${id}
        AND status != 'cancelled'
        AND check_in_date < ${checkOutDate}
        AND check_out_date > ${checkInDate}
      LIMIT 1
    `;
    available = !(Array.isArray(overlap) && overlap.length > 0);
  }

  const rates = siteRatesFromRow(newSite);
  const pricing = computeStayPricing({ checkInDate, checkOutDate, isMember, rates });
  const newTotalCents = pricing.totalCents;

  const currentBalance = await getReservationBalance(id);
  const totals = await getReservationSiteFeeTotals(id);

  const balanceAfterMoveCents = newTotalCents - totals.netPaidCents;
  const additionalDueCents = balanceAfterMoveCents > 0 ? balanceAfterMoveCents : 0;
  const refundCents = balanceAfterMoveCents < 0 ? -balanceAfterMoveCents : 0;
  const { stripeRefundCents, cashRefundCents } = allocateRefundSplit(
    refundCents,
    totals.cardPaidCents,
    totals.refundedCents
  );

  const today = new Date().toISOString().slice(0, 10);

  return NextResponse.json({
    reservationId: id,
    currentSiteId: res.site_id,
    newSiteId: newSite.id,
    newSiteName: newSite.name,
    sameSite,
    available,
    checkInDate,
    checkOutDate,
    nights: pricing.totalNights,
    currentTotalCents: currentBalance.totalDueCents,
    newTotalCents,
    netPaidCents: totals.netPaidCents,
    additionalDueCents,
    refundCents,
    refundBreakdown: { stripeRefundCents, cashRefundCents },
    cashAllowed: caretakerAllowsCashCheckIn(checkInDate, today),
  });
}
