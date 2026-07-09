import { NextRequest, NextResponse } from "next/server";
import { sql, hasDb } from "@/lib/db";
import { getCampBySlug } from "@/lib/directory-camps";
import { getReservationBalance } from "@/lib/reservation-billing";
import { lookupMember } from "@/lib/salesforce";
import {
  formatSiteAssignmentLabel,
  PUBLIC_BOOKING_CONFIRMATION_DELAY_MINUTES,
  PUBLIC_BOOKING_IMPORT_SOURCE,
  type CampSiteRow,
} from "@/lib/public-camp-booking";
import { sendPublicCampReservationConfirmationEmail } from "@/lib/sendgrid";
import { createReservationPayToken } from "@/lib/reservation-pay-token";
import { reservationPayPageUrl } from "@/lib/reservation-notify";

/**
 * Cron: send delayed confirmation emails for public web reservations (with site assignment).
 * Schedule: every 15 minutes. Authorization: CRON_SECRET.
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

  const rows = await sql`
    SELECT r.id, r.camp_slug, r.check_in_date, r.check_out_date, r.reservation_type,
           r.member_display_name, r.member_number, r.guest_email, r.guest_first_name, r.guest_last_name,
           r.booked_site_type_label, r.created_at,
           s.site_code, s.name AS site_name, s.site_type, s.special_type
    FROM camp_reservations r
    JOIN camp_sites s ON s.id = r.site_id
    WHERE r.import_source = ${PUBLIC_BOOKING_IMPORT_SOURCE}
      AND r.confirmation_email_sent_at IS NULL
      AND r.status != 'cancelled'
      AND r.created_at <= NOW() - INTERVAL '15 minutes'
    ORDER BY r.created_at ASC
    LIMIT 50
  `;

  let sent = 0;
  let skipped = 0;

  for (const row of Array.isArray(rows) ? rows : []) {
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

    let email = r.guest_email?.trim() || null;
    let name =
      r.reservation_type === "member"
        ? r.member_display_name || (r.member_number ? `#${r.member_number}` : "Member")
        : [r.guest_first_name, r.guest_last_name].filter(Boolean).join(" ").trim() || "Guest";

    if (!email && r.reservation_type === "member" && r.member_number?.trim()) {
      const member = await lookupMember(r.member_number.trim());
      if (member.valid && member.email?.trim()) email = member.email.trim();
    }

    if (!email) {
      skipped++;
      continue;
    }

    const campName = getCampBySlug(r.camp_slug)?.name ?? r.camp_slug;
    const siteLabel = formatSiteAssignmentLabel({
      site_code: r.site_code,
      name: r.site_name,
      site_type: r.site_type,
      special_type: r.special_type,
    } as CampSiteRow);
    const balance = await getReservationBalance(r.id);
    const payBalanceUrl =
      balance.balanceDueCents > 0
        ? reservationPayPageUrl(await createReservationPayToken(r.id))
        : null;

    const ok = await sendPublicCampReservationConfirmationEmail({
      to: email,
      campName,
      guestOrMemberName: name,
      checkInDate: String(r.check_in_date).slice(0, 10),
      checkOutDate: String(r.check_out_date).slice(0, 10),
      siteTypeLabel: r.booked_site_type_label || siteLabel,
      siteAssignmentLabel: siteLabel,
      balanceDueCents: balance.balanceDueCents,
      payBalanceUrl,
      notifyMrs: true,
    });

    if (ok) {
      await sql`
        UPDATE camp_reservations
        SET confirmation_email_sent_at = NOW(), updated_at = NOW()
        WHERE id = ${r.id} AND confirmation_email_sent_at IS NULL
      `;
      sent++;
    } else {
      skipped++;
    }
  }

  return NextResponse.json({ ok: true, sent, skipped });
}
