/**
 * Cancel reservation with site-fee refund (preview + execute).
 */

import Stripe from "stripe";
import { sql, hasDb } from "@/lib/db";
import { computeCancellationRefund, type CancellationRefundResult } from "@/lib/cancellation-refund";
import { isHookupSiteType } from "@/lib/reservation-camps";
import { syncReservationToKlaviyo } from "@/lib/klaviyo-camp-stay";

export type CancelPreview = CancellationRefundResult & {
  reservationId: string;
  cardPaidCents: number;
  cashPaidCents: number;
  stripeRefundCents: number;
  cashRefundCents: number;
};

type PaymentRow = {
  id: string;
  method: string;
  amount_cents: number;
  stripe_payment_intent_id: string | null;
  member_email: string;
  recipient_display_name: string;
  member_contact_id: string | null;
  member_number: string | null;
};

async function paymentTotals(reservationId: string) {
  if (!sql) return { paid: 0, refunded: 0, cardPaid: 0, cashPaid: 0 };
  const paidRes = await sql`
    SELECT
      COALESCE(SUM(amount_cents) FILTER (WHERE payment_type = 'reservation'), 0)::int AS paid,
      COALESCE(SUM(amount_cents) FILTER (WHERE payment_type = 'refund'), 0)::int AS refunded,
      COALESCE(SUM(amount_cents) FILTER (WHERE payment_type = 'reservation' AND method = 'card'), 0)::int AS card_paid,
      COALESCE(SUM(amount_cents) FILTER (WHERE payment_type = 'reservation' AND method = 'cash'), 0)::int AS cash_paid
    FROM camp_payments
    WHERE reservation_id = ${reservationId}
  `;
  const row = (Array.isArray(paidRes) ? paidRes[0] : undefined) as
    | { paid: number; refunded: number; card_paid: number; cash_paid: number }
    | undefined;
  return {
    paid: row?.paid ?? 0,
    refunded: row?.refunded ?? 0,
    cardPaid: row?.card_paid ?? 0,
    cashPaid: row?.cash_paid ?? 0,
  };
}

async function refundedForPayment(paymentId: string): Promise<number> {
  if (!sql) return 0;
  const rows = await sql`
    SELECT COALESCE(SUM(amount_cents), 0)::int AS n
    FROM camp_payments
    WHERE refunded_payment_id = ${paymentId} AND payment_type = 'refund'
  `;
  return ((Array.isArray(rows) ? rows[0] : undefined) as { n: number } | undefined)?.n ?? 0;
}

function allocateRefund(refundCents: number, cardPaid: number, cashPaid: number, alreadyRefunded: number) {
  const cardRemaining = Math.max(0, cardPaid - alreadyRefunded);
  const stripeRefundCents = Math.min(refundCents, cardRemaining);
  const cashRefundCents = Math.max(0, refundCents - stripeRefundCents);
  void cashPaid;
  return { stripeRefundCents, cashRefundCents };
}

export async function buildCancelPreview(
  reservationId: string,
  campSlug: string,
  cancelDate?: string
): Promise<CancelPreview | null> {
  if (!hasDb() || !sql) return null;

  const today = new Date().toISOString().slice(0, 10);
  const effectiveCancel = cancelDate?.slice(0, 10) || today;

  const rows = await sql`
    SELECT r.id, r.camp_slug, r.check_in_date, r.check_out_date, r.nights, r.reservation_type, r.status,
           s.site_type, s.member_rate_daily
    FROM camp_reservations r
    JOIN camp_sites s ON s.id = r.site_id
    WHERE r.id = ${reservationId} AND r.camp_slug = ${campSlug}
    LIMIT 1
  `;
  const res = (Array.isArray(rows) ? rows[0] : undefined) as
    | {
        id: string;
        check_in_date: string;
        check_out_date: string;
        nights: number;
        reservation_type: string;
        status: string;
        site_type: string;
        member_rate_daily: number | null;
      }
    | undefined;
  if (!res || res.status === "cancelled") return null;

  const totals = await paymentTotals(reservationId);
  const calc = computeCancellationRefund({
    cancelDate: effectiveCancel,
    checkInDate: String(res.check_in_date).slice(0, 10),
    checkOutDate: String(res.check_out_date).slice(0, 10),
    totalNights: res.nights,
    isMember: res.reservation_type === "member",
    isHookupSite: isHookupSiteType(res.site_type),
    memberRateDaily: res.member_rate_daily,
    totalPaidCents: totals.paid,
    totalRefundedCents: totals.refunded,
  });

  const { stripeRefundCents, cashRefundCents } = allocateRefund(
    calc.refundCents,
    totals.cardPaid,
    totals.cashPaid,
    totals.refunded
  );

  return {
    ...calc,
    reservationId,
    cardPaidCents: totals.cardPaid,
    cashPaidCents: totals.cashPaid,
    stripeRefundCents,
    cashRefundCents,
  };
}

