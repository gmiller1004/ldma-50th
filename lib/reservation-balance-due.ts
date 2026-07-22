/**
 * Public-facing balance due rules: arrival-month vs full stay, payable now vs scheduled.
 */

import { countNights } from "@/lib/reservation-dates";
import {
  MEMBER_DAILY_MAX_NIGHTS,
  generateBillingPeriods,
  type SiteRates,
} from "@/lib/reservation-pricing";
import { allocatePaidWaterfall } from "@/lib/backfill-billing-periods";
import {
  type BillingPeriodSummary,
  suggestedReservationPaymentCents,
} from "@/lib/reservation-billing";

export const PAYMENT_REMINDER_LOOKAHEAD_DAYS = 14;

export type ReservationPaymentObligations = {
  isLongTermMember: boolean;
  totalUnpaidCents: number;
  balanceDueBeforeArrivalCents: number;
  payableNowCents: number;
  nextScheduledPayment: { dueDate: string; amountCents: number } | null;
  paidInFull: boolean;
};

export function isLongTermMemberStay(input: {
  checkInDate: string;
  checkOutDate: string;
  reservationType: string;
}): boolean {
  if (input.reservationType !== "member") return false;
  return countNights(input.checkInDate, input.checkOutDate) > MEMBER_DAILY_MAX_NIGHTS;
}

export function activeBillingPeriods(
  periods: Pick<BillingPeriodSummary, "status">[]
): BillingPeriodSummary[] {
  return periods.filter((p) => p.status !== "cancelled") as BillingPeriodSummary[];
}

export function totalUnpaidBalanceCents(
  periods: Pick<BillingPeriodSummary, "status" | "amountDueCents" | "amountPaidCents">[]
): number {
  return periods
    .filter((p) => p.status !== "cancelled")
    .reduce((sum, p) => sum + Math.max(0, p.amountDueCents - p.amountPaidCents), 0);
}

/** Long-term member: first billing period only. Short stay / guest: entire unpaid balance. */
export function balanceDueBeforeArrivalCents(
  periods: Pick<
    BillingPeriodSummary,
    "periodIndex" | "status" | "amountDueCents" | "amountPaidCents"
  >[],
  isLongTermMember: boolean
): number {
  const active = periods.filter((p) => p.status !== "cancelled");
  if (active.length === 0) return 0;

  if (!isLongTermMember) {
    return totalUnpaidBalanceCents(active);
  }

  const first = active.find((p) => p.periodIndex === 0) ?? active[0];
  return Math.max(0, first.amountDueCents - first.amountPaidCents);
}

