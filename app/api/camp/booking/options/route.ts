import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sql, hasDb } from "@/lib/db";
import { campUsesReservations } from "@/lib/reservation-camps";
import { getCampBySlug, getValidCampSlugs } from "@/lib/directory-camps";
import { verifySessionToken } from "@/lib/session";
import { lookupMember } from "@/lib/salesforce";
import { memberQualifiesForCampBooking } from "@/lib/reservation-member";
import { siteRatesFromRow } from "@/lib/reservation-billing";
import { campOpenSeasonSummary } from "@/lib/camp-seasons";
import {
  buildSiteTypeAvailability,
  computePublicPaymentOptions,
  firstBillingPeriodCents,
  type CampSiteRow,
  type ReservationStayRow,
  validatePublicBookingRequest,
} from "@/lib/public-camp-booking";

/**
 * GET /api/camp/booking/options?campSlug=...&checkIn=...&checkOut=...
 * Site types available for public booking with member/guest pricing.
 */
export async function GET(request: NextRequest) {
  if (!hasDb() || !sql) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  const campSlug = request.nextUrl.searchParams.get("campSlug")?.trim() ?? "";
  const checkIn = request.nextUrl.searchParams.get("checkIn")?.trim() ?? "";
  const checkOut = request.nextUrl.searchParams.get("checkOut")?.trim() ?? "";

  if (!campSlug || !getValidCampSlugs().includes(campSlug)) {
    return NextResponse.json({ error: "Valid campSlug required" }, { status: 400 });
  }
  if (!campUsesReservations(campSlug)) {
    return NextResponse.json({ error: "Online reservations are not available for this camp" }, { status: 403 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("member_session")?.value;
  const session = token ? await verifySessionToken(token) : null;
  let isMember = false;
  let memberDisplayName: string | null = null;
  if (session?.memberNumber) {
    try {
      const member = await lookupMember(session.memberNumber);
      if (memberQualifiesForCampBooking(member)) {
        isMember = true;
        memberDisplayName =
          [member.firstName, member.lastName].filter(Boolean).join(" ").trim() || null;
      }
    } catch {
      isMember = false;
    }
  }

  const validation = validatePublicBookingRequest({
    campSlug,
    checkIn,
    checkOut,
    reservationType: isMember ? "member" : "guest",
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const siteRows = await sql`
    SELECT id, name, site_code, site_type, special_type, sort_order,
           member_rate_daily, member_rate_monthly, non_member_rate_daily
    FROM camp_sites
    WHERE camp_slug = ${campSlug}
    ORDER BY sort_order ASC, name ASC
  `;
  const sites = (Array.isArray(siteRows) ? siteRows : []) as CampSiteRow[];

  const resRows = await sql`
    SELECT site_id, check_in_date, check_out_date
    FROM camp_reservations
    WHERE camp_slug = ${campSlug} AND status != 'cancelled'
      AND check_in_date < ${checkOut}::date
      AND check_out_date > ${checkIn}::date
  `;
  const reservations = (Array.isArray(resRows) ? resRows : []) as ReservationStayRow[];

  const siteTypes = buildSiteTypeAvailability({
    campSlug,
    checkIn,
    checkOut,
    sites,
    reservations,
  }).map((row) => {
    const rates = siteRatesFromRow({
      member_rate_daily: row.memberRateDaily,
      member_rate_monthly: row.memberRateMonthly,
      non_member_rate_daily: row.nonMemberRateDaily,
    });
    const memberFirstPeriod = firstBillingPeriodCents(checkIn, checkOut, true, rates);
    const paymentOptionsMember = computePublicPaymentOptions({
      totalCents: row.memberTotalCents,
      firstPeriodCents: memberFirstPeriod,
      usesMonthlyMemberRate: row.usesMonthlyMemberRate,
      isMember: true,
    });
    const paymentOptionsGuest = computePublicPaymentOptions({
      totalCents: row.guestTotalCents,
      firstPeriodCents: firstBillingPeriodCents(checkIn, checkOut, false, rates),
      usesMonthlyMemberRate: false,
      isMember: false,
    });

    return {
      ...row,
      paymentOptionsMember,
      paymentOptionsGuest,
    };
  });

  const camp = getCampBySlug(campSlug);

  return NextResponse.json({
    campSlug,
    campName: camp?.name ?? campSlug,
    checkIn,
    checkOut,
    nights: validation.nights,
    isMember,
    memberDisplayName,
    seasonNote: campOpenSeasonSummary(campSlug),
    siteTypes,
  });
}
