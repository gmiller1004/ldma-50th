/**
 * Build a shareable Shopify cart URL: /cart/{variantId}:{qty},...
 * This matches the classic storefront permalink format (same as manual Mailchimp links).
 * Often more reliable in email than Storefront API checkoutUrl → checkouts/cn redirects on some themes.
 *
 * Optional discount query: set MEMBERSHIP_CART_PERMALINK_DISCOUNT (e.g. companion299).
 */

/** Last segment of a Shopify GID or numeric id string. */
export function gidToNumericId(gid: string): string {
  if (!gid) return gid;
  const tail = gid.split("/").pop() ?? gid;
  return tail;
}

export function getMembershipCartPermalinkDiscountCode(): string | undefined {
  const code =
    process.env.MEMBERSHIP_CART_PERMALINK_DISCOUNT?.trim() ||
    process.env.NEXT_PUBLIC_MEMBERSHIP_CART_PERMALINK_DISCOUNT?.trim();
  return code || undefined;
}

/**
 * @param lines variantId may be a Storefront GID or numeric string
 */
export function buildShopifyCartPermalink(
  lines: Array<{ variantId: string; quantity: number }>,
  discountCode?: string
): string {
  const domain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN?.trim();
  if (!domain || lines.length === 0) return "";

  const segment = lines
    .map((l) => {
      const id = gidToNumericId(l.variantId);
      const qty = Math.max(1, Math.min(100, Math.floor(Number(l.quantity) || 1)));
      return `${id}:${qty}`;
    })
    .join(",");

  const base = `https://${domain}/cart/${segment}`;
  // Explicit "" = no ?discount= (e.g. Klaviyo templates that must omit codes)
  if (discountCode === "") {
    return base;
  }
  const code = discountCode?.trim() || getMembershipCartPermalinkDiscountCode();
  return code ? `${base}?discount=${encodeURIComponent(code)}` : base;
}
