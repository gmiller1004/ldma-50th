/**
 * Klaviyo custom metrics for membership cart / quote remarketing.
 * Uses Create Event API (events:write scope on private API key).
 */

import type { CartData } from "@/lib/shopify";
import { getCart } from "@/lib/shopify";
import {
  isMembershipProduct,
  getMembershipKeyFromTitle,
} from "@/lib/membership-config";
import type { MembershipProductKey } from "@/lib/membership-config";
import {
  getMembershipBundleKeyFromTitle,
  isMembershipBundleTitle,
  type MembershipBundleKey,
} from "@/lib/membership-bundle-config";
import {
  buildFlowDiscountKlaviyoProps,
  membershipKeysFromQuoteLineItems,
} from "@/lib/membership-flow-discounts";
import {
  buildMembershipModalEventProperties,
  formatQuoteLineItemsSummary,
  quotePermalinkLinesForMembership,
} from "@/lib/klaviyo-membership-modal-payload";
import { MEMBERSHIP_METRICS } from "@/lib/klaviyo-membership-constants";
import {
  buildShopifyCartPermalink,
  gidToNumericId,
} from "@/lib/shopify-cart-permalink";

export { MEMBERSHIP_METRICS } from "@/lib/klaviyo-membership-constants";
export {
  formatQuoteLineItemsSummary,
} from "@/lib/klaviyo-membership-modal-payload";

const KLAVIYO_BASE = "https://a.klaviyo.com/api";
/** Align with camp stay / events patterns */
const KLAVIYO_REVISION = "2024-02-15";

/** HttpOnly cookie set when user saves a quote — server cart actions read this to sync cart to Klaviyo. */
export const MEMBERSHIP_QUOTE_EMAIL_COOKIE = "membership_quote_email";

/** Plain-text for cart-based events (quantity + line totals). */
export function formatCartLineItemsSummary(
  lines: Array<{ title: string; quantity: number; line_total: number }>,
  membershipTotal: number,
  currency: string
): string {
  const rows = lines.map((l) => {
    const qty = l.quantity > 1 ? ` × ${l.quantity}` : "";
    return `• ${l.title}${qty} — ${l.line_total.toFixed(2)} ${currency}`;
  });
  rows.push(`Membership items total: ${membershipTotal.toFixed(2)} ${currency}`);
  return rows.join("\n");
}

function getApiKey(): string | null {
  const key = process.env.KLAVIYO_PRIVATE_API_KEY;
  return key?.trim() || null;
}

export function isKlaviyoMembershipEventsConfigured(): boolean {
  return Boolean(getApiKey());
}

function cartHasMembershipLines(cart: CartData): boolean {
  return cart.lines.edges.some((e) =>
    isMembershipProduct(e.node.merchandise.product.title) ||
    isMembershipBundleTitle(e.node.merchandise.product.title)
  );
}

type LineSummary = {
  title: string;
  quantity: number;
  line_total: number;
  /** Numeric variant id (for templates / parity with cart permalink). */
  variant_id: string;
  /** Funnel key when derivable from product title (for flow discounts). */
  membership_key: MembershipProductKey | null;
  /** Bundle key for detector bundle remarketing. */
  bundle_key: MembershipBundleKey | null;
};

function summarizeCartLines(cart: CartData): { lines: LineSummary[]; value: number } {
  let value = 0;
  const lines: LineSummary[] = [];
  for (const { node } of cart.lines.edges) {
    const title = node.merchandise.product.title;
    if (!isMembershipProduct(title) && !isMembershipBundleTitle(title)) continue;
    const lineTotal = parseFloat(node.cost.totalAmount.amount);
    value += lineTotal;
    lines.push({
      title,
      quantity: node.quantity,
      line_total: lineTotal,
      variant_id: gidToNumericId(node.merchandise.id),
      membership_key: getMembershipKeyFromTitle(title),
      bundle_key: getMembershipBundleKeyFromTitle(title),
    });
  }
  return { lines, value };
}

