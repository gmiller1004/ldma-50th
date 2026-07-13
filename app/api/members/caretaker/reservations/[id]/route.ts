import { NextRequest, NextResponse } from "next/server";
import { getCaretakerWriteContextFromRequest } from "@/lib/caretaker-auth";
import { sql, hasDb } from "@/lib/db";
import { campUsesReservations, caretakerAllowsCashCheckIn } from "@/lib/reservation-camps";
import { lookupMember } from "@/lib/salesforce";
import {
  getReservationBalance,
  getReservationPaymentTotals,
  listBillingPeriods,
  listReservationPayments,
  siteRatesFromRow,
  stayNights,
  syncBillingPeriodsForReservation,
} from "@/lib/reservation-billing";
import { awardPointsForReservationCheckIn } from "@/lib/rewards";
import {
  sendCaretakerCheckInWelcomeEmail,
  sendCaretakerGuestCheckInWelcomeEmail,
  sendPaymentReceiptEmail,
  sendReservationModifiedEmail,
} from "@/lib/sendgrid";
import { syncReservationToKlaviyo } from "@/lib/klaviyo-camp-stay";
import { toDateOnlyStr } from "@/lib/reservation-dates";

type ReservationRow = {
  id: string;
  site_id: string;
  camp_slug: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  reservation_type: string;
  member_contact_id: string | null;
  member_number: string | null;
  member_display_name: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  status: string;
  checked_in_at: string | null;
  created_at: string;
  updated_at: string;
  invoice_number?: string | null;
  calculated_total_cents?: number | null;
  amount_override_cents?: number | null;
  override_reason?: string | null;
  price_override_flag?: boolean | null;
  cancelled_at?: string | null;
  cancellation_refund_cents?: number | null;
  cancellation_fee_waived?: boolean | null;
  cancellation_fee_waived_cents?: number | null;
  cancellation_fee_waived_at?: string | null;
};

function rowToJson(row: ReservationRow) {
  return {
    id: row.id,
    siteId: row.site_id,
    campSlug: row.camp_slug,
    checkInDate: row.check_in_date,
    checkOutDate: row.check_out_date,
    nights: row.nights,
    reservationType: row.reservation_type,
    memberContactId: row.member_contact_id,
    memberNumber: row.member_number,
    memberDisplayName: row.member_display_name,
    guestFirstName: row.guest_first_name,
    guestLastName: row.guest_last_name,
    guestEmail: row.guest_email,
    guestPhone: row.guest_phone,
    status: row.status,
    checkedInAt: row.checked_in_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    invoiceNumber: row.invoice_number ?? null,
    calculatedTotalCents: row.calculated_total_cents ?? null,
    amountOverrideCents: row.amount_override_cents ?? null,
    overrideReason: row.override_reason ?? null,
    priceOverrideFlag: Boolean(row.price_override_flag),
    cancelledAt: row.cancelled_at ?? null,
    cancellationRefundCents: row.cancellation_refund_cents ?? null,
    cancellationFeeWaived: Boolean(row.cancellation_fee_waived),
    cancellationFeeWaivedCents: row.cancellation_fee_waived_cents ?? null,
    cancellationFeeWaivedAt: row.cancellation_fee_waived_at ?? null,
  };
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/members/caretaker/reservations/[id]
 * Reservation detail with billing periods and balance.
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
  const rows = await sql`
    SELECT r.id, r.site_id, s.name AS site_name, r.camp_slug, r.check_in_date, r.check_out_date, r.nights,
           r.reservation_type, r.member_contact_id, r.member_number, r.member_display_name,
           r.guest_first_name, r.guest_last_name, r.guest_email, r.guest_phone,
           r.status, r.checked_in_at, r.created_at, r.updated_at,
           r.invoice_number, r.calculated_total_cents, r.amount_override_cents, r.override_reason, r.price_override_flag,
           r.cancelled_at, r.cancellation_refund_cents,
           r.cancellation_fee_waived, r.cancellation_fee_waived_cents, r.cancellation_fee_waived_at
    FROM camp_reservations r
    LEFT JOIN camp_sites s ON s.id = r.site_id
    WHERE r.id = ${id} AND r.camp_slug = ${caretaker.campSlug}
    LIMIT 1
  `;
  const row = (Array.isArray(rows) ? rows[0] : undefined) as (ReservationRow & { site_name?: string }) | undefined;
  if (!row) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  const billingPeriods = await listBillingPeriods(id);
  const balance = await getReservationBalance(id);
  const payments = await listReservationPayments(id);
  const paymentSummary = await getReservationPaymentTotals(id);

  return NextResponse.json({
    ...rowToJson(row),
    siteName: row.site_name ?? null,
    billingPeriods,
    balance,
    payments,
    paymentSummary,
  });
}

