/**
 * Partial site-fee refund for a reservation (card via Stripe, remainder as cash record).
 * Shared by cancellation and site-move flows.
 */

import Stripe from "stripe";
import { sql } from "@/lib/db";
import { getBillingPeriodsPaidTotalCents } from "@/lib/reservation-billing";

type PaymentRow = {
  id: string;
  method: string;
  amount_cents: number;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  member_email: string;
  recipient_display_name: string;
  member_contact_id: string | null;
  member_number: string | null;
};

async function resolvePaymentIntentId(stripe: Stripe, payment: PaymentRow): Promise<string | null> {
  if (payment.stripe_payment_intent_id) return payment.stripe_payment_intent_id;
  if (!payment.stripe_checkout_session_id) return null;
  try {
    const session = await stripe.checkout.sessions.retrieve(payment.stripe_checkout_session_id);
    const pi = session.payment_intent;
    return typeof pi === "string" ? pi : pi?.id ?? null;
  } catch (e) {
    console.error("[refund] Could not resolve payment intent from checkout session:", e);
    return null;
  }
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

export type ReservationPaymentTotals = {
  paidCents: number;
  refundedCents: number;
  netPaidCents: number;
  cardPaidCents: number;
  cashPaidCents: number;
};

export async function getReservationSiteFeeTotals(
  reservationId: string
): Promise<ReservationPaymentTotals> {
  if (!sql) {
    return { paidCents: 0, refundedCents: 0, netPaidCents: 0, cardPaidCents: 0, cashPaidCents: 0 };
  }
  const rows = await sql`
    SELECT
      COALESCE(SUM(amount_cents) FILTER (WHERE payment_type = 'reservation'), 0)::int AS paid,
      COALESCE(SUM(amount_cents) FILTER (WHERE payment_type = 'refund'), 0)::int AS refunded,
      COALESCE(SUM(amount_cents) FILTER (WHERE payment_type = 'reservation' AND method = 'card'), 0)::int AS card_paid,
      COALESCE(SUM(amount_cents) FILTER (WHERE payment_type = 'reservation' AND method = 'cash'), 0)::int AS cash_paid
    FROM camp_payments
    WHERE reservation_id = ${reservationId}
  `;
  const row = (Array.isArray(rows) ? rows[0] : undefined) as
    | { paid: number; refunded: number; card_paid: number; cash_paid: number }
    | undefined;
  const paidCents = row?.paid ?? 0;
  const refundedCents = row?.refunded ?? 0;
  const ledgerNetPaidCents = Math.max(0, paidCents - refundedCents);
  const periodPaidCents = await getBillingPeriodsPaidTotalCents(reservationId);
  return {
    paidCents,
    refundedCents,
    netPaidCents: Math.max(ledgerNetPaidCents, periodPaidCents),
    cardPaidCents: row?.card_paid ?? 0,
    cashPaidCents: row?.cash_paid ?? 0,
  };
}

/**
 * Allocate a refund across card (Stripe) then cash, based on what's still refundable.
 * Card is refunded first (real money back to the customer); any remainder is recorded as cash.
 */
export function allocateRefundSplit(
  refundCents: number,
  cardPaidCents: number,
  alreadyRefundedCents: number
): { stripeRefundCents: number; cashRefundCents: number } {
  const cardRemaining = Math.max(0, cardPaidCents - alreadyRefundedCents);
  const stripeRefundCents = Math.min(refundCents, cardRemaining);
  const cashRefundCents = Math.max(0, refundCents - stripeRefundCents);
  return { stripeRefundCents, cashRefundCents };
}

/**
 * Refund up to `refundCents` of a reservation's site fees. Refunds card payments through Stripe
 * first, then records any remainder as a cash refund. Inserts refund rows in camp_payments.
 */
export async function refundReservationSiteFees(input: {
  reservationId: string;
  campSlug: string;
  createdByContactId: string;
  refundCents: number;
}): Promise<
  | { ok: true; stripeRefundCents: number; cashRefundCents: number; totalRefundedCents: number }
  | { ok: false; error: string }
> {
  if (!sql) return { ok: false, error: "Database not available" };
  if (input.refundCents <= 0) {
    return { ok: true, stripeRefundCents: 0, cashRefundCents: 0, totalRefundedCents: 0 };
  }

  const totals = await getReservationSiteFeeTotals(input.reservationId);
  const refundable = Math.max(0, totals.netPaidCents);
  const refundCents = Math.min(input.refundCents, refundable);
  if (refundCents <= 0) {
    return { ok: true, stripeRefundCents: 0, cashRefundCents: 0, totalRefundedCents: 0 };
  }

  const resRows = await sql`
    SELECT reservation_type, member_number, member_display_name,
           guest_email, guest_first_name, guest_last_name
    FROM camp_reservations
    WHERE id = ${input.reservationId} AND camp_slug = ${input.campSlug}
    LIMIT 1
  `;
  const resRow = (Array.isArray(resRows) ? resRows[0] : undefined) as
    | {
        reservation_type: string;
        member_number: string | null;
        member_display_name: string | null;
        guest_email: string | null;
        guest_first_name: string | null;
        guest_last_name: string | null;
      }
    | undefined;
  if (!resRow) return { ok: false, error: "Reservation not found" };

  const payRows = await sql`
    SELECT id, method, amount_cents, stripe_payment_intent_id, stripe_checkout_session_id,
           member_email, recipient_display_name, member_contact_id, member_number
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

  const { stripeRefundCents, cashRefundCents } = allocateRefundSplit(
    refundCents,
    totals.cardPaidCents,
    totals.refundedCents
  );

  let stripeRemaining = stripeRefundCents;
  const secretKey = process.env.STRIPE_RESTRICTED_KEY || process.env.STRIPE_SECRET_KEY;
  const stripe = secretKey ? new Stripe(secretKey) : null;

  if (stripeRefundCents > 0 && !stripe) {
    return { ok: false, error: "Stripe is not configured; cannot process card refund" };
  }

  for (const p of payments) {
    if (stripeRemaining <= 0) break;
    if (p.method !== "card") continue;

    const paymentIntentId = stripe ? await resolvePaymentIntentId(stripe, p) : p.stripe_payment_intent_id;
    if (!paymentIntentId) continue;

    const already = await refundedForPayment(p.id);
    const available = Math.max(0, p.amount_cents - already);
    const apply = Math.min(stripeRemaining, available);
    if (apply <= 0) continue;

    let stripeRefundId: string | null = null;
    if (stripe) {
      try {
        const refund = await stripe.refunds.create({ payment_intent: paymentIntentId, amount: apply });
        stripeRefundId = refund.id;
      } catch (e) {
        console.error("[refund] Stripe refund failed:", e);
        const stripeMsg = e instanceof Error && "message" in e ? e.message : "Stripe refund failed";
        return { ok: false, error: `Stripe refund failed: ${stripeMsg}` };
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
        ${paymentIntentId}, ${stripeRefundId}, ${p.id},
        ${input.createdByContactId}, NOW()
      )
    `;
    stripeRemaining -= apply;
  }

  if (stripeRemaining > 0) {
    return {
      ok: false,
      error:
        "Could not refund the full card amount — payment may be missing a Stripe ID or already refunded in Stripe.",
    };
  }

  if (cashRefundCents > 0) {
    await sql`
      INSERT INTO camp_payments (
        camp_slug, payment_type, method, amount_cents, reservation_id,
        member_contact_id, member_number, member_email, recipient_display_name,
        created_by_contact_id, created_at
      )
      VALUES (
        ${input.campSlug}, 'refund', 'cash', ${cashRefundCents}, ${input.reservationId},
        ${lastPay?.member_contact_id ?? null}, ${lastPay?.member_number ?? resRow.member_number},
        ${recipientEmail}, ${recipientName},
        ${input.createdByContactId}, NOW()
      )
    `;
  }

  return {
    ok: true,
    stripeRefundCents,
    cashRefundCents,
    totalRefundedCents: stripeRefundCents + cashRefundCents,
  };
}
