/**
 * Billing period persistence and payment waterfall for camp reservations.
 */

import { sql, hasDb } from "@/lib/db";
import { allocatePaidWaterfall } from "@/lib/backfill-billing-periods";
import {
  generateBillingPeriods,
  computeStayPricing,
  type SiteRates,
  type BillingPeriodDraft,
} from "@/lib/reservation-pricing";
import { countNights } from "@/lib/reservation-dates";
import { scalePeriodDraftsToTotal } from "@/lib/reservation-price-override";

export type BillingPeriodSummary = {
  id: string;
  periodIndex: number;
  periodStart: string;
  periodEnd: string;
  nights: number;
  amountDueCents: number;
  amountPaidCents: number;
  dueDate: string;
  status: string;
  pricingBasis: string;
};

type PeriodRow = {
  id: string;
  period_index: number;
  period_start: string;
  period_end: string;
  nights: number;
  amount_due_cents: number;
  amount_paid_cents: number;
  due_date: string;
  status: string;
  pricing_basis: string;
};

export function siteRatesFromRow(row: {
  member_rate_daily?: number | string | null;
  member_rate_monthly?: number | string | null;
  non_member_rate_daily?: number | string | null;
}): SiteRates {
  const num = (v: number | string | null | undefined) => {
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : parseFloat(String(v));
    return Number.isNaN(n) ? null : n;
  };
  return {
    memberRateDaily: num(row.member_rate_daily),
    memberRateMonthly: num(row.member_rate_monthly),
    nonMemberRateDaily: num(row.non_member_rate_daily),
  };
}

export function periodRowToSummary(row: PeriodRow): BillingPeriodSummary {
  return {
    id: row.id,
    periodIndex: row.period_index,
    periodStart: String(row.period_start).slice(0, 10),
    periodEnd: String(row.period_end).slice(0, 10),
    nights: row.nights,
    amountDueCents: row.amount_due_cents,
    amountPaidCents: row.amount_paid_cents,
    dueDate: String(row.due_date).slice(0, 10),
    status: row.status,
    pricingBasis: row.pricing_basis,
  };
}

export function computeStayTotalCents(input: {
  checkInDate: string;
  checkOutDate: string;
  isMember: boolean;
  rates: SiteRates;
}): number {
  return computeStayPricing(input).totalCents;
}

export type ReservationPaymentSummary = {
  id: string;
  method: string;
  amountCents: number;
  paymentType: string;
  invoiceNumber: string | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  createdAt: string;
};

export async function listReservationPayments(reservationId: string): Promise<ReservationPaymentSummary[]> {
  if (!hasDb() || !sql) return [];
  const rows = await sql`
    SELECT id, method, amount_cents, payment_type, invoice_number,
           stripe_checkout_session_id, stripe_payment_intent_id, created_at
    FROM camp_payments
    WHERE reservation_id = ${reservationId}
    ORDER BY created_at ASC
  `;
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const r = row as {
      id: string;
      method: string;
      amount_cents: number;
      payment_type: string;
      invoice_number: string | null;
      stripe_checkout_session_id: string | null;
      stripe_payment_intent_id: string | null;
      created_at: string;
    };
    return {
      id: r.id,
      method: r.method,
      amountCents: r.amount_cents,
      paymentType: r.payment_type,
      invoiceNumber: r.invoice_number,
      stripeCheckoutSessionId: r.stripe_checkout_session_id,
      stripePaymentIntentId: r.stripe_payment_intent_id,
      createdAt: String(r.created_at),
    };
  });
}

export async function getReservationPaymentsTotalCents(reservationId: string): Promise<number> {
  if (!hasDb() || !sql) return 0;
  const rows = await sql`
    SELECT COALESCE(SUM(
      CASE
        WHEN payment_type = 'reservation' THEN amount_cents
        WHEN payment_type = 'refund' THEN -amount_cents
        ELSE 0
      END
    ), 0)::int AS total
    FROM camp_payments
    WHERE reservation_id = ${reservationId}
  `;
  const row = (Array.isArray(rows) ? rows[0] : undefined) as { total: number } | undefined;
  return Math.max(0, row?.total ?? 0);
}

export async function listBillingPeriods(reservationId: string): Promise<BillingPeriodSummary[]> {
  if (!hasDb() || !sql) return [];
  const rows = await sql`
    SELECT id, period_index, period_start, period_end, nights,
           amount_due_cents, amount_paid_cents, due_date, status, pricing_basis
    FROM camp_billing_periods
    WHERE reservation_id = ${reservationId}
    ORDER BY period_index ASC
  `;
  return (Array.isArray(rows) ? rows : []).map((r) => periodRowToSummary(r as PeriodRow));
}