/**
 * PATCH /api/members/caretaker/reservations/[id]
 * Update dates and/or check in. Regenerates billing periods; additional nights require payment.
 */
export async function PATCH(
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
    if (!id) {
      return NextResponse.json({ error: "Reservation id required" }, { status: 400 });
    }

    let body: {
      checkInDate?: string;
      checkOutDate?: string;
      checkIn?: boolean;
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

    const existing = await sql`
      SELECT r.id, r.site_id, r.camp_slug, r.check_in_date, r.check_out_date, r.nights, r.status,
             r.reservation_type, r.member_contact_id, r.member_number, r.member_display_name,
             r.guest_first_name, r.guest_last_name, r.guest_email, r.guest_phone,
             s.member_rate_daily, s.member_rate_monthly, s.non_member_rate_daily
      FROM camp_reservations r
      JOIN camp_sites s ON s.id = r.site_id
      WHERE r.id = ${id} AND r.camp_slug = ${caretaker.campSlug}
      LIMIT 1
    `;
    type ExistingRow = {
      site_id: string;
      check_in_date: string;
      check_out_date: string;
      nights: number;
      status: string;
      reservation_type: string;
      member_contact_id: string | null;
      member_number: string | null;
      member_display_name: string | null;
      guest_first_name: string | null;
      guest_last_name: string | null;
      guest_email: string | null;
      guest_phone: string | null;
      member_rate_daily: number | null;
      member_rate_monthly: number | null;
      non_member_rate_daily: number | null;
    };
    const existingRow = (Array.isArray(existing) ? existing[0] : undefined) as ExistingRow | undefined;
    if (!existingRow) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }
    if (existingRow.status === "cancelled") {
      return NextResponse.json({ error: "Cannot update cancelled reservation" }, { status: 400 });
    }

    const setCheckInRequested = body.checkIn === true;
    if (setCheckInRequested) {
      const today = new Date().toISOString().slice(0, 10);
      const effectiveCheckIn =
        typeof body.checkInDate === "string" && DATE_REGEX.test(body.checkInDate.trim())
          ? body.checkInDate.trim().slice(0, 10)
          : toDateOnlyStr(existingRow.check_in_date);
      if (effectiveCheckIn && today < effectiveCheckIn) {
        return NextResponse.json(
          {
            error:
              "Check-in is only allowed on or after the reservation check-in date. Edit the reservation to move the check-in date earlier if needed.",
          },
          { status: 400 }
        );
      }
    }

    const checkInCandidate =
      typeof body.checkInDate === "string" && DATE_REGEX.test(body.checkInDate.trim())
        ? body.checkInDate.trim()
        : null;
    const checkOutCandidate =
      typeof body.checkOutDate === "string" && DATE_REGEX.test(body.checkOutDate.trim())
        ? body.checkOutDate.trim()
        : null;
    const newCheckIn = checkInCandidate ?? toDateOnlyStr(existingRow.check_in_date);
    const newCheckOut = checkOutCandidate ?? toDateOnlyStr(existingRow.check_out_date);

    if (newCheckIn >= newCheckOut) {
      return NextResponse.json({ error: "Check-out date must be after check-in date" }, { status: 400 });
    }

    const datesChanged = checkInCandidate !== null || checkOutCandidate !== null;
    const today = new Date().toISOString().slice(0, 10);
    const rates = siteRatesFromRow(existingRow);
    const isMember = existingRow.reservation_type === "member";

    if (datesChanged) {
      const overlap = await sql`
        SELECT id FROM camp_reservations
        WHERE site_id = ${existingRow.site_id}
          AND id != ${id}
          AND status != 'cancelled'
          AND check_in_date < ${newCheckOut}
          AND check_out_date > ${newCheckIn}
        LIMIT 1
      `;
      if (Array.isArray(overlap) && overlap.length > 0) {
        return NextResponse.json({ error: "Site is not available for the new dates" }, { status: 400 });
      }

      const newNights = stayNights(newCheckIn, newCheckOut);

      await sql`
        UPDATE camp_reservations
        SET check_in_date = ${newCheckIn}, check_out_date = ${newCheckOut}, nights = ${newNights}, updated_at = NOW()
        WHERE id = ${id}
      `;

      const balanceAfterSync = await syncBillingPeriodsForReservation({
        reservationId: id,
        checkInDate: newCheckIn,
        checkOutDate: newCheckOut,
        isMember,
        rates,
      });

      if (balanceAfterSync.balanceDueCents > 0) {
        const paymentMethod = body.paymentMethod === "cash" ? "cash" : null;
        const cashAllowed = caretakerAllowsCashCheckIn(newCheckIn, today);
        if (!paymentMethod) {
          return NextResponse.json(
            {
              error: cashAllowed
                ? "Additional site fees are due. Pay with cash here or use card."
                : "Additional site fees are due. Card only (cash not allowed for check-in more than 7 days ago).",
              amountDueCents: balanceAfterSync.balanceDueCents,
              requirePayment: true,
            },
            { status: 400 }
          );
        }
        if (paymentMethod === "cash" && !cashAllowed) {
          return NextResponse.json(
            { error: "Cash not allowed when check-in is more than 7 days in the past." },
            { status: 400 }
          );
        }
        const amountCents = typeof body.amountCents === "number" ? body.amountCents : 0;
        const recipientEmail = typeof body.recipientEmail === "string" ? body.recipientEmail.trim() : "";
        const recipientDisplayName =
          typeof body.recipientDisplayName === "string" ? body.recipientDisplayName.trim() : "Guest";
        if (
          amountCents < 1 ||
          amountCents > balanceAfterSync.balanceDueCents ||
          !recipientEmail ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)
        ) {
          return NextResponse.json(
            {
              error: `Valid payment required up to $${(balanceAfterSync.balanceDueCents / 100).toFixed(2)}`,
              amountDueCents: balanceAfterSync.balanceDueCents,
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
            ${existingRow.member_contact_id}, ${existingRow.member_number}, ${recipientEmail}, ${recipientDisplayName},
            ${caretaker.contactId}, NOW()
          )
        `;

        await syncBillingPeriodsForReservation({
          reservationId: id,
          checkInDate: newCheckIn,
          checkOutDate: newCheckOut,
          isMember,
          rates,
        });

        const siteResForReceipt = await sql`SELECT name FROM camp_sites WHERE id = ${existingRow.site_id} LIMIT 1`;
        const siteNameForReceipt = ((Array.isArray(siteResForReceipt) ? siteResForReceipt : []) as { name: string }[])[0]
          ?.name;
        const reservationDetails = {
          recipientName:
            recipientDisplayName ||
            (existingRow.reservation_type === "member"
              ? existingRow.member_display_name ?? "Member"
              : [existingRow.guest_first_name, existingRow.guest_last_name].filter(Boolean).join(" ").trim() ||
                "Guest"),
          checkInDate: newCheckIn,
          checkOutDate: newCheckOut,
          siteName: siteNameForReceipt,
        };
        const receiptSent = await sendPaymentReceiptEmail(
          recipientEmail,
          caretaker.campName,
          [{ label: "Additional site fee", amountCents }],
          amountCents,
          "cash",
          today,
          reservationDetails
        ).catch((e) => {
          console.error("[caretaker] payment receipt email failed:", e);
          return false;
        });
        if (receiptSent) {
          await sql`
            UPDATE camp_payments SET receipt_sent_at = NOW()
            WHERE id = (SELECT id FROM camp_payments WHERE reservation_id = ${id} AND method = 'cash' ORDER BY created_at DESC LIMIT 1)
          `;
        }
      }

      const siteRes = await sql`SELECT name FROM camp_sites WHERE id = ${existingRow.site_id} LIMIT 1`;
      const siteName = ((Array.isArray(siteRes) ? siteRes : []) as { name: string }[])[0]?.name ?? "Site";
      if (existingRow.reservation_type === "member" && existingRow.member_number) {
        try {
          const member = await lookupMember(existingRow.member_number);
          const email = member.valid && member.email?.trim() ? member.email.trim() : null;
          if (email) {
            await sendReservationModifiedEmail(
              email,
              caretaker.campName,
              siteName,
              newCheckIn,
              newCheckOut,
              existingRow.member_display_name || `#${existingRow.member_number}`
            );
          }
        } catch (e) {
          console.error("[caretaker] reservation modified email failed:", e);
        }
      } else if (existingRow.reservation_type === "guest" && existingRow.guest_email) {
        try {
          await sendReservationModifiedEmail(
            existingRow.guest_email,
            caretaker.campName,
            siteName,
            newCheckIn,
            newCheckOut,
            existingRow.guest_first_name || "Guest"
          );
        } catch (e) {
          console.error("[caretaker] reservation modified email failed:", e);
        }
      }
    }

    const setCheckIn = body.checkIn === true;
    const emailCheckIn = toDateOnlyStr(datesChanged ? newCheckIn : existingRow.check_in_date);
    const emailCheckOut = toDateOnlyStr(datesChanged ? newCheckOut : existingRow.check_out_date);

    let welcomeEmailSent = false;
    let pointsAwarded = 0;
    if (setCheckIn) {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ldma-50th.vercel.app";
      if (existingRow.reservation_type === "member" && existingRow.member_number && existingRow.member_contact_id) {
        try {
          const member = await lookupMember(String(existingRow.member_number).trim());
          const email = member.valid && member.email?.trim() ? member.email.trim() : null;
          if (email) {
            const sent = await sendCaretakerCheckInWelcomeEmail(
              email,
              caretaker.campName,
              existingRow.member_display_name || `#${existingRow.member_number}`,
              emailCheckIn,
              emailCheckOut
            );
            welcomeEmailSent = sent;
          }
        } catch (e) {
          console.error("[caretaker] reservation check-in welcome email failed:", e);
        }
        const nightsForPoints = datesChanged ? stayNights(newCheckIn, newCheckOut) : existingRow.nights;
        await awardPointsForReservationCheckIn(
          existingRow.member_contact_id,
          nightsForPoints,
          id
        ).catch((e) => console.error("[caretaker] reservation check-in points failed:", e));
        pointsAwarded = nightsForPoints * 50;
      } else if (existingRow.reservation_type === "guest" && existingRow.guest_email) {
        try {
          const sent = await sendCaretakerGuestCheckInWelcomeEmail(
            existingRow.guest_email,
            caretaker.campName,
            existingRow.guest_first_name || "Guest",
            emailCheckIn,
            emailCheckOut,
            baseUrl
          );
          welcomeEmailSent = sent;
        } catch (e) {
          console.error("[caretaker] reservation check-in welcome email failed:", e);
        }
      }
    }

    if (setCheckIn) {
      await sql`
        UPDATE camp_reservations
        SET status = 'checked_in', checked_in_at = COALESCE(checked_in_at, NOW()), updated_at = NOW()
        WHERE id = ${id}
      `;
    }

    const updated = await sql`
      SELECT id, site_id, camp_slug, check_in_date, check_out_date, nights,
             reservation_type, member_contact_id, member_number, member_display_name,
             guest_first_name, guest_last_name, guest_email, guest_phone,
             status, checked_in_at, created_at, updated_at
      FROM camp_reservations WHERE id = ${id} LIMIT 1
    `;
    const row = (Array.isArray(updated) ? updated : [])[0] as ReservationRow | undefined;
    if (!row) {
      return NextResponse.json({ ok: true, id, welcomeEmailSent: setCheckIn ? welcomeEmailSent : undefined });
    }
    syncReservationToKlaviyo(row).catch((e) => console.error("[Klaviyo] sync after PATCH:", e));

    const billingPeriods = await listBillingPeriods(id);
    const balance = await getReservationBalance(id);
    const payload = {
      ...rowToJson(row),
      billingPeriods,
      balance,
      ...(setCheckIn ? { welcomeEmailSent, pointsAwarded } : {}),
    };
    return NextResponse.json(payload);
  } catch (e) {
    console.error("[caretaker] PATCH reservation error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Check-in or update failed" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/members/caretaker/reservations/[id]
 * @deprecated Prefer POST .../cancel — kept for compatibility; runs refund-aware cancellation.
 */
export async function DELETE(
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

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Reservation id required" }, { status: 400 });
  }

  const { executeCancellation } = await import("@/lib/cancel-reservation");
  const result = await executeCancellation({
    reservationId: id,
    campSlug: caretaker.campSlug,
    createdByContactId: caretaker.contactId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, cancelled: true, preview: result.preview });
}
