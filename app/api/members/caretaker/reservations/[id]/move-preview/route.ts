import { NextRequest, NextResponse } from "next/server";
import { getCaretakerWriteContextFromRequest } from "@/lib/caretaker-auth";
import { sql, hasDb } from "@/lib/db";
import {
  campUsesReservations,
  caretakerAllowsCashExistingReservationPayment,
  isNonBookableSite,
} from "@/lib/reservation-camps";
import { toDateOnlyStr } from "@/lib/reservation-dates";
import { computeStayPricing } from "@/lib/reservation-pricing";
import { getReservationBalance, siteRatesFromRow } from "@/lib/reservation-billing";
import { previewStayPaymentObligations } from "@/lib/reservation-balance-due";
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
  try {
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
          check_in_date: string | Date;
          check_out_date: string | Date;
          nights: number;
          reservation_type: string;
          status: string;
        }
      | undefined;
    if (!res) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    if (res.status === "cancelled") {
      return NextResponse.json({ error: "Cannot move a cancelled reservation" }, { status: 400 });
    }

    const checkInDate = toDateOnlyStr(res.check_in_date);
    const checkOutDate = toDateOnlyStr(res.check_out_date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkInDate) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOutDate)) {
      return NextResponse.json({ error: "Reservation has invalid dates" }, { status: 400 });
    }
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
          AND check_in_date < ${checkOutDate}::date
          AND check_out_date > ${checkInDate}::date
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
    const refundCents = balanceAfterMoveCents < 0 ? -balanceAfterMoveCents : 0;
    const obligations = previewStayPaymentObligations({
      checkInDate,
      checkOutDate,
      reservationType: res.reservation_type,
      rates,
      netPaidCents: totals.netPaidCents,
    });
    const additionalDueCents = obligations.payableNowCents;
    const { stripeRefundCents, cashRefundCents } = allocateRefundSplit(
      refundCents,
      totals.cardPaidCents,
      totals.refundedCents
    );

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
      payableNowCents: additionalDueCents,
      scheduledRemainingCents: obligations.scheduledRemainingCents,
      nextScheduledPayment: obligations.nextScheduledPayment,
      isLongTermMember: obligations.isLongTermMember,
      refundCents,
      refundBreakdown: { stripeRefundCents, cashRefundCents },
      cashAllowed: caretakerAllowsCashExistingReservationPayment(),
    });
  } catch (e) {
    console.error("[caretaker] move-preview error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not preview move" },
      { status: 500 }
    );
  }
}
