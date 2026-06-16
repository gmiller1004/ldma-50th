/**
 * Backfill camp_billing_periods for existing reservations (pilot BR/VM).
 */

import { generateBillingPeriods, type BillingPeriodDraft } from "@/lib/reservation-pricing";
import type { SiteRates } from "@/lib/reservation-pricing";

export type BackfillPeriod = BillingPeriodDraft & {
  amountPaidCents: number;
  status: "unpaid" | "partial" | "paid" | "waived";
};

export function allocatePaidWaterfall(
  periods: BillingPeriodDraft[],
  totalPaidCents: number
): BackfillPeriod[] {
  let pool = Math.max(0, totalPaidCents);
  return periods.map((p) => {
    if (p.amountDueCents === 0) {
      return { ...p, amountPaidCents: 0, status: "waived" as const };
    }
    const applied = Math.min(pool, p.amountDueCents);
    pool -= applied;
    let status: BackfillPeriod["status"] = "unpaid";
    if (applied >= p.amountDueCents) status = "paid";
    else if (applied > 0) status = "partial";
    return { ...p, amountPaidCents: applied, status };
  });
}

export function buildBillingPeriodBackfill(input: {
  checkInDate: string;
  checkOutDate: string;
  isMember: boolean;
  rates: SiteRates;
  totalPaidCents: number;
}): BackfillPeriod[] {
  const drafts = generateBillingPeriods({
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    isMember: input.isMember,
    rates: input.rates,
  });
  if (drafts.length === 0) return [];
  return allocatePaidWaterfall(drafts, input.totalPaidCents);
}
