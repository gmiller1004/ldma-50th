/**
 * Public campsite reservation cancellation policy (matches lib/cancellation-refund.ts).
 */

import {
  CANCELLATION_FEE_DAILY_CENTS,
  CANCELLATION_FEE_DRY_CENTS,
  CANCELLATION_FEE_HOOKUP_CENTS,
  FULL_REFUND_DAYS_BEFORE_CHECKIN,
} from "@/lib/cancellation-refund";
import { MEMBER_DAILY_MAX_NIGHTS } from "@/lib/reservation-pricing";

export const CAMP_CANCELLATION_POLICY_PATH = "/reservations/cancellation-policy";

export function campCancellationPolicyUrl(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://myldma.com";
  return `${base}${CAMP_CANCELLATION_POLICY_PATH}`;
}

function formatUsdFromCents(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

export const CAMP_CANCELLATION_POLICY_LAST_UPDATED = "July 2026";

export type CampCancellationPolicyContent = {
  lastUpdated: string;
  fullRefundDaysBeforeCheckIn: number;
  dailyCancellationFee: string;
  dryMonthlyCancellationFee: string;
  hookupMonthlyCancellationFee: string;
  memberDailyMaxNights: number;
};

export function getCampCancellationPolicyContent(): CampCancellationPolicyContent {
  return {
    lastUpdated: CAMP_CANCELLATION_POLICY_LAST_UPDATED,
    fullRefundDaysBeforeCheckIn: FULL_REFUND_DAYS_BEFORE_CHECKIN,
    dailyCancellationFee: formatUsdFromCents(CANCELLATION_FEE_DAILY_CENTS),
    dryMonthlyCancellationFee: formatUsdFromCents(CANCELLATION_FEE_DRY_CENTS),
    hookupMonthlyCancellationFee: formatUsdFromCents(CANCELLATION_FEE_HOOKUP_CENTS),
    memberDailyMaxNights: MEMBER_DAILY_MAX_NIGHTS,
  };
}
