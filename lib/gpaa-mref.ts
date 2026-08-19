/**
 * GPAA member referrals: capture ?mref= on any myldma.com URL, persist 30 days,
 * and stamp Shopify cart attribute referral_code on membership carts only.
 */

export const GPAA_MREF_COOKIE = "gpaa_mref";
export const GPAA_MREF_COOKIE_MAX_AGE = 2592000; // 30 days
export const GPAA_MREF_QUERY_PARAM = "mref";
export const GPAA_REFERRAL_ATTRIBUTE_KEY = "referral_code";

/** LDMA Lifetime Bundle — Garrett Axiom Lite (GPAA + LDMA dual Lifetime) */
export const GPAA_REFERRAL_ALWAYS_MEMBERSHIP_PRODUCT_ID = "7636626899015";

export const GPAA_REFERRAL_MEMBERSHIP_COLLECTION_HANDLES = [
  "membership",
  "memberships",
] as const;

const MIN_CODE_LEN = 3;
const MAX_CODE_LEN = 32;

export function sanitizeGpaaMref(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  const normalized = String(raw).trim().toUpperCase();
  if (normalized.length < MIN_CODE_LEN || normalized.length > MAX_CODE_LEN) return null;
  if (!/^[A-Z0-9]+$/.test(normalized)) return null;
  return normalized;
}

export function shopifyNumericProductId(productGidOrId: string | undefined | null): string | null {
  if (!productGidOrId) return null;
  const raw = String(productGidOrId).trim();
  const gidMatch = raw.match(/Product\/(\d+)\s*$/i);
  if (gidMatch) return gidMatch[1];
  if (/^\d+$/.test(raw)) return raw;
  return null;
}

export function isGpaaReferralMembershipCollectionHandle(handle: string | undefined | null): boolean {
  if (!handle) return false;
  return (GPAA_REFERRAL_MEMBERSHIP_COLLECTION_HANDLES as readonly string[]).includes(
    handle.trim().toLowerCase()
  );
}

export type GpaaReferralCartProduct = {
  id?: string | null;
  collections?: { edges?: Array<{ node?: { handle?: string | null } | null } | null> | null } | null;
};

export type GpaaReferralCartLine = {
  merchandise?: {
    product?: GpaaReferralCartProduct | null;
  } | null;
};

export function cartLineIsMembershipForReferral(line: GpaaReferralCartLine): boolean {
  const product = line.merchandise?.product;
  if (!product) return false;
  const numericId = shopifyNumericProductId(product.id);
  if (numericId === GPAA_REFERRAL_ALWAYS_MEMBERSHIP_PRODUCT_ID) return true;
  const handles = product.collections?.edges ?? [];
  return handles.some((edge) => isGpaaReferralMembershipCollectionHandle(edge?.node?.handle));
}

export function cartHasMembershipForReferral(
  lines: Array<GpaaReferralCartLine> | undefined | null
): boolean {
  if (!lines?.length) return false;
  return lines.some(cartLineIsMembershipForReferral);
}

export type CartAttribute = { key: string; value: string };

export function nextReferralCartAttributes(
  existing: Array<CartAttribute> | undefined | null,
  referralCode: string | null,
  hasMembership: boolean
): { attributes: CartAttribute[]; changed: boolean } {
  const current = (existing ?? []).filter((a) => a.key && a.key !== GPAA_REFERRAL_ATTRIBUTE_KEY);
  const previous = (existing ?? []).find((a) => a.key === GPAA_REFERRAL_ATTRIBUTE_KEY)?.value ?? "";
  const nextValue = hasMembership && referralCode ? referralCode : "";
  return {
    attributes: [...current, { key: GPAA_REFERRAL_ATTRIBUTE_KEY, value: nextValue }],
    changed: previous !== nextValue,
  };
}

export function gpaaMrefCookieOptions(hostname?: string | null) {
  const host = (hostname ?? "").split(":")[0]?.toLowerCase() ?? "";
  const onLdmaSite =
    host === "myldma.com" || host === "www.myldma.com" || host.endsWith(".myldma.com");
  return {
    path: "/",
    maxAge: GPAA_MREF_COOKIE_MAX_AGE,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    ...(onLdmaSite ? { domain: ".myldma.com" } : {}),
  };
}
