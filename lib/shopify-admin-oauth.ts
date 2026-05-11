/**
 * Normalize ?shop= param and enforce allowlist against NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN.
 */
export function normalizeInstallShop(shopParam: string | null): string | null {
  if (!shopParam?.trim()) return null;
  let s = shopParam.trim().toLowerCase();
  if (!s.endsWith(".myshopify.com")) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(s)) return null;
    s = `${s}.myshopify.com`;
  }

  const allowedRaw =
    process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN?.trim() ||
    process.env.SHOPIFY_SHOP_DOMAIN?.trim();
  if (allowedRaw) {
    const allowed = allowedRaw
      .replace(/^https?:\/\//, "")
      .split("/")[0]
      .toLowerCase();
    if (s !== allowed) return null;
  }

  return s;
}

export function getOAuthRedirectUri(): string | null {
  const explicit = process.env.SHOPIFY_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.VERCEL_URL?.trim();
  if (!base) return null;
  const origin = base.startsWith("http") ? base : `https://${base}`;
  return `${origin}/api/shopify/oauth/callback`;
}

export function adminOAuthScopes(): string {
  return (
    process.env.SHOPIFY_ADMIN_OAUTH_SCOPES?.trim() ||
    "read_products,read_all_orders"
  );
}