function membershipCartPermalinkLinesFromCart(
  cart: CartData
): Array<{
  variantId: string;
  quantity: number;
  membershipKey: MembershipProductKey | null;
}> {
  const lines: Array<{
    variantId: string;
    quantity: number;
    membershipKey: MembershipProductKey | null;
  }> = [];
  for (const { node } of cart.lines.edges) {
    const title = node.merchandise.product.title;
    if (!isMembershipProduct(title) && !isMembershipBundleTitle(title)) continue;
    lines.push({
      variantId: node.merchandise.id,
      quantity: node.quantity,
      membershipKey: getMembershipKeyFromTitle(title),
    });
  }
  return lines;
}

/** Quote / modal line items: qty 1 each; variant_id is GID or numeric. */
function cartPermalinkFromQuoteLineItems(
  line_items: Array<{ variant_id?: string; key?: string; title?: string }>
): string {
  const lines = quotePermalinkLinesForMembership(line_items).map(
    ({ variantId, quantity }) => ({
      variantId,
      quantity,
    })
  );
  return buildShopifyCartPermalink(lines);
}

function cartPermalinkFromQuoteLineItemsNoDiscount(
  line_items: Array<{ variant_id?: string; key?: string; title?: string }>
): string {
  const lines = quotePermalinkLinesForMembership(line_items).map(
    ({ variantId, quantity }) => ({
      variantId,
      quantity,
    })
  );
  return buildShopifyCartPermalink(lines, "");
}

/**
 * Emit Membership Cart Updated for remarketing flows (profile identified by email).
 * No-ops if API key missing, cart missing, or cart has no membership lines.
 */
export async function syncMembershipCartToKlaviyo(
  email: string,
  cartId: string
): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) return;

  const cart = await getCart(cartId);
  if (!cart || !cartHasMembershipLines(cart)) return;

  const subtotal = parseFloat(cart.cost.subtotalAmount.amount);
  const currency = cart.cost.subtotalAmount.currencyCode ?? "USD";
  const { lines, value } = summarizeCartLines(cart);
  const line_items_summary = formatCartLineItemsSummary(lines, value, currency);
  const permalinkLines = membershipCartPermalinkLinesFromCart(cart);
  const plainPermalinkLines = permalinkLines.map(({ variantId, quantity }) => ({
    variantId,
    quantity,
  }));
  const cart_permalink = buildShopifyCartPermalink(plainPermalinkLines);
  const cart_permalink_no_discount = buildShopifyCartPermalink(plainPermalinkLines, "");
  const membershipKeysFromCart = lines
    .map((l) => l.membership_key)
    .filter((k): k is MembershipProductKey => k !== null);
  const flowDiscountProps = buildFlowDiscountKlaviyoProps(
    permalinkLines,
    membershipKeysFromCart
  );
  const bundleKeys = Array.from(
    new Set(
      lines
        .map((l) => l.bundle_key)
        .filter((k): k is MembershipBundleKey => k !== null)
    )
  );
  const bundleTitles = Array.from(
    new Set(lines.filter((l) => l.bundle_key !== null).map((l) => l.title))
  );
  const primaryBundleKey = bundleKeys[0] ?? null;

  await createMembershipEvent(apiKey, {
    email: email.trim().toLowerCase(),
    metricName: MEMBERSHIP_METRICS.cartUpdated,
    uniqueId: `${cartId}-${Date.now()}`,
    properties: {
      cart_id: cartId,
      checkout_url: cart.checkoutUrl,
      cart_permalink,
      cart_permalink_no_discount,
      ...flowDiscountProps,
      currency,
      subtotal,
      $value: value,
      line_items: lines,
      line_count: lines.length,
      line_items_summary,
      bundle_keys: bundleKeys,
      bundle_titles: bundleTitles,
      bundle_interest: bundleKeys.length > 0,
      primary_bundle_key: primaryBundleKey,
      source: "shopify_headless_cart",
    },
  });
}

type CreateEventPayload = {
  email: string;
  metricName: string;
  uniqueId: string;
  properties: Record<string, unknown>;
};

