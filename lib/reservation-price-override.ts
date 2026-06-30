/**
 * Price override validation for caretaker reservations.
 */

import type { BillingPeriodDraft } from "@/lib/reservation-pricing";

export type PriceOverrideInput = {
  calculatedTotalCents: number;
  amountOverrideCents?: number | null;
  overrideReason?: string | null;
  paymentAmountCents: number;
};

export type PriceOverrideResult = {
  calculatedTotalCents: number;
  amountOverrideCents: number | null;
  overrideReason: string | null;
  priceOverrideFlag: boolean;
  effectiveTotalCents: number;
};

export function validatePriceOverride(input: PriceOverrideInput):
  | { ok: true; result: PriceOverrideResult }
  | { ok: false; error: string } {
  const { calculatedTotalCents, paymentAmountCents } = input;
  if (calculatedTotalCents < 0) {
    return { ok: false, error: "Invalid calculated total" };
  }

  const rawOverride =
    typeof input.amountOverrideCents === "number" && !Number.isNaN(input.amountOverrideCents)
      ? Math.round(input.amountOverrideCents)
      : null;
  const reason = typeof input.overrideReason === "string" ? input.overrideReason.trim() : "";

  if (rawOverride != null && rawOverride !== calculatedTotalCents) {
    if (rawOverride < 0) {
      return { ok: false, error: "Override total cannot be negative" };
    }
    if (reason.length < 3) {
      return { ok: false, error: "Override reason required (min 3 characters) when total differs from calculated" };
    }
    if (paymentAmountCents > rawOverride) {
      return {
        ok: false,
        error: `Payment cannot exceed override total ($${(rawOverride / 100).toFixed(2)})`,
      };
    }
    if (rawOverride > 0 && paymentAmountCents < 1) {
      return { ok: false, error: "Payment must be at least $0.01 unless override total is $0" };
    }
    return {
      ok: true,
      result: {
        calculatedTotalCents,
        amountOverrideCents: rawOverride,
        overrideReason: reason,
        priceOverrideFlag: true,
        effectiveTotalCents: rawOverride,
      },
    };
  }

  if (paymentAmountCents > calculatedTotalCents) {
    return {
      ok: false,
      error: `Collect amount ($${(paymentAmountCents / 100).toFixed(2)}) cannot exceed calculated stay total ($${(calculatedTotalCents / 100).toFixed(2)})`,
    };
  }
  if (paymentAmountCents < 1 && calculatedTotalCents > 0) {
    return { ok: false, error: "Payment must be at least $0.01" };
  }

  return {
    ok: true,
    result: {
      calculatedTotalCents,
      amountOverrideCents: null,
      overrideReason: null,
      priceOverrideFlag: false,
      effectiveTotalCents: calculatedTotalCents,
    },
  };
}

/** Scale billing period drafts so sum(amountDueCents) equals targetTotalCents. */
export function scalePeriodDraftsToTotal(
  drafts: BillingPeriodDraft[],
  targetTotalCents: number
): BillingPeriodDraft[] {
  if (drafts.length === 0) return drafts;
  const sum = drafts.reduce((s, d) => s + d.amountDueCents, 0);
  if (sum <= 0 || sum === targetTotalCents) return drafts;

  const scaled = drafts.map((d) => ({
    ...d,
    amountDueCents: Math.max(0, Math.round((d.amountDueCents * targetTotalCents) / sum)),
  }));
  const scaledSum = scaled.reduce((s, d) => s + d.amountDueCents, 0);
  const delta = targetTotalCents - scaledSum;
  if (delta !== 0) {
    const last = scaled[scaled.length - 1];
    scaled[scaled.length - 1] = {
      ...last,
      amountDueCents: Math.max(0, last.amountDueCents + delta),
    };
  }
  return scaled;
}
