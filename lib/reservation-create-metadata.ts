/**
 * Shared reservation pricing + invoice fields for create flows.
 */

import { validatePriceOverride } from "@/lib/reservation-price-override";
import { allocateReservationInvoiceNumber } from "@/lib/reservation-invoice";

export type ReservationPricingFields = {
  calculatedTotalCents: number;
  amountOverrideCents: number | null;
  overrideReason: string | null;
  priceOverrideFlag: boolean;
  effectiveTotalCents: number;
  invoiceNumber: string | null;
};

export function parseReservationPricingBody(
  body: {
    amountCents?: number;
    amountOverrideCents?: number;
    overrideReason?: string;
  },
  calculatedTotalCents: number
): { ok: true; pricing: ReservationPricingFields; paymentAmountCents: number } | { ok: false; error: string } {
  const paymentAmountCents =
    typeof body.amountCents === "number" && !Number.isNaN(body.amountCents)
      ? Math.round(body.amountCents)
      : calculatedTotalCents;
  const amountOverrideCents =
    typeof body.amountOverrideCents === "number" && !Number.isNaN(body.amountOverrideCents)
      ? Math.round(body.amountOverrideCents)
      : undefined;

  const validated = validatePriceOverride({
    calculatedTotalCents,
    amountOverrideCents,
    overrideReason: body.overrideReason,
    paymentAmountCents,
  });
  if (!validated.ok) return validated;

  return {
    ok: true,
    paymentAmountCents,
    pricing: {
      calculatedTotalCents: validated.result.calculatedTotalCents,
      amountOverrideCents: validated.result.amountOverrideCents,
      overrideReason: validated.result.overrideReason,
      priceOverrideFlag: validated.result.priceOverrideFlag,
      effectiveTotalCents: validated.result.effectiveTotalCents,
      invoiceNumber: null,
    },
  };
}

export async function withReservationInvoice(
  campSlug: string,
  pricing: ReservationPricingFields
): Promise<ReservationPricingFields> {
  const invoiceNumber = await allocateReservationInvoiceNumber(campSlug);
  return { ...pricing, invoiceNumber };
}

function parseOptionalDollarsToCents(raw: string | undefined, fallback: number): number {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return fallback;
  const n = Math.round(parseFloat(s) * 100);
  return Number.isNaN(n) ? fallback : n;
}

/**
 * Build API body fields for create: payment amount vs optional stay-total override are separate.
 * Partial payment at create leaves a balance on the full stay total.
 */
export function resolveCreateReservationPricing(
  calculatedTotalCents: number,
  opts: {
    stayTotalOverrideDollars?: string;
    overrideReason?: string;
    paymentAmountDollars?: string;
  }
):
  | { ok: false; error: string }
  | {
      ok: true;
      stayTotalCents: number;
      collectCents: number;
      balanceAfterCents: number;
      fields: { amountCents: number; amountOverrideCents?: number; overrideReason?: string };
    } {
  let stayTotalOverrideCents: number | undefined;
  if (opts.stayTotalOverrideDollars?.trim()) {
    const parsed = Math.round(parseFloat(opts.stayTotalOverrideDollars) * 100);
    if (!Number.isNaN(parsed) && parsed !== calculatedTotalCents) {
      stayTotalOverrideCents = parsed;
    }
  }

  const parsedPricing = parseReservationPricingBody(
    {
      amountCents: parseOptionalDollarsToCents(
        opts.paymentAmountDollars,
        stayTotalOverrideCents ?? calculatedTotalCents
      ),
      amountOverrideCents: stayTotalOverrideCents,
      overrideReason: opts.overrideReason,
    },
    calculatedTotalCents
  );
  if (!parsedPricing.ok) return parsedPricing;

  const stayTotalCents = parsedPricing.pricing.effectiveTotalCents;
  const collectCents = parsedPricing.paymentAmountCents;

  const fields: { amountCents: number; amountOverrideCents?: number; overrideReason?: string } = {
    amountCents: collectCents,
  };
  if (parsedPricing.pricing.priceOverrideFlag) {
    fields.amountOverrideCents = parsedPricing.pricing.amountOverrideCents ?? undefined;
    fields.overrideReason = parsedPricing.pricing.overrideReason ?? undefined;
  }

  return {
    ok: true,
    stayTotalCents,
    collectCents,
    balanceAfterCents: Math.max(0, stayTotalCents - collectCents),
    fields,
  };
}
