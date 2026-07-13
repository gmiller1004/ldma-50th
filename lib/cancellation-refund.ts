/**
 * Site-fee cancellation refund calculator (CAMP_RESERVATIONS_ROADMAP.md).
 */

import { countNights, parseDateOnly } from "@/lib/reservation-dates";
import { MEMBER_DAILY_MAX_NIGHTS } from "@/lib/reservation-pricing";

const DAY_MS = 24 * 60 * 60 * 1000;

export const CANCELLATION_FEE_DAILY_CENTS = 2500;
export const CANCELLATION_FEE_DRY_CENTS = 2500;
export const CANCELLATION_FEE_HOOKUP_CENTS = 10000;
export const FULL_REFUND_DAYS_BEFORE_CHECKIN = 7;

export type CancellationRefundInput = {
  cancelDate: string;
  checkInDate: string;
  checkOutDate: string;
  totalNights: number;
  isMember: boolean;
  isHookupSite: boolean;
  memberRateDaily: number | null;
  totalPaidCents: number;
  totalRefundedCents: number;
  /** When true, policy fee is not deducted from the refund. */
  waiveCancellationFee?: boolean;
};

export type CancellationRefundResult = {
  refundCents: number;
  totalPaidCents: number;
  totalRefundedCents: number;
  earnedCents: number;
  /** Fee actually applied (0 when waived or full-refund window). */
  cancellationFeeCents: number;
  /** Policy fee before caretaker waiver (0 in full-refund window). */
  policyCancellationFeeCents: number;
  cancellationFeeWaived: boolean;
  nightsStayed: number;
  pricingMode: "full_refund" | "daily" | "monthly_member";
  daysUntilCheckIn: number;
};

export function daysUntilCheckIn(cancelDate: string, checkInDate: string): number {
  const cancel = parseDateOnly(cancelDate);
  const checkIn = parseDateOnly(checkInDate);
  if (cancel >= checkIn) return 0;
  return Math.max(0, Math.round((checkIn.getTime() - cancel.getTime()) / DAY_MS));
}

/** Nights charged when cancelling mid-stay (check-in day counts). */
export function nightsStayedForCancel(
  checkInDate: string,
  checkOutDate: string,
  cancelDate: string
): number {
  if (cancelDate <= checkInDate) return 0;
  const stayEnd = cancelDate < checkOutDate ? cancelDate : checkOutDate;
  if (stayEnd <= checkInDate) return 0;
  return countNights(checkInDate, stayEnd);
}

function isMonthlyMemberStay(totalNights: number, isMember: boolean): boolean {
  return isMember && totalNights > MEMBER_DAILY_MAX_NIGHTS;
}

function isDailyPricedStay(totalNights: number, isMember: boolean): boolean {
  return !isMember || totalNights <= MEMBER_DAILY_MAX_NIGHTS;
}

function cancellationFeeCents(isHookupSite: boolean, monthlyMember: boolean): number {
  if (monthlyMember) {
    return isHookupSite ? CANCELLATION_FEE_HOOKUP_CENTS : CANCELLATION_FEE_DRY_CENTS;
  }
  return CANCELLATION_FEE_DAILY_CENTS;
}

export function computeCancellationRefund(input: CancellationRefundInput): CancellationRefundResult {
  const {
    cancelDate,
    checkInDate,
    checkOutDate,
    totalNights,
    isMember,
    isHookupSite,
    memberRateDaily,
    totalPaidCents,
    totalRefundedCents,
    waiveCancellationFee = false,
  } = input;

  const daysBefore = daysUntilCheckIn(cancelDate, checkInDate);
  const nightsStayed = nightsStayedForCancel(checkInDate, checkOutDate, cancelDate);
  const monthlyMember = isMonthlyMemberStay(totalNights, isMember);
  const dailyPriced = isDailyPricedStay(totalNights, isMember);

  const maxRefundable = Math.max(0, totalPaidCents - totalRefundedCents);

  if (cancelDate < checkInDate && daysBefore >= FULL_REFUND_DAYS_BEFORE_CHECKIN) {
    return {
      refundCents: maxRefundable,
      totalPaidCents,
      totalRefundedCents,
      earnedCents: 0,
      cancellationFeeCents: 0,
      policyCancellationFeeCents: 0,
      cancellationFeeWaived: false,
      nightsStayed: 0,
      pricingMode: "full_refund",
      daysUntilCheckIn: daysBefore,
    };
  }

  const dailyRate = memberRateDaily ?? 0;
  const earnedCents = Math.round(nightsStayed * dailyRate * 100);
  const policyFeeCents = cancellationFeeCents(isHookupSite, monthlyMember);
  const feeWaived = Boolean(waiveCancellationFee) && policyFeeCents > 0;
  const appliedFeeCents = feeWaived ? 0 : policyFeeCents;

  let rawRefund = 0;
  let pricingMode: CancellationRefundResult["pricingMode"] = "daily";

  if (monthlyMember) {
    pricingMode = "monthly_member";
    rawRefund = Math.max(0, totalPaidCents - earnedCents - appliedFeeCents);
  } else if (dailyPriced) {
    pricingMode = "daily";
    rawRefund = Math.max(0, totalPaidCents - earnedCents - appliedFeeCents);
  }

  const refundCents = Math.min(Math.max(0, rawRefund), maxRefundable);

  return {
    refundCents,
    totalPaidCents,
    totalRefundedCents,
    earnedCents,
    cancellationFeeCents: appliedFeeCents,
    policyCancellationFeeCents: policyFeeCents,
    cancellationFeeWaived: feeWaived,
    nightsStayed,
    pricingMode,
    daysUntilCheckIn: daysBefore,
  };
}
