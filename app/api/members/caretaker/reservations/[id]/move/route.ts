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
import {
  getReservationBalance,
  listBillingPeriods,
  siteRatesFromRow,
  syncBillingPeriodsForReservation,
} from "@/lib/reservation-billing";
import { payableBalanceCents } from "@/lib/reservation-balance-due";
import {
  getReservationSiteFeeTotals,
  refundReservationSiteFees,
} from "@/lib/reservation-refund";
import { lookupMember } from "@/lib/salesforce";
import { sendPaymentReceiptEmail, sendReservationSiteMovedEmail } from "@/lib/sendgrid";
import { fetchCaretakerEmailsForCamp } from "@/lib/caretaker-admin-summary";
import { syncReservationToKlaviyo } from "@/lib/klaviyo-camp-stay";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ReservationRow = {
  id: string;
  site_id: string;
  camp_slug: string;
  check_in_date: string | Date;
  check_out_date: string | Date;
  nights: number;
  reservation_type: string;
  member_contact_id: string | null;
  member_number: string | null;
  member_display_name: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  guest_email: string | null;
  status: string;
};

/**
 * POST /api/members/caretaker/reservations/[id]/move
 * Move a reservation to a different (available) site and settle the price difference:
 * charge the additional amount (cash here / card via checkout) or refund the overpayment.
 */
