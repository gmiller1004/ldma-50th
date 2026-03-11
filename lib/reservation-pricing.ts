/**
 * Reservation site fee pricing.
 * 10% discount for stays of 30+ nights (per data/camp-sites/README.md).
 */

const LONG_STAY_NIGHTS = 30;
const LONG_STAY_DISCOUNT_RATE = 0.1;

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
