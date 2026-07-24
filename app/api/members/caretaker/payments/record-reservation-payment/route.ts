import { NextRequest, NextResponse } from "next/server";
import { getCaretakerWriteContext } from "@/lib/caretaker-auth";
import { sql, hasDb } from "@/lib/db";
import { campUsesReservations } from "@/lib/reservation-camps";
import { toDateOnlyStr } from "@/lib/reservation-dates";
import { sendPaymentReceiptEmail } from "@/lib/sendgrid";
import {
  getReservationBalance,
  syncBillingPeriodsForReservation,
  siteRatesFromRow,
} from "@/lib/reservation-billing";

/**
 * POST /api/members/caretaker/payments/record-reservation-payment
 * Record a cash (or external) payment against an existing reservation; waterfall across billing periods.
 */
export async function POST(request: NextRequest) {
  let body: {
    reservationId?: string;
    amountCents?: number;
    recipientEmail?: string;
    recipientDisplayName?: string;
    campSlug?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const campSlugOverride = typeof body.campSlug === "string" ? body.campSlug.trim() : undefined;
  const caretaker = await getCaretakerWriteContext(campSlugOverride);
  if (!caretaker) {
    return NextResponse.json({ error: "Caretaker access required" }, { status: 403 });
  }
  if (!campUsesReservations(caretaker.campSlug)) {
    return NextResponse.json({ error: "Reservation system not available for this camp" }, { status: 403 });
  }
  if (!hasDb() || !sql) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  const reservationId = typeof body.reservationId === "string" ? body.reservationId.trim() : "";
  const amountCents = typeof body.amountCents === "number" ? body.amountCents : 0;
  const recipientEmail = typeof body.recipientEmail === "string" ? body.recipientEmail.trim() : "";
  const recipientDisplayName =
    typeof body.recipientDisplayName === "string" ? body.recipientDisplayName.trim() : "Guest";

  if (!reservationId) {
    return NextResponse.json({ error: "reservationId required" }, { status: 400 });
  }
  if (amountCents < 1) {
    return NextResponse.json({ error: "amountCents must be positive" }, { status: 400 });
  }
  if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return NextResponse.json({ error: "Valid recipientEmail required" }, { status: 400 });
  }

  const resRows = await sql`
    SELECT r.id, r.camp_slug, r.check_in_date, r.check_out_date, r.nights, r.reservation_type, r.status,
           r.member_contact_id, r.member_number, r.member_display_name, r.invoice_number,
           r.guest_first_name, r.guest_last_name,
           s.member_rate_daily, s.member_rate_monthly, s.non_member_rate_daily, s.name AS site_name
    FROM camp_reservations r
    JOIN camp_sites s ON s.id = r.site_id
    WHERE r.id = ${reservationId} AND r.camp_slug = ${caretaker.campSlug}
    LIMIT 1
  `;
  const res = (Array.isArray(resRows) ? resRows[0] : undefined) as
    | {
        id: string;
        camp_slug: string;
        check_in_date: string;
        check_out_date: string;
        reservation_type: string;
        status: string;
        member_contact_id: string | null;
        member_number: string | null;
        member_display_name: string | null;
        invoice_number: string | null;
        guest_first_name: string | null;
        guest_last_name: string | null;
        member_rate_daily: number | null;
        member_rate_monthly: number | null;
        non_member_rate_daily: number | null;
        site_name: string;
      }
    | undefined;

  if (!res) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }
  if (res.status === "cancelled") {
    return NextResponse.json({ error: "Cannot pay cancelled reservation" }, { status: 400 });
  }

  const balanceBefore = await getReservationBalance(reservationId);
  if (amountCents > balanceBefore.balanceDueCents) {
    return NextResponse.json(
      {
        error: `Payment exceeds balance due ($${(balanceBefore.balanceDueCents / 100).toFixed(2)})`,
        balanceDueCents: balanceBefore.balanceDueCents,
      },
      { status: 400 }
    );
  }

  const checkInDate = toDateOnlyStr(res.check_in_date);
  const checkOutDate = toDateOnlyStr(res.check_out_date);

  // Insert then sync. If sync fails, delete the payment so retries do not stack ledger rows
  // while period balances still look unpaid in the UI.
  let balance;
  try {
    const inserted = await sql`
      INSERT INTO camp_payments (
        camp_slug, payment_type, method, amount_cents, reservation_id,
        member_contact_id, member_number, member_email, recipient_display_name,
        invoice_number, created_by_contact_id, created_at
      )
      VALUES (
        ${caretaker.campSlug}, 'reservation', 'cash', ${amountCents}, ${reservationId},
        ${res.member_contact_id}, ${res.member_number}, ${recipientEmail}, ${recipientDisplayName},
        ${res.invoice_number}, ${caretaker.contactId}, NOW()
      )
      RETURNING id
    `;
    const paymentId = (Array.isArray(inserted) ? inserted[0] : undefined) as { id: string } | undefined;
    if (!paymentId?.id) {
      return NextResponse.json({ error: "Could not record payment" }, { status: 500 });
    }

    try {
      const rates = siteRatesFromRow(res);
      balance = await syncBillingPeriodsForReservation({
        reservationId,
        checkInDate,
        checkOutDate,
        isMember: res.reservation_type === "member",
        rates,
      });
    } catch (syncErr) {
      console.error("[caretaker] reservation payment sync failed, rolling back payment:", syncErr);
      await sql`DELETE FROM camp_payments WHERE id = ${paymentId.id}`;
      return NextResponse.json(
        { error: "Payment could not be applied to billing. Please try again." },
        { status: 500 }
      );
    }
  } catch (e) {
    console.error("[caretaker] reservation cash payment failed:", e);
    return NextResponse.json({ error: "Payment failed" }, { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const recipientName =
    res.reservation_type === "member"
      ? res.member_display_name?.trim() || "Member"
      : [res.guest_first_name, res.guest_last_name].filter(Boolean).join(" ").trim() || "Guest";
  const receiptSent = await sendPaymentReceiptEmail(
    recipientEmail,
    caretaker.campName,
    [{ label: "Camp site fee", amountCents }],
    amountCents,
    "cash",
    today,
    {
      recipientName,
      checkInDate,
      checkOutDate,
      siteName: res.site_name,
    }
  ).catch((e) => {
    console.error("[caretaker] reservation payment receipt failed:", e);
    return false;
  });

  if (receiptSent) {
    await sql`
      UPDATE camp_payments SET receipt_sent_at = NOW()
      WHERE id = (
        SELECT id FROM camp_payments
        WHERE reservation_id = ${reservationId} AND method = 'cash'
        ORDER BY created_at DESC LIMIT 1
      )
    `;
  }

  return NextResponse.json({
    ok: true,
    balanceDueCents: balance.balanceDueCents,
    totalPaidCents: balance.totalPaidCents,
    totalDueCents: balance.totalDueCents,
  });
}
