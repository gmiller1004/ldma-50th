/**
 * Build a shareable cart permalink on the headless storefront:
 *   https://myldma.com/cart/{variantId}:{qty},...
 *
 * Legacy myldmastore.myshopify.com/cart/… links return 410 — use this instead.
 * Handled by app/cart/[...lines]/route.ts (creates cart → Shopify checkout).
 *
 * Optional discount query: set MEMBERSHIP_CART_PERMALINK_DISCOUNT (e.g. companion299).
 */

function getCartPermalinkOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_CART_PERMALINK_ORIGIN?.replace(/\/$/, "") ||
    "https://myldma.com"
  );
}

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
  if (lines.length === 0) return "";

  const segment = lines
    .map((l) => {
      const id = gidToNumericId(l.variantId);
      const qty = Math.max(1, Math.min(100, Math.floor(Number(l.quantity) || 1)));
      return `${id}:${qty}`;
    })
    .join(",");

  const base = `${getCartPermalinkOrigin()}/cart/${segment}`;
  // Explicit "" = no ?discount= (e.g. Klaviyo templates that must omit codes)
  if (discountCode === "") {
    return base;
  }
  const code = discountCode?.trim() || getMembershipCartPermalinkDiscountCode();
  return code ? `${base}?discount=${encodeURIComponent(code)}` : base;
}
