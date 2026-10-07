/**
 * Reservation site fee pricing.
 *
 * Legacy: computeReservationTotalCents (daily × nights + 10% at 30+ nights) — still used by
 * live Burnt River / Vein Mountain portal until Phase 4 cutover.
 *
 * v2 (roadmap): member ≤29 nights daily; member ≥30 monthly prorated; guest always daily.
 */

import { addDays, countNights, firstOfNextMonth, isFirstOfMonth } from "@/lib/reservation-dates";

/** Member stays of this many nights or fewer use daily member rate. */
export const MEMBER_DAILY_MAX_NIGHTS = 29;

/** Rolling billing period length in days. */
export const BILLING_PERIOD_DAYS = 30;

/**
 * Calendar-month billing: when the arrival month has this many nights or fewer, the first full
 * month is also due at arrival instead of a few days later on the 1st.
 */
export const CALENDAR_LATE_ARRIVAL_NIGHTS = 7;

/**
 * rolling_30: 30-day periods from check-in at the monthly rate, tail prorated.
 * calendar_month: arrival month and final month at nights × daily (capped at monthly), whole
 * calendar months at the monthly rate, due on the 1st. Only used for member stays that cover at
 * least one whole calendar month; other stays fall back to rolling_30.
 */
export type BillingMode = "rolling_30" | "calendar_month";

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
  /** Defaults to rolling_30. */
  billingMode?: BillingMode;
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

  if (usesCalendarMonthBilling(input)) {
    return {
      totalNights,
      totalCents: calendarMonthPeriods(input).reduce((s, p) => s + p.amountDueCents, 0),
      pricingBasis: "member_monthly_prorated",
      usesMonthlyMemberRate: true,
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
  /** Billed as a whole month (special-rate fitting treats every other period as partial). */
  fullMonth?: boolean;
};

/** Whole calendar month inside the stay (check-out exclusive)? */
export function coversWholeCalendarMonth(checkInDate: string, checkOutDate: string): boolean {
  const firstMonthStart = isFirstOfMonth(checkInDate) ? checkInDate : firstOfNextMonth(checkInDate);
  return firstOfNextMonth(firstMonthStart) <= checkOutDate;
}

export function usesCalendarMonthBilling(input: StayPricingInput): boolean {
  return (
    input.billingMode === "calendar_month" &&
    input.isMember &&
    countNights(input.checkInDate, input.checkOutDate) > MEMBER_DAILY_MAX_NIGHTS &&
    coversWholeCalendarMonth(input.checkInDate, input.checkOutDate)
  );
}

function calendarMonthPeriods(input: StayPricingInput): BillingPeriodDraft[] {
  const { checkInDate, checkOutDate, rates } = input;
  const monthlyCents = toCents(rates.memberRateMonthly ?? 0);
  const dailyCents = toCents(rates.memberRateDaily ?? 0);

  const periods: BillingPeriodDraft[] = [];
  let periodStart = checkInDate;
  while (periodStart < checkOutDate) {
    const monthEnd = firstOfNextMonth(periodStart);
    const periodEnd = monthEnd < checkOutDate ? monthEnd : checkOutDate;
    const nights = countNights(periodStart, periodEnd);
    if (nights < 1) break;
    // Checking out on the last day of the month still counts as that month for special-rate fits.
    const fullMonth =
      isFirstOfMonth(periodStart) && nights >= countNights(periodStart, monthEnd) - 1;
    const partialCents =
      dailyCents > 0
        ? Math.min(nights * dailyCents, monthlyCents)
        : Math.round((monthlyCents * nights) / BILLING_PERIOD_DAYS);
    periods.push({
      periodIndex: periods.length,
      periodStart,
      periodEnd,
      nights,
      amountDueCents: fullMonth && periodEnd === monthEnd ? monthlyCents : partialCents,
      dueDate: periodStart,
      pricingBasis: "member_monthly_prorated",
      fullMonth,
    });
    periodStart = periodEnd;
  }

  if (
    periods.length > 1 &&
    !periods[0].fullMonth &&
    periods[0].nights <= CALENDAR_LATE_ARRIVAL_NIGHTS
  ) {
    periods[1] = { ...periods[1], dueDate: checkInDate };
  }
  return periods;
}

/** Amount due on arrival: the first period plus any period whose due date is the same day. */
export function amountDueAtArrivalCents(periods: Pick<BillingPeriodDraft, "dueDate" | "amountDueCents">[]): number {
  const first = periods[0];
  if (!first) return 0;
  return periods
    .filter((p) => p.dueDate.slice(0, 10) <= first.dueDate.slice(0, 10))
    .reduce((s, p) => s + p.amountDueCents, 0);
}

/**
 * Billing periods for the stay. Period amounts sum to stay total.
 * rolling_30: 30-day periods from check-in. calendar_month: see BillingMode.
 */
export function generateBillingPeriods(input: StayPricingInput): BillingPeriodDraft[] {
  if (usesCalendarMonthBilling(input)) return calendarMonthPeriods(input);

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
      fullMonth: nights >= BILLING_PERIOD_DAYS,
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
