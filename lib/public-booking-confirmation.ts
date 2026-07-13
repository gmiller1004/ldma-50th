/**
 * Send delayed confirmation email for public web campsite bookings.
 */

import { sql, hasDb } from "@/lib/db";
import { getCampBySlug } from "@/lib/directory-camps";
import { listBillingPeriods } from "@/lib/reservation-billing";
import { lookupMember } from "@/lib/salesforce";
import {
  formatSiteAssignmentLabel,
  PUBLIC_BOOKING_IMPORT_SOURCE,
  type CampSiteRow,
} from "@/lib/public-camp-booking";
import { sendPublicCampReservationConfirmationEmail } from "@/lib/sendgrid";
import { fetchCaretakerEmailsForCamp } from "@/lib/caretaker-admin-summary";
import { createReservationPayToken } from "@/lib/reservation-pay-token";
import { reservationPayPageUrl } from "@/lib/reservation-notify";
import { summarizeReservationPaymentObligations } from "@/lib/reservation-balance-due";
import { toDateOnlyStr } from "@/lib/reservation-dates";

type ConfirmationRow = {
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
  import_source: string | null;
  confirmation_email_sent_at: string | null;
  site_code: string | null;
  site_name: string;
  site_type: string;
  special_type: string | null;
};

async function resolveConfirmationRecipient(
  row: ConfirmationRow
): Promise<{ email: string; name: string } | null> {
  let email = row.guest_email?.trim() || null;
  let name =
    row.reservation_type === "member"
      ? row.member_display_name || (row.member_number ? `#${row.member_number}` : "Member")
      : [row.guest_first_name, row.guest_last_name].filter(Boolean).join(" ").trim() || "Guest";

  if (!email && row.reservation_type === "member" && row.member_number?.trim()) {
    const member = await lookupMember(row.member_number.trim());
    if (member.valid && member.email?.trim()) {
      email = member.email.trim();
      name =
        name ||
        [member.firstName, member.lastName].filter(Boolean).join(" ").trim() ||
        name;
    }
  }

  if (!email) return null;
  return { email, name };
}

export async function sendPublicReservationConfirmationIfPending(
  reservationId: string
): Promise<"sent" | "skipped" | "failed"> {
  if (!hasDb() || !sql) return "failed";

  const rows = await sql`
    SELECT r.id, r.camp_slug, r.check_in_date, r.check_out_date, r.reservation_type,
           r.member_display_name, r.member_number, r.guest_email, r.guest_first_name, r.guest_last_name,
           r.booked_site_type_label, r.import_source, r.confirmation_email_sent_at,
           s.site_code, s.name AS site_name, s.site_type, s.special_type
    FROM camp_reservations r
    JOIN camp_sites s ON s.id = r.site_id
    WHERE r.id = ${reservationId}
    LIMIT 1
  `;
  const r = (Array.isArray(rows) ? rows[0] : undefined) as ConfirmationRow | undefined;
  if (!r || r.import_source !== PUBLIC_BOOKING_IMPORT_SOURCE) return "skipped";
  if (r.confirmation_email_sent_at) return "skipped";

  const recipient = await resolveConfirmationRecipient(r);
  if (!recipient) {
    console.warn(`[public-booking] No email for confirmation on reservation ${reservationId}`);
    return "skipped";
  }

  const campName = getCampBySlug(r.camp_slug)?.name ?? r.camp_slug;
  const siteLabel = formatSiteAssignmentLabel({
    site_code: r.site_code,
    name: r.site_name,
    site_type: r.site_type,
    special_type: r.special_type,
  } as CampSiteRow);
  const checkIn = toDateOnlyStr(r.check_in_date);
  const checkOut = toDateOnlyStr(r.check_out_date);
  const periods = await listBillingPeriods(r.id);
  const obligations = summarizeReservationPaymentObligations({
    periods,
    checkInDate: checkIn,
    checkOutDate: checkOut,
    reservationType: r.reservation_type,
  });
  const payBalanceUrl =
    obligations.payableNowCents > 0
      ? reservationPayPageUrl(await createReservationPayToken(r.id))
      : null;

  const caretakerCc = await fetchCaretakerEmailsForCamp(r.camp_slug, recipient.email);

  const ok = await sendPublicCampReservationConfirmationEmail({
    to: recipient.email,
    campName,
    guestOrMemberName: recipient.name,
    checkInDate: checkIn,
    checkOutDate: checkOut,
    siteTypeLabel: r.booked_site_type_label || siteLabel,
    siteAssignmentLabel: siteLabel,
    payment: {
      paidInFull: obligations.paidInFull,
      isLongTermMember: obligations.isLongTermMember,
      balanceDueBeforeArrivalCents: obligations.balanceDueBeforeArrivalCents,
      payableNowCents: obligations.payableNowCents,
      nextPaymentDueDate: obligations.nextScheduledPayment?.dueDate ?? null,
      nextPaymentDueCents: obligations.nextScheduledPayment?.amountCents ?? null,
    },
    payBalanceUrl,
    notifyMrs: true,
    caretakerCc,
  });

  if (!ok) {
    console.error(`[public-booking] Confirmation email failed for reservation ${reservationId}`);
    return "failed";
  }

  await sql`
    UPDATE camp_reservations
    SET confirmation_email_sent_at = NOW(), updated_at = NOW()
    WHERE id = ${reservationId} AND confirmation_email_sent_at IS NULL
  `;
  return "sent";
}

export async function sendPendingPublicReservationConfirmations(limit = 50): Promise<{
  sent: number;
  skipped: number;
}> {
  if (!hasDb() || !sql) return { sent: 0, skipped: 0 };

  const rows = await sql`
    SELECT r.id
    FROM camp_reservations r
    WHERE r.import_source = ${PUBLIC_BOOKING_IMPORT_SOURCE}
      AND r.confirmation_email_sent_at IS NULL
      AND r.status != 'cancelled'
      AND r.created_at <= NOW() - INTERVAL '15 minutes'
    ORDER BY r.created_at ASC
    LIMIT ${limit}
  `;

  let sent = 0;
  let skipped = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
    const id = (row as { id: string }).id;
    const result = await sendPublicReservationConfirmationIfPending(id);
    if (result === "sent") sent++;
    else skipped++;
  }
  return { sent, skipped };
}
