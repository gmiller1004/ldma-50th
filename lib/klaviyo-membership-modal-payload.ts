/**
 * Pure payload for membership modal Klaviyo events (server API + browser onsite track).
 */

import type { MembershipProductKey } from "@/lib/membership-config";
import {
  getMembershipKeyFromTitle,
  isMembershipProductKey,
} from "@/lib/membership-config";
import {
  buildFlowDiscountKlaviyoProps,
  membershipKeysFromQuoteLineItems,
} from "@/lib/membership-flow-discounts";
import {
  buildShopifyCartPermalink,
} from "@/lib/shopify-cart-permalink";

export function formatQuoteLineItemsSummary(
  line_items: Array<{ title: string; price: string }>,
  total: number,
  currency: string
): string {
  const rows = line_items.map(
    (l) => `• ${l.title} — $${parseFloat(l.price).toFixed(2)}`
  );
  rows.push(`Total: ${total.toFixed(2)} ${currency}`);
  return rows.join("\n");
}

/** Quote line items → permalink lines (qty 1 each; membershipKey for flow bumps). */
export function quotePermalinkLinesForMembership(
  line_items: Array<{ variant_id?: string; key?: string; title?: string }>
): Array<{
  variantId: string;
  quantity: number;
  membershipKey: MembershipProductKey | null;
}> {
  return line_items
    .filter(
      (l): l is { variant_id: string; key?: string; title?: string } =>
        Boolean(l.variant_id?.trim())
    )
    .map((l) => {
      let membershipKey: MembershipProductKey | null = null;
      if (l.key && isMembershipProductKey(l.key)) {
        membershipKey = l.key;
      } else if (l.title) {
        membershipKey = getMembershipKeyFromTitle(l.title);
      }
      return {
        variantId: l.variant_id,
        quantity: 1,
        membershipKey,
      };
    });
}

export function buildMembershipModalEventProperties(params: {
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
  source: "membership_modal_summary_view" | "membership_modal_go_to_cart";
}): Record<string, unknown> {
  const { line_items, choices, subtotal, currency, checkout_url, source } = params;
  const line_items_summary = formatQuoteLineItemsSummary(
    line_items.map((l) => ({ title: l.title, price: l.price })),
    subtotal,
    currency
  );
  const linesForPerm = quotePermalinkLinesForMembership(line_items);
  const plainLines = linesForPerm.map(({ variantId, quantity }) => ({
    variantId,
    quantity,
  }));
  const cart_permalink = buildShopifyCartPermalink(plainLines);
  const cart_permalink_no_discount = buildShopifyCartPermalink(plainLines, "");
  const quoteKeys = membershipKeysFromQuoteLineItems(line_items);
  const flowDiscountProps = buildFlowDiscountKlaviyoProps(linesForPerm, quoteKeys);

  return {
    choices,
    line_items,
    subtotal,
    currency,
    checkout_url,
    cart_permalink,
    cart_permalink_no_discount,
    ...flowDiscountProps,
    line_items_summary,
    $value: subtotal,
    source,
  };
}