async function upsertPeriodRows(reservationId: string, periods: ReturnType<typeof allocatePaidWaterfall>) {
  if (!sql) return;
  for (const p of periods) {
    await sql`
      INSERT INTO camp_billing_periods (
        reservation_id, period_index, period_start, period_end, nights,
        amount_due_cents, amount_paid_cents, due_date, status, pricing_basis
      ) VALUES (
        ${reservationId}, ${p.periodIndex}, ${p.periodStart}, ${p.periodEnd}, ${p.nights},
        ${p.amountDueCents}, ${p.amountPaidCents}, ${p.dueDate}, ${p.status}, ${p.pricingBasis}
      )
      ON CONFLICT (reservation_id, period_index) DO UPDATE SET
        period_start = EXCLUDED.period_start,
        period_end = EXCLUDED.period_end,
        nights = EXCLUDED.nights,
        amount_due_cents = EXCLUDED.amount_due_cents,
        amount_paid_cents = EXCLUDED.amount_paid_cents,
        due_date = EXCLUDED.due_date,
        status = EXCLUDED.status,
        pricing_basis = EXCLUDED.pricing_basis,
        updated_at = NOW()
    `;
  }
}

/** Create billing periods for a new reservation (no payments yet). */
export async function insertBillingPeriodsForReservation(
  reservationId: string,
  drafts: BillingPeriodDraft[]
): Promise<void> {
  if (!sql || drafts.length === 0) return;
  const empty = allocatePaidWaterfall(drafts, 0);
  await upsertPeriodRows(reservationId, empty);
}

/** Regenerate periods from stay dates/rates and re-apply all reservation payments. */
export async function syncBillingPeriodsForReservation(input: {
  reservationId: string;
  checkInDate: string;
  checkOutDate: string;
  isMember: boolean;
  rates: SiteRates;
  effectiveTotalCents?: number;
}): Promise<{ totalDueCents: number; totalPaidCents: number; balanceDueCents: number }> {
  if (!hasDb() || !sql) {
    return { totalDueCents: 0, totalPaidCents: 0, balanceDueCents: 0 };
  }

  let drafts = generateBillingPeriods({
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    isMember: input.isMember,
    rates: input.rates,
  });

  if (typeof input.effectiveTotalCents === "number" && input.effectiveTotalCents >= 0) {
    drafts = scalePeriodDraftsToTotal(drafts, input.effectiveTotalCents);
  }

  const totalPaidCents = await getReservationPaymentsTotalCents(input.reservationId);
  const allocated = allocatePaidWaterfall(drafts, totalPaidCents);

  await sql`DELETE FROM camp_billing_periods WHERE reservation_id = ${input.reservationId}`;
  await upsertPeriodRows(input.reservationId, allocated);

  const totalDueCents = allocated.reduce((s, p) => s + p.amountDueCents, 0);
  const appliedPaid = allocated.reduce((s, p) => s + p.amountPaidCents, 0);
  return {
    totalDueCents,
    totalPaidCents: appliedPaid,
    balanceDueCents: Math.max(0, totalDueCents - appliedPaid),
  };
}

export async function getReservationBalance(reservationId: string): Promise<{
  totalDueCents: number;
  totalPaidCents: number;
  balanceDueCents: number;
}> {
  const periods = await listBillingPeriods(reservationId);
  if (periods.length === 0) {
    const paid = await getReservationPaymentsTotalCents(reservationId);
    return { totalDueCents: 0, totalPaidCents: paid, balanceDueCents: 0 };
  }
  const totalDueCents = periods.reduce((s, p) => s + p.amountDueCents, 0);
  const totalPaidCents = periods.reduce((s, p) => s + p.amountPaidCents, 0);
  return {
    totalDueCents,
    totalPaidCents,
    balanceDueCents: Math.max(0, totalDueCents - totalPaidCents),
  };
}

export function stayNights(checkInDate: string, checkOutDate: string): number {
  return countNights(checkInDate, checkOutDate);
}

export type ReservationBalanceSummary = {
  balanceDueCents: number;
  totalDueCents: number;
  totalPaidCents: number;
  hasOverduePeriod: boolean;
  nextDueDate: string | null;
};

/** Batch balance summary for reservation list views. */
export async function summarizeReservationBalances(
  reservationIds: string[]
): Promise<Map<string, ReservationBalanceSummary>> {
  const out = new Map<string, ReservationBalanceSummary>();
  if (!hasDb() || !sql || reservationIds.length === 0) return out;

  const today = new Date().toISOString().slice(0, 10);
  const rows = await sql`
    SELECT reservation_id,
           COALESCE(SUM(amount_due_cents), 0)::int AS total_due,
           COALESCE(SUM(amount_paid_cents), 0)::int AS total_paid,
           BOOL_OR(status IN ('unpaid', 'partial') AND due_date < ${today}::date) AS has_overdue,
           MIN(due_date) FILTER (WHERE status IN ('unpaid', 'partial'))::text AS next_due
    FROM camp_billing_periods
    WHERE reservation_id = ANY(${reservationIds}::uuid[])
      AND status != 'cancelled'
    GROUP BY reservation_id
  `;

  for (const row of Array.isArray(rows) ? rows : []) {
    const r = row as {
      reservation_id: string;
      total_due: number;
      total_paid: number;
      has_overdue: boolean;
      next_due: string | null;
    };
    const balanceDueCents = Math.max(0, r.total_due - r.total_paid);
    out.set(r.reservation_id, {
      balanceDueCents,
      totalDueCents: r.total_due,
      totalPaidCents: r.total_paid,
      hasOverduePeriod: Boolean(r.has_overdue),
      nextDueDate: r.next_due ? String(r.next_due).slice(0, 10) : null,
    });
  }

  return out;
}
