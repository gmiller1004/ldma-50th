import { NextRequest, NextResponse } from "next/server";
import { sql, hasDb } from "@/lib/db";
import { getCampBySlug } from "@/lib/directory-camps";
import { listBillingPeriods } from "@/lib/reservation-billing";
import { lookupMember } from "@/lib/salesforce";
import {
  caretakerAdminReservationsUrl,
  getReservationMrsNotifyEmail,
} from "@/lib/reservation-notify";
import { fetchUpcomingBalanceDueReservations } from "@/lib/reservation-balance-reminders";
import { formatSiteAssignmentLabel, PUBLIC_BOOKING_IMPORT_SOURCE, type CampSiteRow } from "@/lib/public-camp-booking";
import { summarizeReservationPaymentObligations } from "@/lib/reservation-balance-due";
import {
  sendMrsReservationDigestEmail,
  type MrsDigestBalanceDue,
  type MrsDigestNewBooking,
} from "@/lib/sendgrid";

/**
 * GET /api/cron/mrs-reservation-digest
 * Daily digest for Member Relations: new web bookings + balances due within 7 days.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasDb() || !sql) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  const newRows = await sql`
    SELECT r.id, r.camp_slug, r.check_in_date, r.check_out_date, r.reservation_type,
           r.member_display_name, r.member_number, r.guest_email, r.guest_first_name, r.guest_last_name,
           r.booked_site_type_label,
           s.site_code, s.name AS site_name, s.site_type, s.special_type
    FROM camp_reservations r
    JOIN camp_sites s ON s.id = r.site_id
    WHERE r.import_source = ${PUBLIC_BOOKING_IMPORT_SOURCE}
      AND r.status != 'cancelled'
      AND r.created_at >= NOW() - INTERVAL '24 hours'
    ORDER BY r.created_at DESC
    LIMIT 100
  `;

  const newBookings: MrsDigestNewBooking[] = [];

  for (const row of Array.isArray(newRows) ? newRows : []) {
    const r = row as {
      id: string;
      camp_slug: string;
      check_in_date: string;
      check_out_date: string;
      reservation_type: string;
      member_display_name: string | null;
      member_number: string | null;
      guest_email: string | null;
      guest_first_name: string | null;
      guest_last_name: string | null;
      booked_site_type_label: string | null;
      site_code: string | null;
      site_name: string;
      site_type: string;
      special_type: string | null;
    };

    let email = r.guest_email?.trim() || "";
    let guestLabel =
      r.reservation_type === "member"
        ? r.member_display_name?.trim() || (r.member_number ? `#${r.member_number}` : "Member")
        : [r.guest_first_name, r.guest_last_name].filter(Boolean).join(" ").trim() || "Guest";

    if (r.reservation_type === "member" && !email && r.member_number) {
      const member = await lookupMember(r.member_number);
      if (member.valid && member.email?.trim()) {
        email = member.email.trim();
        guestLabel =
          guestLabel ||
          [member.firstName, member.lastName].filter(Boolean).join(" ").trim() ||
          guestLabel;
      }
    }

    if (!email) continue;

    const periods = await listBillingPeriods(r.id);
    const obligations = summarizeReservationPaymentObligations({
      periods,
      checkInDate: String(r.check_in_date).slice(0, 10),
      checkOutDate: String(r.check_out_date).slice(0, 10),
      reservationType: r.reservation_type,
    });
    const siteLabel =
      r.booked_site_type_label ||
      formatSiteAssignmentLabel({
        site_code: r.site_code,
        name: r.site_name,
        site_type: r.site_type,
        special_type: r.special_type,
      } as CampSiteRow);

    newBookings.push({
      campName: getCampBySlug(r.camp_slug)?.name ?? r.camp_slug,
      guestLabel,
      email,
      checkIn: String(r.check_in_date).slice(0, 10),
      checkOut: String(r.check_out_date).slice(0, 10),
      siteLabel,
      balanceDueCents:
        obligations.balanceDueBeforeArrivalCents > 0
          ? obligations.balanceDueBeforeArrivalCents
          : obligations.payableNowCents,
    });
  }

  const upcoming = await fetchUpcomingBalanceDueReservations(7);
  const balancesDue: MrsDigestBalanceDue[] = upcoming.map((u) => ({
    campName: u.campName,
    guestLabel: u.guestLabel,
    email: u.email,
    checkIn: u.checkIn,
    checkOut: u.checkOut,
    balanceDueCents: u.balanceDueCents,
    daysUntilCheckIn: u.daysUntilCheckIn,
  }));

  if (newBookings.length === 0 && balancesDue.length === 0) {
    return NextResponse.json({ ok: true, sent: false, reason: "nothing to report" });
  }

  const ok = await sendMrsReservationDigestEmail({
    to: getReservationMrsNotifyEmail(),
    newBookings,
    balancesDue,
    adminUrl: caretakerAdminReservationsUrl(),
  });

  return NextResponse.json({
    ok: true,
    sent: ok,
    newBookings: newBookings.length,
    balancesDue: balancesDue.length,
  });
}
