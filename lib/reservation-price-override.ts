/**
 * Price override validation for caretaker reservations.
 */

import {
  BILLING_PERIOD_DAYS,
  CALENDAR_LATE_ARRIVAL_NIGHTS,
  type BillingMode,
  type BillingPeriodDraft,
} from "@/lib/reservation-pricing";

export type PriceOverrideInput = {
  calculatedTotalCents: number;
  amountOverrideCents?: number | null;
  overrideReason?: string | null;
  paymentAmountCents: number;
  /** Cash create can record nothing now (pay on arrival); card checkout cannot charge $0. */
  allowZeroPayment?: boolean;
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
  if (paymentAmountCents < 0) {
    return { ok: false, error: "Payment cannot be negative" };
  }
  const minPaymentCents = input.allowZeroPayment ? 0 : 1;

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
    if (rawOverride > 0 && paymentAmountCents < minPaymentCents) {
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
  if (paymentAmountCents < minPaymentCents && calculatedTotalCents > 0) {
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

/**
 * Fit standard billing period drafts to a special stay total without uneven cent amounts:
 * flat whole-dollar months when the total divides evenly, otherwise standard months with the
 * difference on the partial period, otherwise even whole-dollar months. Calendar-month stays
 * prefer the partial-period fit when an arrival/final month is longer than a short stub.
 */
export function fitPeriodDraftsToTotal(
  drafts: BillingPeriodDraft[],
  targetTotalCents: number,
  billingMode: BillingMode = "rolling_30"
): BillingPeriodDraft[] {
  if (drafts.length === 0) return drafts;
  const target = Math.max(0, Math.round(targetTotalCents));
  const sum = drafts.reduce((s, d) => s + d.amountDueCents, 0);
  if (sum === target) return drafts;

  const isFull = (d: BillingPeriodDraft) => d.fullMonth ?? d.nights >= BILLING_PERIOD_DAYS;
  const partials = drafts.filter((d) => !isFull(d));
  const fullCount = drafts.length - partials.length;
  const partialSum = partials.reduce((s, d) => s + d.amountDueCents, 0);

  const flatEven = fullCount > 0 && target % (fullCount * 100) === 0;
  const canAbsorb = partials.length > 0 && partialSum + (target - sum) >= 0;
  // Calendar stays only give partial months away for a flat deal (at or below the standard
  // monthly amount) when they are short stubs, not partial months of a week or more.
  const standardMonthCents = Math.max(0, ...drafts.filter(isFull).map((d) => d.amountDueCents));
  const freeStubsFit =
    billingMode !== "calendar_month" ||
    (partials.every((d) => d.nights <= CALENDAR_LATE_ARRIVAL_NIGHTS) &&
      target / Math.max(1, fullCount) <= standardMonthCents);

  let fitted: BillingPeriodDraft[];
  if (flatEven && (freeStubsFit || !canAbsorb)) {
    // Flat whole-dollar months (e.g. "$540 × 8 months"); leftover nights are free.
    const each = target / fullCount;
    fitted = drafts.map((d) => ({ ...d, amountDueCents: isFull(d) ? each : 0 }));
  } else if (canAbsorb) {
    // Months keep their standard amount; the difference lands on the partial period(s).
    fitted = drafts.map((d) => ({ ...d }));
    let delta = target - sum;
    for (let i = fitted.length - 1; i >= 0 && delta !== 0; i--) {
      if (isFull(fitted[i])) continue;
      const next = Math.max(0, fitted[i].amountDueCents + delta);
      delta -= next - fitted[i].amountDueCents;
      fitted[i].amountDueCents = next;
    }
  } else {
    // Even whole-dollar months; leftover cents on the last month, partial nights free.
    const months = fullCount > 0 ? fullCount : drafts.length;
    const each = Math.floor(target / months / 100) * 100;
    const lastMonthIdx = drafts.reduce((last, d, i) => (fullCount === 0 || isFull(d) ? i : last), 0);
    fitted = drafts.map((d, i) => {
      if (fullCount > 0 && !isFull(d)) return { ...d, amountDueCents: 0 };
      return { ...d, amountDueCents: i === lastMonthIdx ? target - each * (months - 1) : each };
    });
  }

  return foldFreePartialPeriods(fitted, isFull);
}

/**
 * Merge $0 partial periods into the period before them (or, for a free arrival-month stub, the
 * period after) so schedules don't show free stub periods.
 */
function foldFreePartialPeriods(
  drafts: BillingPeriodDraft[],
  isFull: (d: BillingPeriodDraft) => boolean
): BillingPeriodDraft[] {
  const out: BillingPeriodDraft[] = [];
  let leadingFree: BillingPeriodDraft | null = null;
  for (const d of drafts) {
    const free = !isFull(d) && d.amountDueCents === 0;
    const prev = out[out.length - 1];
    if (free && prev) {
      out[out.length - 1] = { ...prev, periodEnd: d.periodEnd, nights: prev.nights + d.nights };
    } else if (free && drafts.length > 1 && !leadingFree) {
      leadingFree = d;
    } else if (leadingFree) {
      out.push({
        ...d,
        periodStart: leadingFree.periodStart,
        nights: leadingFree.nights + d.nights,
        dueDate: leadingFree.dueDate,
      });
      leadingFree = null;
    } else {
      out.push({ ...d });
    }
  }
  if (leadingFree) out.push(leadingFree);
  return out.map((d, i) => ({ ...d, periodIndex: i }));
}
