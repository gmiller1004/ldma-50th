import { MEMBERSHIP_COLLECTION_HANDLE } from "@/lib/membership-config";

export const MEMBERSHIP_BUNDLE_COLLECTION_HANDLE = MEMBERSHIP_COLLECTION_HANDLE;

export const MEMBERSHIP_BUNDLE_KEYS = ["gm1000", "gm24k", "gm2000"] as const;

export type MembershipBundleKey = (typeof MEMBERSHIP_BUNDLE_KEYS)[number];

export function getMembershipBundleKeyFromTitle(
  title: string
): MembershipBundleKey | null {
  const lower = title.toLowerCase();
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

export function getMembershipBundleKeyFromHandle(
  handle: string
): MembershipBundleKey | null {
  const lower = handle.toLowerCase();
  if (lower.includes("garrett") || lower.includes("24k")) return "gm24k";
  if (lower.includes("gm2000") || lower.includes("2000")) return "gm2000";
  if (lower.includes("gm1000") || lower.includes("1000")) return "gm1000";
  return null;
}