export async function executeCancellation(input: {
  reservationId: string;
  campSlug: string;
  createdByContactId: string;
  cancelDate?: string;
}): Promise<{ ok: true; preview: CancelPreview } | { ok: false; error: string }> {
  if (!hasDb() || !sql) return { ok: false, error: "Database not available" };

  const preview = await buildCancelPreview(input.reservationId, input.campSlug, input.cancelDate);
  if (!preview) return { ok: false, error: "Reservation not found or already cancelled" };

  const resRows = await sql`
    SELECT r.id, r.camp_slug, r.check_out_date, r.reservation_type, r.member_number, r.member_display_name,
           r.guest_email, r.guest_first_name, r.guest_last_name, r.status
    FROM camp_reservations r
    WHERE r.id = ${input.reservationId} AND r.camp_slug = ${input.campSlug}
    LIMIT 1
  `;
  const resRow = (Array.isArray(resRows) ? resRows[0] : undefined) as {
    id: string;
    camp_slug: string;
    check_out_date: string;
    reservation_type: string;
    member_number: string | null;
    member_display_name: string | null;
    guest_email: string | null;
    guest_first_name: string | null;
    guest_last_name: string | null;
    status: string;
  } | undefined;
  if (!resRow) return { ok: false, error: "Reservation not found" };

  if (preview.refundCents > 0) {
    const payRows = await sql`
      SELECT id, method, amount_cents, stripe_payment_intent_id, member_email, recipient_display_name,
             member_contact_id, member_number
      FROM camp_payments
      WHERE reservation_id = ${input.reservationId} AND payment_type = 'reservation'
      ORDER BY created_at DESC
    `;
    const payments = (Array.isArray(payRows) ? payRows : []) as PaymentRow[];
    const lastPay = payments[0];
    const recipientEmail = lastPay?.member_email ?? resRow.guest_email ?? "noreply@ldma.org";
    const recipientName =
      lastPay?.recipient_display_name ??
      (resRow.reservation_type === "member"
        ? resRow.member_display_name ?? "Member"
        : [resRow.guest_first_name, resRow.guest_last_name].filter(Boolean).join(" ").trim() || "Guest");

    let stripeRemaining = preview.stripeRefundCents;
    const secretKey = process.env.STRIPE_RESTRICTED_KEY || process.env.STRIPE_SECRET_KEY;
    const stripe = secretKey ? new Stripe(secretKey) : null;

    for (const p of payments) {
      if (stripeRemaining <= 0) break;
      if (p.method !== "card" || !p.stripe_payment_intent_id) continue;
      const already = await refundedForPayment(p.id);
      const available = Math.max(0, p.amount_cents - already);
      const apply = Math.min(stripeRemaining, available);
      if (apply <= 0) continue;

      let stripeRefundId: string | null = null;
      if (stripe) {
        try {
          const refund = await stripe.refunds.create({
            payment_intent: p.stripe_payment_intent_id,
            amount: apply,
          });
          stripeRefundId = refund.id;
        } catch (e) {
          console.error("[cancel] Stripe refund failed:", e);
          return { ok: false, error: "Stripe refund failed" };
        }
      }

      await sql`
        INSERT INTO camp_payments (
          camp_slug, payment_type, method, amount_cents, reservation_id,
          member_contact_id, member_number, member_email, recipient_display_name,
          stripe_payment_intent_id, stripe_refund_id, refunded_payment_id,
          created_by_contact_id, created_at
        )
        VALUES (
          ${input.campSlug}, 'refund', 'card', ${apply}, ${input.reservationId},
          ${p.member_contact_id}, ${p.member_number}, ${recipientEmail}, ${recipientName},
          ${p.stripe_payment_intent_id}, ${stripeRefundId}, ${p.id},
          ${input.createdByContactId}, NOW()
        )
      `;
      stripeRemaining -= apply;
    }

    if (preview.cashRefundCents > 0) {
      await sql`
        INSERT INTO camp_payments (
          camp_slug, payment_type, method, amount_cents, reservation_id,
          member_contact_id, member_number, member_email, recipient_display_name,
          created_by_contact_id, created_at
        )
        VALUES (
          ${input.campSlug}, 'refund', 'cash', ${preview.cashRefundCents}, ${input.reservationId},
          ${lastPay?.member_contact_id ?? null}, ${lastPay?.member_number ?? resRow.member_number},
          ${recipientEmail}, ${recipientName},
          ${input.createdByContactId}, NOW()
        )
      `;
    }
  }

  await sql`
    UPDATE camp_reservations
    SET status = 'cancelled', cancelled_at = NOW(), cancellation_refund_cents = ${preview.refundCents}, updated_at = NOW()
    WHERE id = ${input.reservationId}
  `;
  await sql`
    UPDATE camp_billing_periods SET status = 'cancelled', updated_at = NOW()
    WHERE reservation_id = ${input.reservationId} AND status IN ('unpaid', 'partial')
  `;

  syncReservationToKlaviyo({ ...resRow, status: "cancelled" }).catch((e) =>
    console.error("[Klaviyo] sync after cancel:", e)
  );

  return { ok: true, preview };
}
