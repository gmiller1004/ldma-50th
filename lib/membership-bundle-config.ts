import { MEMBERSHIP_COLLECTION_HANDLE } from "@/lib/membership-config";

export const MEMBERSHIP_BUNDLE_COLLECTION_HANDLE = MEMBERSHIP_COLLECTION_HANDLE;

/** Shopify product: LDMA Lifetime Bundle — Garrett Axiom Lite */
export const LDMA_AXIOM_LITE_BUNDLE_PRODUCT_ID = "7636626899015";

/**
 * Detector bundle promo end — 11:59:59 PM Pacific on Aug 22, 2026.
 * Used by leftover countdown UI if the legacy three-bundle offer is re-enabled.
 */
export const BUNDLE_OFFER_EXPIRES_AT_MS = Date.parse("2026-08-22T23:59:59-07:00");

/** GPAA SeptMember (Founder Bag + daily mystery nugget) ends at midnight Pacific, start of Oct 1, 2026. */
export const SEPTMEMBER_ENDS_AT_MS = Date.parse("2026-10-01T00:00:00-07:00");

export function isSeptMemberActive(nowMs: number = Date.now()): boolean {
  return nowMs < SEPTMEMBER_ENDS_AT_MS;
}

export const MEMBERSHIP_BUNDLE_KEYS = ["axiom-lite", "gm1000", "gm24k", "gm2000"] as const;

export type MembershipBundleKey = (typeof MEMBERSHIP_BUNDLE_KEYS)[number];

export function getMembershipBundleKeyFromTitle(
  title: string
): MembershipBundleKey | null {
  const lower = title.toLowerCase();
  if (lower.includes("axiom")) return "axiom-lite";
  if (lower.includes("garrett") && (lower.includes("24k") || lower.includes("goldmaster"))) {
    return "gm24k";
  }
  if (lower.includes("2000") && lower.includes("minelab")) {
    return "gm2000";
  }
  if (lower.includes("1000") && lower.includes("minelab")) {
    return "gm1000";
  }
  return null;
}

export function isMembershipBundleTitle(title: string): boolean {
  return getMembershipBundleKeyFromTitle(title) !== null;
}

export function getMembershipBundleKeyFromHandle(
  handle: string
): MembershipBundleKey | null {
  const lower = handle.toLowerCase();
  if (lower.includes("axiom")) return "axiom-lite";
  if (lower.includes("garrett") || lower.includes("24k")) return "gm24k";
  if (lower.includes("gm2000") || lower.includes("2000")) return "gm2000";
  if (lower.includes("gm1000") || lower.includes("1000")) return "gm1000";
  return null;
}
