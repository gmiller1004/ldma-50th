import { NextRequest, NextResponse } from "next/server";
import { getCaretakerWriteContextFromRequest } from "@/lib/caretaker-auth";
import { sql, hasDb } from "@/lib/db";
import {
  campUsesReservations,
  caretakerAllowsCashExistingReservationPayment,
} from "@/lib/reservation-camps";
import { toDateOnlyStr } from "@/lib/reservation-dates";
import { computeStayPricing } from "@/lib/reservation-pricing";
import { getReservationBalance, siteRatesFromRow } from "@/lib/reservation-billing";
import { previewStayPaymentObligations } from "@/lib/reservation-balance-due";
import {
  allocateRefundSplit,
  getReservationSiteFeeTotals,
} from "@/lib/reservation-refund";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/members/caretaker/reservations/[id]/edit-preview?checkInDate=&checkOutDate=
 * Preview date-change rerate: new nights/total, amount due now or leftover credit (no auto-refund).
 * Long-term members are only asked for payable-now (first month / due periods), not full stay.
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
    const checkInDate = request.nextUrl.searchParams.get("checkInDate")?.trim() ?? "";
    const checkOutDate = request.nextUrl.searchParams.get("checkOutDate")?.trim() ?? "";
    if (!DATE_REGEX.test(checkInDate) || !DATE_REGEX.test(checkOutDate)) {
      return NextResponse.json(
        { error: "checkInDate and checkOutDate required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }
    if (checkInDate >= checkOutDate) {
      return NextResponse.json({ error: "Check-out date must be after check-in date" }, { status: 400 });
    }

    const resRows = await sql`
      SELECT r.id, r.site_id, r.check_in_date, r.check_out_date, r.nights, r.reservation_type, r.status,
             s.member_rate_daily, s.member_rate_monthly, s.non_member_rate_daily
      FROM camp_reservations r
      JOIN camp_sites s ON s.id = r.site_id
      WHERE r.id = ${id} AND r.camp_slug = ${caretaker.campSlug}
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
          member_rate_daily: number | string | null;
          member_rate_monthly: number | string | null;
          non_member_rate_daily: number | string | null;
        }
      | undefined;
    if (!res) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    if (res.status === "cancelled") {
      return NextResponse.json({ error: "Cannot edit a cancelled reservation" }, { status: 400 });
    }

    const currentCheckIn = toDateOnlyStr(res.check_in_date);
    const currentCheckOut = toDateOnlyStr(res.check_out_date);
    const isMember = res.reservation_type === "member";
    const rates = siteRatesFromRow(res);

    const overlap = await sql`
      SELECT id FROM camp_reservations
      WHERE site_id = ${res.site_id}
        AND id != ${id}
        AND status != 'cancelled'
        AND check_in_date < ${checkOutDate}::date
        AND check_out_date > ${checkInDate}::date
      LIMIT 1
    `;
    const available = !(Array.isArray(overlap) && overlap.length > 0);

    const currentPricing = computeStayPricing({
      checkInDate: currentCheckIn,
      checkOutDate: currentCheckOut,
      isMember,
      rates,
    });
    const proposedPricing = computeStayPricing({
      checkInDate,
      checkOutDate,
      isMember,
      rates,
    });

    const currentBalance = await getReservationBalance(id);
    const totals = await getReservationSiteFeeTotals(id);
    const proposedTotalCents = proposedPricing.totalCents;
    const balanceAfter = proposedTotalCents - totals.netPaidCents;
    const creditCents = balanceAfter < 0 ? -balanceAfter : 0;
    const obligations = previewStayPaymentObligations({
      checkInDate,
      checkOutDate,
      reservationType: res.reservation_type,
      rates,
      netPaidCents: totals.netPaidCents,
    });
    const additionalDueCents = obligations.payableNowCents;
    const { stripeRefundCents, cashRefundCents } = allocateRefundSplit(
      creditCents,
      totals.cardPaidCents,
      totals.refundedCents
    );

    const datesUnchanged = checkInDate === currentCheckIn && checkOutDate === currentCheckOut;

    return NextResponse.json({
      reservationId: id,
      available,
      datesUnchanged,
      current: {
        checkInDate: currentCheckIn,
        checkOutDate: currentCheckOut,
        nights: currentPricing.totalNights,
        totalCents: currentBalance.totalDueCents,
        calculatedTotalCents: currentPricing.totalCents,
        pricingBasis: currentPricing.pricingBasis,
      },
      proposed: {
        checkInDate,
        checkOutDate,
        nights: proposedPricing.totalNights,
        totalCents: proposedTotalCents,
        pricingBasis: proposedPricing.pricingBasis,
      },
      netPaidCents: totals.netPaidCents,
      additionalDueCents,
      payableNowCents: additionalDueCents,
      scheduledRemainingCents: obligations.scheduledRemainingCents,
      nextScheduledPayment: obligations.nextScheduledPayment,
      isLongTermMember: obligations.isLongTermMember,
      creditCents,
      refundBreakdown: { stripeRefundCents, cashRefundCents },
      issuesRefund: false,
      cashAllowed: caretakerAllowsCashExistingReservationPayment(),
    });
  } catch (e) {
    console.error("[caretaker] edit-preview error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not preview date change" },
      { status: 500 }
    );
  }
}
