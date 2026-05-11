/**
 * LDMA vs non-LDMA from variant metafield (when present) or variant title heuristics.
 * VIP-only products are excluded upstream by product handle / tags.
 */

import { PRICE_LEVEL_METAFIELD } from "@/lib/events-config";

export type RegistrationKind = "LDMA" | "NON_LDMA";

export type ClassifyInput = {
  variantTitle: string;
  /** Metafield value from Admin API e.g. custom.price_level */
  priceLevelMetafield?: string | null;
};

export function classifyEventRegistration(input: ClassifyInput): RegistrationKind | null {
  const level = input.priceLevelMetafield?.trim().toLowerCase();
  if (level) {
    if (level === "member") return "LDMA";
    if (level === "non member" || level === "non-member" || level === "nonmember") {
      return "NON_LDMA";
    }
  }

  const t = input.variantTitle.toLowerCase();

  const nonFirst =
    /\bnon[-\s]?ldma\b/.test(t) ||
    /\bnon[-\s]?member\b/.test(t) ||
    /\bgeneral\s+admission\b/.test(t) ||
    /\bgeneral\s+registration\b/.test(t);

  const memberFirst =
    /\bldma\s+member\b/.test(t) ||
    /\bmember\s+entrance\b/.test(t) ||
    /\bmember\s+registration\b/.test(t);

  if (nonFirst && !memberFirst) return "NON_LDMA";
  if (memberFirst && !nonFirst) return "LDMA";

  if (nonFirst) return "NON_LDMA";
  if (memberFirst) return "LDMA";

  return null;
}

/** Namespace.key for Admin GraphQL metafields on ProductVariant */
export function priceLevelMetafieldIdentifier(): {
  namespace: string;
  key: string;
} {
  return { namespace: PRICE_LEVEL_METAFIELD.namespace, key: PRICE_LEVEL_METAFIELD.key };
}
