import { NextRequest, NextResponse } from "next/server";
import { getCaretakerAccess, getCaretakerWriteContext } from "@/lib/caretaker-auth";
import { sql, hasDb } from "@/lib/db";
import { campUsesReservations } from "@/lib/reservation-camps";
import {
  applyPaymentsToExistingPeriods,
  getReservationNetPaidCents,
} from "@/lib/reservation-billing";

/** Camp caretakers can void their camp's cash entries this many days after recording; directors anytime. */
const CARETAKER_CASH_VOID_WINDOW_DAYS = 30;

/**
 * POST /api/members/caretaker/payments/void-cash
 * Remove a mistaken cash entry (cash never received). Keeps an audit snapshot in camp_payment_voids
 * and re-applies remaining payments to the reservation's billing periods.
 * Body: { paymentId, reason, campSlug? }
 */
export async function POST(request: NextRequest) {
  let body: { paymentId?: string; reason?: string; campSlug?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const access = await getCaretakerAccess();
  const campSlugOverride = typeof body.campSlug === "string" ? body.campSlug.trim() : undefined;
  const caretaker = await getCaretakerWriteContext(campSlugOverride);
  if (!access || !caretaker) {
    return NextResponse.json({ error: "Caretaker access required" }, { status: 403 });
  }
  if (!campUsesReservations(caretaker.campSlug)) {
    return NextResponse.json({ error: "Reservation system not available for this camp" }, { status: 403 });
  }
  if (!hasDb() || !sql) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  const paymentId = typeof body.paymentId === "string" ? body.paymentId.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!paymentId) {
    return NextResponse.json({ error: "paymentId required" }, { status: 400 });
  }
  if (reason.length < 5) {
    return NextResponse.json({ error: "Please give a reason (at least 5 characters)" }, { status: 400 });
  }

  const rows = await sql`
    SELECT p.id, p.camp_slug, p.payment_type, p.method, p.amount_cents, p.reservation_id, p.created_at,
           r.status AS reservation_status,
           EXISTS (SELECT 1 FROM camp_payments x WHERE x.refunded_payment_id = p.id) AS has_refunds
    FROM camp_payments p
    LEFT JOIN camp_reservations r ON r.id = p.reservation_id
    WHERE p.id = ${paymentId} AND p.camp_slug = ${caretaker.campSlug}
    LIMIT 1
  `;
  const payment = (Array.isArray(rows) ? rows[0] : undefined) as
    | {
        id: string;
        camp_slug: string;
        payment_type: string;
        method: string;
        amount_cents: number;
        reservation_id: string | null;
        created_at: string | Date;
        reservation_status: string | null;
        has_refunds: boolean;
      }
    | undefined;

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }
  if (payment.method !== "cash" || payment.payment_type !== "reservation" || !payment.reservation_id) {
    return NextResponse.json({ error: "Only cash site-fee entries can be voided" }, { status: 400 });
  }
  if (payment.reservation_status === "cancelled") {
    return NextResponse.json(
      { error: "This reservation is cancelled. Contact the LDMA office to correct its payments." },
      { status: 400 }
    );
  }
  if (payment.has_refunds) {
    return NextResponse.json(
      { error: "A refund was recorded against this payment. Contact the LDMA office to correct it." },
      { status: 400 }
    );
  }
  if (access.mode !== "admin") {
    const ageDays = (Date.now() - new Date(payment.created_at).getTime()) / 86_400_000;
    if (ageDays > CARETAKER_CASH_VOID_WINDOW_DAYS) {
      return NextResponse.json(
        {
          error: `Cash entries older than ${CARETAKER_CASH_VOID_WINDOW_DAYS} days can only be voided by the LDMA office.`,
        },
        { status: 403 }
      );
    }
  }

  const reservationId = payment.reservation_id;
  const netPaidBefore = await getReservationNetPaidCents(reservationId);

  try {
    const voided = await sql`
      WITH removed AS (
        DELETE FROM camp_payments WHERE id = ${paymentId} RETURNING *
      )
      INSERT INTO camp_payment_voids (
        original_payment_id, camp_slug, reservation_id, payment_type, method, amount_cents,
        original_created_at, original_created_by_contact_id, payment_snapshot,
        reason, voided_by_contact_id
      )
      SELECT removed.id, removed.camp_slug, removed.reservation_id, removed.payment_type, removed.method,
             removed.amount_cents, removed.created_at, removed.created_by_contact_id, to_jsonb(removed),
             ${reason}, ${caretaker.contactId}
      FROM removed
      RETURNING id
    `;
    if (!Array.isArray(voided) || voided.length === 0) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }
  } catch (e) {
    console.error("[caretaker] void cash entry failed:", e);
    return NextResponse.json({ error: "Could not void this entry" }, { status: 500 });
  }

  const balance = await applyPaymentsToExistingPeriods(reservationId, {
    paidCentsOverride: netPaidBefore - payment.amount_cents,
  });

  return NextResponse.json({
    ok: true,
    voidedCents: payment.amount_cents,
    balanceDueCents: balance.balanceDueCents,
    totalPaidCents: balance.totalPaidCents,
    totalDueCents: balance.totalDueCents,
  });
}
