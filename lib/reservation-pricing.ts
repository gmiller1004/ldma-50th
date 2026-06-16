/**
 * Reservation site fee pricing.
 *
 * Legacy: computeReservationTotalCents (daily × nights + 10% at 30+ nights) — still used by
 * live Burnt River / Vein Mountain portal until Phase 4 cutover.
 *
 * v2 (roadmap): member ≤29 nights daily; member ≥30 monthly prorated; guest always daily.
 */

import { addDays, countNights } from "@/lib/reservation-dates";

/** Member stays of this many nights or fewer use daily member rate. */
export const MEMBER_DAILY_MAX_NIGHTS = 29;

/** Rolling billing period length in days. */
export const BILLING_PERIOD_DAYS = 30;

const LONG_STAY_NIGHTS = 30;
const LONG_STAY_DISCOUNT_RATE = 0.1;

export type PricingBasis = "member_monthly_prorated" | "member_daily" | "guest_daily";

export type SiteRates = {
  memberRateDaily: number | null;
  memberRateMonthly: number | null;
  nonMemberRateDaily: number | null;
};

export type StayPricingInput = {
  checkInDate: string;
  checkOutDate: string;
  isMember: boolean;
  rates: SiteRates;
};

export type StayPricingResult = {
  totalNights: number;
  totalCents: number;
  pricingBasis: PricingBasis;
  usesMonthlyMemberRate: boolean;
};

function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** v2 stay total per CAMP_RESERVATIONS_ROADMAP.md */
export function computeStayPricing(input: StayPricingInput): StayPricingResult {
  const { checkInDate, checkOutDate, isMember, rates } = input;
  const totalNights = countNights(checkInDate, checkOutDate);
  if (totalNights < 1) {
    return { totalNights: 0, totalCents: 0, pricingBasis: "guest_daily", usesMonthlyMemberRate: false };
  }

  if (!isMember) {
    const daily = rates.nonMemberRateDaily ?? 0;
    return {
      totalNights,
      totalCents: toCents(totalNights * daily),
      pricingBasis: "guest_daily",
      usesMonthlyMemberRate: false,
    };
  }

  const memberDaily = rates.memberRateDaily ?? 0;
  const memberMonthly = rates.memberRateMonthly ?? 0;

  if (totalNights <= MEMBER_DAILY_MAX_NIGHTS) {
    return {
      totalNights,
      totalCents: toCents(totalNights * memberDaily),
      pricingBasis: "member_daily",
      usesMonthlyMemberRate: false,
    };
  }

  return {
    totalNights,
    totalCents: toCents(memberMonthly * (totalNights / BILLING_PERIOD_DAYS)),
    pricingBasis: "member_monthly_prorated",
    usesMonthlyMemberRate: true,
  };
}

export type BillingPeriodDraft = {
  periodIndex: number;
  periodStart: string;
  periodEnd: string;
  nights: number;
  amountDueCents: number;
  dueDate: string;
  pricingBasis: PricingBasis;
};

/**
 * Rolling 30-day billing periods from check-in. Period amounts sum to stay total.
 */
export function generateBillingPeriods(input: StayPricingInput): BillingPeriodDraft[] {
  const pricing = computeStayPricing(input);
  const { checkInDate, checkOutDate, isMember, rates } = input;
  if (pricing.totalNights < 1) return [];

  const periods: BillingPeriodDraft[] = [];
  let periodStart = checkInDate;
  let periodIndex = 0;

  while (periodStart < checkOutDate) {
    const periodEnd = (() => {
      const candidate = addDays(periodStart, BILLING_PERIOD_DAYS);
      return candidate < checkOutDate ? candidate : checkOutDate;
    })();
    const nights = countNights(periodStart, periodEnd);
    if (nights < 1) break;

    let amountDueCents: number;
    let periodBasis: PricingBasis;

    if (!isMember) {
      const daily = rates.nonMemberRateDaily ?? 0;
      amountDueCents = toCents(nights * daily);
      periodBasis = "guest_daily";
    } else if (!pricing.usesMonthlyMemberRate) {
      const daily = rates.memberRateDaily ?? 0;
      amountDueCents = toCents(nights * daily);
      periodBasis = "member_daily";
    } else {
      const monthly = rates.memberRateMonthly ?? 0;
      amountDueCents =
        nights >= BILLING_PERIOD_DAYS
          ? toCents(monthly)
          : toCents(monthly * (nights / BILLING_PERIOD_DAYS));
      periodBasis = "member_monthly_prorated";
    }

    periods.push({
      periodIndex,
      periodStart,
      periodEnd,
      nights,
      amountDueCents,
      dueDate: periodStart,
      pricingBasis: periodBasis,
    });

    periodIndex += 1;
    periodStart = periodEnd;
  }

  // Rounding: align last period so sum matches stay total.
  if (periods.length > 0) {
    const sum = periods.reduce((s, p) => s + p.amountDueCents, 0);
    const delta = pricing.totalCents - sum;
    if (delta !== 0) {
      periods[periods.length - 1].amountDueCents = Math.max(
        0,
        periods[periods.length - 1].amountDueCents + delta
      );
    }
  }

  return periods;
}

/**
 * @deprecated Legacy pilot pricing (daily + 10% discount at 30+ nights). Use computeStayPricing after cutover.
 */
export function computeReservationTotalCents(
  nights: number,
  rateDaily: number | null,
  isMember: boolean,
  memberRateDaily: number | null,
  nonMemberRateDaily: number | null
): number {
  const rate =
    rateDaily ??
    (isMember ? memberRateDaily : nonMemberRateDaily) ??
    0;
  if (rate <= 0 || nights < 1) return 0;
  let total = nights * rate;
  if (nights >= LONG_STAY_NIGHTS) {
    total *= 1 - LONG_STAY_DISCOUNT_RATE;
  }
  return Math.round(total * 100);
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}

export function formatCentsAsCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
