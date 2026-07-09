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
import { countNights, toDateOnlyStr } from "@/lib/reservation-dates";
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
  const totals = await getReservationPaymentTotals(reservationId);
  return totals.netPaidCents;
}

/** Sum of amount_paid_cents on billing periods (includes ResNexus import credits with no camp_payments row). */
export async function getBillingPeriodsPaidTotalCents(reservationId: string): Promise<number> {
  if (!hasDb() || !sql) return 0;
  const rows = await sql`
    SELECT COALESCE(SUM(amount_paid_cents), 0)::int AS paid
    FROM camp_billing_periods
    WHERE reservation_id = ${reservationId}
      AND status != 'cancelled'
  `;
  return ((Array.isArray(rows) ? rows[0] : undefined) as { paid: number } | undefined)?.paid ?? 0;
}

/**
 * Net paid for waterfall allocation: max(camp_payments ledger, billing period paid).
 * ResNexus imports store credits on periods only; without this, sync/move wipes them.
 */
export async function getReservationNetPaidCents(reservationId: string): Promise<number> {
  const [paymentNet, periodPaid] = await Promise.all([
    getReservationPaymentsTotalCents(reservationId),
    getBillingPeriodsPaidTotalCents(reservationId),
  ]);
  return Math.max(paymentNet, periodPaid);
}

export async function getReservationPaymentTotals(reservationId: string): Promise<{
  totalPaidCents: number;
  totalRefundedCents: number;
  netPaidCents: number;
}> {
  if (!hasDb() || !sql) {
    return { totalPaidCents: 0, totalRefundedCents: 0, netPaidCents: 0 };
  }
  const rows = await sql`
    SELECT
      COALESCE(SUM(amount_cents) FILTER (WHERE payment_type = 'reservation'), 0)::int AS paid,
      COALESCE(SUM(amount_cents) FILTER (WHERE payment_type = 'refund'), 0)::int AS refunded
    FROM camp_payments
    WHERE reservation_id = ${reservationId}
  `;
  const row = (Array.isArray(rows) ? rows[0] : undefined) as
    | { paid: number; refunded: number }
    | undefined;
  const totalPaidCents = row?.paid ?? 0;
  const totalRefundedCents = row?.refunded ?? 0;
  return {
    totalPaidCents,
    totalRefundedCents,
    netPaidCents: Math.max(0, totalPaidCents - totalRefundedCents),
  };
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

  const totalPaidCents = await getReservationNetPaidCents(input.reservationId);
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

/** Rebuild billing periods from the reservation's current site and dates in the database. */
export async function resyncReservationBillingFromDb(reservationId: string): Promise<{
  totalDueCents: number;
  totalPaidCents: number;
  balanceDueCents: number;
}> {
  if (!hasDb() || !sql) {
    return { totalDueCents: 0, totalPaidCents: 0, balanceDueCents: 0 };
  }

  const rows = await sql`
    SELECT r.check_in_date, r.check_out_date, r.reservation_type,
           r.amount_override_cents, r.price_override_flag,
           s.member_rate_daily, s.member_rate_monthly, s.non_member_rate_daily
    FROM camp_reservations r
    JOIN camp_sites s ON s.id = r.site_id
    WHERE r.id = ${reservationId}
    LIMIT 1
  `;
  const row = (Array.isArray(rows) ? rows[0] : undefined) as
    | {
        check_in_date: string | Date;
        check_out_date: string | Date;
        reservation_type: string;
        amount_override_cents: number | null;
        price_override_flag: boolean | null;
        member_rate_daily: number | string | null;
        member_rate_monthly: number | string | null;
        non_member_rate_daily: number | string | null;
      }
    | undefined;
  if (!row) {
    throw new Error(`Reservation not found: ${reservationId}`);
  }

  const checkInDate = toDateOnlyStr(row.check_in_date);
  const checkOutDate = toDateOnlyStr(row.check_out_date);
  const isMember = row.reservation_type === "member";
  const rates = siteRatesFromRow(row);
  const calculatedTotalCents = computeStayPricing({
    checkInDate,
    checkOutDate,
    isMember,
    rates,
  }).totalCents;

  const effectiveTotalCents =
    row.price_override_flag && row.amount_override_cents != null
      ? row.amount_override_cents
      : undefined;

  return syncBillingPeriodsForReservation({
    reservationId,
    checkInDate,
    checkOutDate,
    isMember,
    rates,
    effectiveTotalCents,
  });
}

/**
 * Set an explicit balance due by scaling billing to effectiveTotal = balanceDue + netPaid.
 * Persists amount_override_cents so future resyncs keep the override.
 */
export async function applyReservationBalanceOverride(input: {
  reservationId: string;
  balanceDueCents: number;
  overrideReason: string;
}): Promise<{ totalDueCents: number; totalPaidCents: number; balanceDueCents: number }> {
  if (!hasDb() || !sql) {
    return { totalDueCents: 0, totalPaidCents: 0, balanceDueCents: 0 };
  }

  const balanceDueCents = Math.max(0, Math.round(input.balanceDueCents));
  const reason = input.overrideReason.trim();
  if (reason.length < 3) {
    throw new Error("Override reason required (min 3 characters)");
  }

  const rows = await sql`
    SELECT r.check_in_date, r.check_out_date, r.reservation_type,
           s.member_rate_daily, s.member_rate_monthly, s.non_member_rate_daily
    FROM camp_reservations r
    JOIN camp_sites s ON s.id = r.site_id
    WHERE r.id = ${input.reservationId}
    LIMIT 1
  `;
  const row = (Array.isArray(rows) ? rows[0] : undefined) as
    | {
        check_in_date: string | Date;
        check_out_date: string | Date;
        reservation_type: string;
        member_rate_daily: number | string | null;
        member_rate_monthly: number | string | null;
        non_member_rate_daily: number | string | null;
      }
    | undefined;
  if (!row) {
    throw new Error(`Reservation not found: ${input.reservationId}`);
  }

  const checkInDate = toDateOnlyStr(row.check_in_date);
  const checkOutDate = toDateOnlyStr(row.check_out_date);
  const isMember = row.reservation_type === "member";
  const rates = siteRatesFromRow(row);
  const calculatedTotalCents = computeStayPricing({
    checkInDate,
    checkOutDate,
    isMember,
    rates,
  }).totalCents;

  const netPaidCents = await getReservationNetPaidCents(input.reservationId);
  const effectiveTotalCents = balanceDueCents + netPaidCents;

  await sql`
    UPDATE camp_reservations
    SET calculated_total_cents = ${calculatedTotalCents},
        amount_override_cents = ${effectiveTotalCents},
        override_reason = ${reason},
        price_override_flag = TRUE,
        updated_at = NOW()
    WHERE id = ${input.reservationId}
  `;

  return syncBillingPeriodsForReservation({
    reservationId: input.reservationId,
    checkInDate,
    checkOutDate,
    isMember,
    rates,
    effectiveTotalCents,
  });
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

/** Remaining due on the earliest unpaid/partial billing period, or full balance. */
export function suggestedReservationPaymentCents(
  billingPeriods: Pick<BillingPeriodSummary, "status" | "amountDueCents" | "amountPaidCents">[],
  balanceDueCents: number
): number {
  if (balanceDueCents <= 0) return 0;
  for (const p of billingPeriods) {
    if (p.status === "unpaid" || p.status === "partial") {
      const remaining = Math.max(0, p.amountDueCents - p.amountPaidCents);
      if (remaining > 0) return Math.min(remaining, balanceDueCents);
    }
  }
  return balanceDueCents;
}
