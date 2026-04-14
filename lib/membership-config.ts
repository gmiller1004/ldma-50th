/**
 * Membership customization flow config.
 * Products are matched from the "membership" collection by title substrings.
 * Order matches the LDMA funnel: Lifetime → Companion → Paydirt → Minelab → GPAA
 */

export const MEMBERSHIP_COLLECTION_HANDLE = "membership";

/** Substrings to match products in the membership collection (case-insensitive). Order = funnel flow. */
export const MEMBERSHIP_PRODUCT_KEYS = [
  "lifetime", // LDMA Lifetime - base, required (match "ldma" + "lifetime")
  "companion", // Companion and Transferability Add On Bundle
  "paydirt", // Paydirt Can Add On
  "minelab", // Minelab Gold Monster 1000 Add On
  "gpaa", // GPAA Benefits
] as const;

export type MembershipProductKey = (typeof MEMBERSHIP_PRODUCT_KEYS)[number];

export function isMembershipProductKey(s: string): s is MembershipProductKey {
  return (MEMBERSHIP_PRODUCT_KEYS as readonly string[]).includes(s);
}

/** Map product title to our key (for matching Shopify products) */
export function getMembershipKeyFromTitle(title: string): MembershipProductKey | null {
  const lower = title.toLowerCase();
  if (lower.includes("ldma") && lower.includes("lifetime")) return "lifetime";
  if (lower.includes("companion")) return "companion";
  if (lower.includes("paydirt")) return "paydirt";
  if (lower.includes("minelab")) return "minelab";
  if (lower.includes("gpaa")) return "gpaa";
  return null;
}

/** Titles to match cart lines as membership products (for cascade remove) */
export function isMembershipProduct(title: string): boolean {
  return getMembershipKeyFromTitle(title) !== null;
}

export function isLdmaLifetimeProduct(title: string): boolean {
  const lower = title.toLowerCase();
  return lower.includes("ldma") && lower.includes("lifetime");
}
