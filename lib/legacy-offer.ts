/** Offer types for legacy offer emails and profile display. */
export type LegacyOfferType =
  | "all-three"
  | "transferability-prepay"
  | "companion-prepay"
  | "companion-only"
  | "prepay-only";

/**
 * Derive offer type from Salesforce checkboxes (what the member HAS already purchased).
 * PrePay cannot be true without Transferable.
 */
export function deriveLegacyOfferType(
  isTransferable: boolean,
  isCompanion: boolean,
  isPrePay: boolean
): LegacyOfferType | null {
  if (isTransferable && isCompanion && isPrePay) return null; // Has everything, no offer
  if (!isTransferable && isCompanion && isPrePay) return null; // Invalid: PrePay requires Transferable
  if (!isTransferable && !isCompanion && !isPrePay) return "all-three";
  if (isTransferable && !isCompanion && !isPrePay) return "companion-prepay";
  if (!isTransferable && isCompanion && !isPrePay) return "transferability-prepay";
  if (isTransferable && !isCompanion && isPrePay) return "companion-only";
  if (isTransferable && isCompanion && !isPrePay) return "prepay-only";
  return null;
}

/** Config for display/email (safe for client - no SendGrid import). */
export function getLegacyOfferConfig(type: LegacyOfferType): {
  price: string;
  regularPrice: string;
  headline: string;
  body: string;
} {
  switch (type) {
    case "all-three":
      return {
        price: "$1,000",
        regularPrice: "$3,250",
        headline: "Complete Family Legacy Package",
        body: "We're offering you Transferability + Companion + Pre-Paid Transfer Fee — everything you need to pass your LDMA membership on to your family. Your heir receives full membership with no transfer fee.",
      };
    case "transferability-prepay":
      return {
        price: "$750",
        regularPrice: "$2,000",
        headline: "Add Transferability + Pre-Pay the Transfer Fee",
        body: "We're offering Transferability plus a pre-paid transfer fee. Designate who receives your membership when the time comes — and your heir gets it with no fee.",
      };
    case "companion-prepay":
      return {
        price: "$750",
        regularPrice: "$2,000",
        headline: "Add Companion + Pre-Pay the Transfer Fee",
        body: "We're offering the Companion add-on plus a pre-paid transfer fee. A spouse, child, parent, or grandparent can prospect and camp on their own — and when you transfer, your heir receives it with no fee.",
      };
    case "companion-only":
      return {
        price: "$500",
        regularPrice: "$1,250",
        headline: "Add the Companion Add-On",
        body: "You already have Transferability and the pre-paid transfer fee. We're offering the Companion add-on — so a spouse, child, parent, or grandparent can prospect and visit camps on their own.",
      };
    case "prepay-only":
      return {
        price: "$500",
        regularPrice: "$750",
        headline: "Pre-Pay the Transfer Fee",
        body: "You already have Transferability and Companion. We're offering to pre-pay the transfer fee so your heir receives your membership with no fee. One less burden for the next generation.",
      };
  }
}

/** Shopify product handle for each legacy offer type (matches legacy-offer-products-shopify.csv). */
export function getLegacyOfferProductHandle(type: LegacyOfferType): string {
  const handles: Record<LegacyOfferType, string> = {
    "all-three": "legacy-complete-package",
    "transferability-prepay": "legacy-transferability-prepay",
    "companion-prepay": "legacy-companion-prepay",
    "companion-only": "legacy-companion-only",
    "prepay-only": "legacy-prepay-only",
  };
  return handles[type];
}