async function createMembershipEvent(
  apiKey: string,
  payload: CreateEventPayload
): Promise<boolean> {
  const time = new Date().toISOString();
  try {
    const res = await fetch(`${KLAVIYO_BASE}/events/`, {
      method: "POST",
      headers: {
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        revision: KLAVIYO_REVISION,
      },
      body: JSON.stringify({
        data: {
          type: "event",
          attributes: {
            properties: payload.properties,
            time,
            unique_id: payload.uniqueId,
            metric: {
              data: {
                type: "metric",
                attributes: {
                  name: payload.metricName,
                },
              },
            },
            profile: {
              data: {
                type: "profile",
                attributes: {
                  email: payload.email,
                },
              },
            },
          },
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[Klaviyo] membership event error:", res.status, text);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[Klaviyo] membership event exception:", e);
    return false;
  }
}

/**
 * Emit Membership Quote Saved (e.g. from /api/membership/save-quote).
 */
export async function trackMembershipQuoteSaved(
  email: string,
  properties: {
    checkout_url: string;
    subtotal: number;
    currency: string;
    choices: Record<string, string>;
    line_items: Array<{
      key: string;
      title: string;
      price: string;
      variant_id?: string;
    }>;
  }
): Promise<boolean> {
  const apiKey = getApiKey();
  if (!apiKey) return false;

  const normalized = email.trim().toLowerCase();
  const line_items_summary = formatQuoteLineItemsSummary(
    properties.line_items.map((l) => ({ title: l.title, price: l.price })),
    properties.subtotal,
    properties.currency
  );
  const cart_permalink = cartPermalinkFromQuoteLineItems(properties.line_items);
  const cart_permalink_no_discount = cartPermalinkFromQuoteLineItemsNoDiscount(
    properties.line_items
  );
  const quoteKeys = membershipKeysFromQuoteLineItems(properties.line_items);
  const flowDiscountProps = buildFlowDiscountKlaviyoProps(
    quotePermalinkLinesForMembership(properties.line_items),
    quoteKeys
  );

  return createMembershipEvent(apiKey, {
    email: normalized,
    metricName: MEMBERSHIP_METRICS.quoteSaved,
    uniqueId: `${normalized}-quote-${Date.now()}`,
    properties: {
      ...properties,
      cart_permalink,
      cart_permalink_no_discount,
      ...flowDiscountProps,
      line_items_summary,
      $value: properties.subtotal,
      source: "membership_save_quote",
    },
  });
}

/**
 * User finished the membership modal (“Go to Cart”) — one event per completion for nurture flows.
 */
export async function trackMembershipConfigurationFinalized(
  email: string,
  properties: {
    choices: Record<string, string>;
    line_items: Array<{
      key: string;
      title: string;
      price: string;
      variant_id?: string;
    }>;
    subtotal: number;
    currency: string;
    checkout_url: string;
  }
): Promise<boolean> {
  const apiKey = getApiKey();
  if (!apiKey) return false;

  const normalized = email.trim().toLowerCase();
  const payload = buildMembershipModalEventProperties({
    choices: properties.choices,
    line_items: properties.line_items,
    subtotal: properties.subtotal,
    currency: properties.currency,
    checkout_url: properties.checkout_url,
    source: "membership_modal_go_to_cart",
  });

  return createMembershipEvent(apiKey, {
    email: normalized,
    metricName: MEMBERSHIP_METRICS.configurationFinalized,
    uniqueId: `${normalized}-config-final-${Date.now()}`,
    properties: payload,
  });
}

/**
 * User reached the membership summary step. This is intentionally separate from cart updates and
 * “Go to Cart” so remarketing can cover drop-offs before they open the cart drawer.
 */
export async function trackMembershipConfigurationViewed(
  email: string,
  properties: {
    choices: Record<string, string>;
    line_items: Array<{
      key: string;
      title: string;
      price: string;
      variant_id?: string;
    }>;
    subtotal: number;
    currency: string;
    checkout_url: string;
  }
): Promise<boolean> {
  const apiKey = getApiKey();
  if (!apiKey) return false;

  const normalized = email.trim().toLowerCase();
  const payload = buildMembershipModalEventProperties({
    choices: properties.choices,
    line_items: properties.line_items,
    subtotal: properties.subtotal,
    currency: properties.currency,
    checkout_url: properties.checkout_url,
    source: "membership_modal_summary_view",
  });

  return createMembershipEvent(apiKey, {
    email: normalized,
    metricName: MEMBERSHIP_METRICS.configurationViewed,
    uniqueId: `${normalized}-config-view-${Date.now()}`,
    properties: payload,
  });
}
