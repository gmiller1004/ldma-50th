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