export async function POST(
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
    if (!id) return NextResponse.json({ error: "Reservation id required" }, { status: 400 });

    let body: {
      newSiteId?: string;
      paymentMethod?: string;
      amountCents?: number;
      recipientEmail?: string;
      recipientDisplayName?: string;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const newSiteId = typeof body.newSiteId === "string" ? body.newSiteId.trim() : "";
    if (!newSiteId) return NextResponse.json({ error: "newSiteId is required" }, { status: 400 });

    const resRows = await sql`
      SELECT id, site_id, camp_slug, check_in_date, check_out_date, nights, reservation_type,
             member_contact_id, member_number, member_display_name,
             guest_first_name, guest_last_name, guest_email, status
      FROM camp_reservations
      WHERE id = ${id} AND camp_slug = ${caretaker.campSlug}
      LIMIT 1
    `;
    const res = (Array.isArray(resRows) ? resRows[0] : undefined) as ReservationRow | undefined;
    if (!res) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    const reservation = res;
    if (reservation.status === "cancelled") {
      return NextResponse.json({ error: "Cannot move a cancelled reservation" }, { status: 400 });
    }

    const checkInDate = toDateOnlyStr(reservation.check_in_date);
    const checkOutDate = toDateOnlyStr(reservation.check_out_date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkInDate) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOutDate)) {
      return NextResponse.json({ error: "Reservation has invalid dates" }, { status: 400 });
    }
    const isMember = reservation.reservation_type === "member";

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
    const destinationSite = newSite;
    if (isNonBookableSite(caretaker.campSlug, destinationSite.name, destinationSite.site_code)) {
      return NextResponse.json({ error: "Destination site cannot be booked" }, { status: 400 });
    }

    const sameSite = destinationSite.id === reservation.site_id;
    const oldSiteRows = sameSite
      ? null
      : await sql`SELECT name FROM camp_sites WHERE id = ${reservation.site_id} LIMIT 1`;
    const previousSiteName =
      (Array.isArray(oldSiteRows) ? oldSiteRows[0] : undefined) as { name: string } | undefined;
    const previousSiteLabel = previousSiteName?.name ?? null;
    const caretakerCampSlug = caretaker.campSlug;
    const caretakerCampName = caretaker.campName;

    async function notifySiteMoved(): Promise<void> {
      const partyName =
        reservation.reservation_type === "member"
          ? reservation.member_display_name ||
            (reservation.member_number ? `#${reservation.member_number}` : "Member")
          : [reservation.guest_first_name, reservation.guest_last_name].filter(Boolean).join(" ").trim() ||
            "Guest";
      let notifyEmail: string | null = null;
      if (reservation.reservation_type === "member" && reservation.member_number) {
        const member = await lookupMember(String(reservation.member_number).trim());
        notifyEmail = member.valid && member.email?.trim() ? member.email.trim() : null;
      } else if (reservation.reservation_type === "guest") {
        notifyEmail = reservation.guest_email?.trim() || null;
      }
      if (!notifyEmail) return;

      const caretakerCc = await fetchCaretakerEmailsForCamp(caretakerCampSlug, notifyEmail);
      await sendReservationSiteMovedEmail({
        to: notifyEmail,
        campName: caretakerCampName,
        newSiteLabel: destinationSite.name,
        previousSiteLabel,
        checkInDate,
        checkOutDate,
        guestOrMemberName: partyName,
        caretakerCc,
      }).catch((e) => {
        console.error("[caretaker] site moved email failed:", e);
      });
    }

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
      if (Array.isArray(overlap) && overlap.length > 0) {
        return NextResponse.json(
          { error: "Destination site is not available for these dates" },
          { status: 400 }
        );
      }
    }

    const rates = siteRatesFromRow(newSite);
    const pricing = computeStayPricing({ checkInDate, checkOutDate, isMember, rates });
    const newTotalCents = pricing.totalCents;
    if (newTotalCents < 1) {
      return NextResponse.json(
        { error: "Destination site rates are not configured" },
        { status: 400 }
      );
    }

    const totalsBefore = await getReservationSiteFeeTotals(id);
    const balanceAfterMoveCents = newTotalCents - totalsBefore.netPaidCents;

    const today = new Date().toISOString().slice(0, 10);

    // Refund overpayment before moving so a failed refund does not leave a moved reservation.
    let refundResult: { stripeRefundCents: number; cashRefundCents: number; totalRefundedCents: number } | null =
      null;
    if (balanceAfterMoveCents < 0) {
      const refund = await refundReservationSiteFees({
        reservationId: id,
        campSlug: caretaker.campSlug,
        createdByContactId: caretaker.contactId,
        refundCents: -balanceAfterMoveCents,
      });
      if (!refund.ok) {
        return NextResponse.json({ error: refund.error }, { status: 400 });
      }
      refundResult = refund;
    }

    // Move the reservation and reset pricing to the new site's calculated total.
    await sql`
      UPDATE camp_reservations
      SET site_id = ${newSiteId},
          nights = ${pricing.totalNights},
          calculated_total_cents = ${newTotalCents},
          amount_override_cents = NULL,
          override_reason = NULL,
          price_override_flag = FALSE,
          updated_at = NOW()
      WHERE id = ${id}
    `;

    let balance = await syncBillingPeriodsForReservation({
      reservationId: id,
      checkInDate,
      checkOutDate,
      isMember,
      rates,
    });

    // Additional amount owed now after moving (first month / due periods only for long-term members).
    if (balance.balanceDueCents > 0) {
      const periods = await listBillingPeriods(id);
      const payableNowCents = payableBalanceCents({
        periods,
        checkInDate,
        checkOutDate,
        reservationType: reservation.reservation_type,
        today,
      });
      if (payableNowCents > 0) {
        const paymentMethod = body.paymentMethod === "cash" ? "cash" : null;
        const cashAllowed = caretakerAllowsCashExistingReservationPayment();
        if (!paymentMethod) {
          await notifySiteMoved();
          return NextResponse.json({
            ok: true,
            moved: true,
            newSiteId,
            newSiteName: newSite.name,
            requirePayment: true,
            amountDueCents: payableNowCents,
            cashAllowed,
            refund: refundResult,
          });
        }
        if (!cashAllowed) {
          return NextResponse.json(
            { error: "Cash payment is not available for this reservation. Use card." },
            { status: 400 }
          );
        }
        const amountCents = typeof body.amountCents === "number" ? body.amountCents : payableNowCents;
        const recipientEmail = typeof body.recipientEmail === "string" ? body.recipientEmail.trim() : "";
        const recipientDisplayName =
          typeof body.recipientDisplayName === "string" ? body.recipientDisplayName.trim() : "Guest";
        if (
          amountCents < 1 ||
          amountCents > payableNowCents ||
          !recipientEmail ||
          !EMAIL_REGEX.test(recipientEmail)
        ) {
          return NextResponse.json(
            {
              error: `Valid payment required up to $${(payableNowCents / 100).toFixed(2)}`,
              amountDueCents: payableNowCents,
            },
            { status: 400 }
          );
        }

        await sql`
          INSERT INTO camp_payments (
            camp_slug, payment_type, method, amount_cents, reservation_id,
            member_contact_id, member_number, member_email, recipient_display_name,
            created_by_contact_id, created_at
          )
          VALUES (
            ${caretaker.campSlug}, 'reservation', 'cash', ${amountCents}, ${id},
            ${reservation.member_contact_id}, ${reservation.member_number}, ${recipientEmail}, ${recipientDisplayName},
            ${caretaker.contactId}, NOW()
          )
        `;

        balance = await syncBillingPeriodsForReservation({
          reservationId: id,
          checkInDate,
          checkOutDate,
          isMember,
          rates,
        });

        const reservationDetails = {
          recipientName: recipientDisplayName,
          checkInDate,
          checkOutDate,
          siteName: newSite.name,
        };
        const receiptSent = await sendPaymentReceiptEmail(
          recipientEmail,
          caretaker.campName,
          [{ label: `Site change to ${newSite.name}`, amountCents }],
          amountCents,
          "cash",
          today,
          reservationDetails
        ).catch((e) => {
          console.error("[caretaker] move receipt email failed:", e);
          return false;
        });
        if (receiptSent) {
          await sql`
            UPDATE camp_payments SET receipt_sent_at = NOW()
            WHERE id = (
              SELECT id FROM camp_payments
              WHERE reservation_id = ${id} AND method = 'cash'
              ORDER BY created_at DESC LIMIT 1
            )
          `;
        }
      }
    }

    if (!sameSite) {
      await notifySiteMoved();
    }

    const updated = await sql`
      SELECT id, site_id, camp_slug, check_in_date, check_out_date, nights,
             reservation_type, member_contact_id, member_number, member_display_name,
             guest_first_name, guest_last_name, guest_email, guest_phone,
             status, checked_in_at, created_at, updated_at
      FROM camp_reservations WHERE id = ${id} LIMIT 1
    `;
    const updatedRow = (Array.isArray(updated) ? updated[0] : undefined) as Record<string, unknown> | undefined;
    if (updatedRow) {
      syncReservationToKlaviyo(updatedRow as Parameters<typeof syncReservationToKlaviyo>[0]).catch((e) =>
        console.error("[Klaviyo] sync after move:", e)
      );
    }

    const finalBalance = await getReservationBalance(id);

    return NextResponse.json({
      ok: true,
      moved: true,
      newSiteId,
      newSiteName: newSite.name,
      newTotalCents,
      refund: refundResult,
      balance: finalBalance,
    });
  } catch (e) {
    console.error("[caretaker] move reservation error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Move failed" },
      { status: 500 }
    );
  }
}