export function daysBetweenIso(from: string, to: string): number {
  const a = new Date(`${from.slice(0, 10)}T12:00:00`).getTime();
  const b = new Date(`${to.slice(0, 10)}T12:00:00`).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

export function nextScheduledPayment(
  periods: BillingPeriodSummary[],
  today?: string
): { dueDate: string; amountCents: number } | null {
  const todayStr = (today ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const upcoming = periods
    .filter((p) => {
      const dueDate = p.dueDate.slice(0, 10);
      return (
        p.status !== "cancelled" &&
        (p.status === "unpaid" || p.status === "partial") &&
        dueDate > todayStr
      );
    })
    .sort(
      (a, b) =>
        a.dueDate.slice(0, 10).localeCompare(b.dueDate.slice(0, 10)) ||
        a.periodIndex - b.periodIndex
    );

  const next = upcoming[0];
  if (!next) return null;
  const amountCents = Math.max(0, next.amountDueCents - next.amountPaidCents);
  if (amountCents < 1) return null;
  return { dueDate: next.dueDate.slice(0, 10), amountCents };
}

/**
 * Amount the customer can pay right now (Stripe / pay-balance page).
 * - Due or overdue billing periods: earliest open period
 * - Before check-in: balance due before arrival (arrival month or full short stay)
 * - After check-in: next period when within reminder lookahead of its due date
 */
export function payableBalanceCents(input: {
  periods: BillingPeriodSummary[];
  checkInDate: string;
  checkOutDate: string;
  reservationType: string;
  today?: string;
}): number {
  const todayStr = input.today ?? new Date().toISOString().slice(0, 10);
  const checkIn = input.checkInDate.slice(0, 10);
  const periods = activeBillingPeriods(input.periods);
  const totalUnpaid = totalUnpaidBalanceCents(periods);
  if (totalUnpaid < 1) return 0;

  const isLongTerm = isLongTermMemberStay(input);

  const hasDueNow = periods.some(
    (p) =>
      (p.status === "unpaid" || p.status === "partial") && p.dueDate.slice(0, 10) <= todayStr
  );
  if (hasDueNow) {
    return suggestedReservationPaymentCents(periods, totalUnpaid);
  }

  if (todayStr < checkIn) {
    return balanceDueBeforeArrivalCents(periods, isLongTerm);
  }

  const upcoming = periods
    .filter(
      (p) =>
        (p.status === "unpaid" || p.status === "partial") && p.dueDate.slice(0, 10) > todayStr
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.periodIndex - b.periodIndex);

  const next = upcoming[0];
  if (
    next &&
    daysBetweenIso(todayStr, next.dueDate) <= PAYMENT_REMINDER_LOOKAHEAD_DAYS
  ) {
    return Math.max(0, next.amountDueCents - next.amountPaidCents);
  }

  return 0;
}

export function summarizeReservationPaymentObligations(input: {
  periods: BillingPeriodSummary[];
  checkInDate: string;
  checkOutDate: string;
  reservationType: string;
  today?: string;
}): ReservationPaymentObligations {
  const periods = activeBillingPeriods(input.periods);
  const isLongTermMember = isLongTermMemberStay(input);
  const totalUnpaidCents = totalUnpaidBalanceCents(periods);
  const beforeArrivalCents = balanceDueBeforeArrivalCents(periods, isLongTermMember);
  const payableNowCents = payableBalanceCents(input);
  const scheduled = nextScheduledPayment(periods, input.today);

  return {
    isLongTermMember,
    totalUnpaidCents,
    balanceDueBeforeArrivalCents: beforeArrivalCents,
    payableNowCents,
    nextScheduledPayment: scheduled,
    paidInFull: totalUnpaidCents < 1,
  };
}

/**
 * Preview payment obligations for proposed stay dates without writing billing periods.
 * Used by caretaker date-edit / site-move previews so long-term members are only asked
 * for what is payable now (first month / due periods), not the full remaining stay.
 */
export function previewStayPaymentObligations(input: {
  checkInDate: string;
  checkOutDate: string;
  reservationType: string;
  rates: SiteRates;
  netPaidCents: number;
  today?: string;
}): ReservationPaymentObligations & {
  proposedTotalCents: number;
  scheduledRemainingCents: number;
} {
  const isMember = input.reservationType === "member";
  const drafts = generateBillingPeriods({
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    isMember,
    rates: input.rates,
  });
  const allocated = allocatePaidWaterfall(drafts, Math.max(0, input.netPaidCents));
  const periods: BillingPeriodSummary[] = allocated.map((p) => ({
    id: `preview-${p.periodIndex}`,
    periodIndex: p.periodIndex,
    periodStart: p.periodStart,
    periodEnd: p.periodEnd,
    nights: p.nights,
    amountDueCents: p.amountDueCents,
    amountPaidCents: p.amountPaidCents,
    dueDate: p.dueDate,
    status: p.status,
    pricingBasis: p.pricingBasis,
  }));

  const summary = summarizeReservationPaymentObligations({
    periods,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    reservationType: input.reservationType,
    today: input.today,
  });
  const proposedTotalCents = allocated.reduce((sum, p) => sum + p.amountDueCents, 0);

  return {
    ...summary,
    proposedTotalCents,
    scheduledRemainingCents: Math.max(0, summary.totalUnpaidCents - summary.payableNowCents),
  };
}
