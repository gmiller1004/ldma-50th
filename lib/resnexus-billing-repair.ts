/**
 * Preserve ResNexus billing amounts and payment credits after import / repair.
 */

import type { Client } from "pg";
import type { ParsedReservation, ResNexusCsvRow } from "@/lib/resnexus-import";
import { parseMoney } from "@/lib/resnexus-import";

export const RESNEXUS_IMPORT_OVERRIDE_REASON = "ResNexus import billing amounts";

export function resnexusRawPaidCents(rows: ResNexusCsvRow[]): number {
  return rows.reduce((sum, row) => sum + (parseMoney(row.paid) ?? 0), 0);
}

export function resnexusBillingTotals(parsed: ParsedReservation): {
  totalDueCents: number;
  allocatedPaidCents: number;
} {
  const totalDueCents = parsed.periods.reduce((s, p) => s + p.amountDueCents, 0);
  const allocatedPaidCents = parsed.periods.reduce((s, p) => s + p.amountPaidCents, 0);
  return { totalDueCents, allocatedPaidCents };
}

/** Amount to record in camp_payments (full ResNexus payment, not just per-period allocation). */
export function resnexusLedgerPaidCents(
  parsed: ParsedReservation,
  rows: ResNexusCsvRow[]
): number {
  const { allocatedPaidCents } = resnexusBillingTotals(parsed);
  return Math.max(resnexusRawPaidCents(rows), allocatedPaidCents);
}

export function isResNexusBillingPaidInFull(parsed: ParsedReservation): boolean {
  const { totalDueCents, allocatedPaidCents } = resnexusBillingTotals(parsed);
  return totalDueCents > 0 && allocatedPaidCents >= totalDueCents;
}

function pricingBasisForPeriod(isMember: boolean, nights: number): string {
  if (!isMember) return "guest_daily";
  return nights >= 30 ? "member_monthly_prorated" : "member_daily";
}

export async function upsertResNexusBillingPeriods(
  client: Client,
  reservationId: string,
  parsed: ParsedReservation
): Promise<void> {
  const isMember = parsed.reservationType === "member";
  for (let i = 0; i < parsed.periods.length; i++) {
    const p = parsed.periods[i];
    const basis = pricingBasisForPeriod(isMember, p.nights);
    await client.query(
      `INSERT INTO camp_billing_periods (
         reservation_id, period_index, period_start, period_end, nights,
         amount_due_cents, amount_paid_cents, due_date, status, pricing_basis
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (reservation_id, period_start) DO UPDATE SET
         period_index = EXCLUDED.period_index,
         period_end = EXCLUDED.period_end,
         nights = EXCLUDED.nights,
         amount_due_cents = EXCLUDED.amount_due_cents,
         amount_paid_cents = EXCLUDED.amount_paid_cents,
         due_date = EXCLUDED.due_date,
         status = EXCLUDED.status,
         pricing_basis = EXCLUDED.pricing_basis,
         updated_at = NOW()`,
      [
        reservationId,
        i,
        p.periodStart,
        p.periodEnd,
        p.nights,
        p.amountDueCents,
        p.amountPaidCents,
        p.periodStart,
        p.status,
        basis,
      ]
    );
  }
}

export async function ensureResNexusPaymentLedger(
  client: Client,
  reservationId: string,
  campSlug: string,
  parsed: ParsedReservation,
  rows: ResNexusCsvRow[],
  createdBy: string
): Promise<number> {
  const paidTotal = resnexusLedgerPaidCents(parsed, rows);
  if (paidTotal <= 0) return 0;

  const existing = await client.query(
    `SELECT COALESCE(SUM(amount_cents) FILTER (WHERE payment_type = 'reservation'), 0)::int AS paid
     FROM camp_payments WHERE reservation_id = $1`,
    [reservationId]
  );
  const ledgerPaid = Number(existing.rows[0]?.paid ?? 0);
  if (ledgerPaid >= paidTotal) return 0;

  const amountCents = paidTotal - ledgerPaid;
  const recipientName = parsed.guestName || "Guest";
  const recipientEmail = `resnexus+${parsed.resNumber}@import.ldma.org`;

  await client.query(
    `INSERT INTO camp_payments (
       camp_slug, payment_type, method, amount_cents, reservation_id,
       member_email, recipient_display_name, created_by_contact_id, created_at
     ) VALUES ($1, 'reservation', 'cash', $2, $3, $4, $5, $6, NOW())`,
    [campSlug, amountCents, reservationId, recipientEmail, recipientName, createdBy]
  );
  return amountCents;
}

/** Lock billing resync to ResNexus period totals (not LDMA site-rate recalculation). */
export async function lockResNexusBillingAmounts(
  client: Client,
  reservationId: string,
  resnexusDueCents: number,
  calculatedTotalCents: number | null
): Promise<void> {
  await client.query(
    `UPDATE camp_reservations SET
       calculated_total_cents = COALESCE($2, calculated_total_cents),
       amount_override_cents = $3,
       override_reason = $4,
       price_override_flag = TRUE,
       updated_at = NOW()
     WHERE id = $1`,
    [
      reservationId,
      calculatedTotalCents,
      resnexusDueCents,
      RESNEXUS_IMPORT_OVERRIDE_REASON,
    ]
  );
}

export async function readReservationBalance(
  client: Client,
  reservationId: string
): Promise<{ totalDueCents: number; totalPaidCents: number; balanceDueCents: number }> {
  const res = await client.query(
    `SELECT
       COALESCE(SUM(amount_due_cents), 0)::int AS total_due,
       COALESCE(SUM(amount_paid_cents), 0)::int AS total_paid
     FROM camp_billing_periods
     WHERE reservation_id = $1 AND status != 'cancelled'`,
    [reservationId]
  );
  const totalDueCents = Number(res.rows[0]?.total_due ?? 0);
  const totalPaidCents = Number(res.rows[0]?.total_paid ?? 0);
  return {
    totalDueCents,
    totalPaidCents,
    balanceDueCents: Math.max(0, totalDueCents - totalPaidCents),
  };
}
