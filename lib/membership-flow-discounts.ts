/**
 * Nurture-email discount codes: which Shopify discount applies when a membership
 * product key is in the cart. Comma-joined for ?discount= on cart permalinks.
 * (Additional codes can be added later for later funnel emails.)
 */

import type { MembershipProductKey } from "@/lib/membership-config";
import {
  MEMBERSHIP_PRODUCT_KEYS,
  getMembershipKeyFromTitle,
  isMembershipProductKey,
} from "@/lib/membership-config";
import { buildShopifyCartPermalink } from "@/lib/shopify-cart-permalink";

/** Discount codes keyed by membership funnel product (when that line is in the cart). */
export const FLOW_DISCOUNT_CODE_BY_KEY: Partial<Record<MembershipProductKey, string>> =
  {
    companion: "companion299",
    paydirt: "doublethegold",
    minelab: "monsteraddon",
  };

const KEY_ORDER: MembershipProductKey[] = [
  "lifetime",
  "companion",
  "paydirt",
  "minelab",
  "gpaa",
];

/** Ordered list of discount codes to append (no duplicates). */
export function getFlowDiscountCodesForMembershipKeys(
  keys: MembershipProductKey[]
): string[] {
  const set = new Set(keys);
  const out: string[] = [];
  for (const key of KEY_ORDER) {
    if (!set.has(key)) continue;
    const code = FLOW_DISCOUNT_CODE_BY_KEY[key];
    if (code && !out.includes(code)) out.push(code);
  }
  return out;
}

export function membershipKeysFromQuoteLineItems(
  line_items: Array<{ key?: string; title?: string }>
): MembershipProductKey[] {
  const keys: MembershipProductKey[] = [];
  for (const row of line_items) {
    if (row.key && isMembershipProductKey(row.key)) {
      keys.push(row.key);
      continue;
    }
    if (row.title) {
      const k = getMembershipKeyFromTitle(row.title);
      if (k) keys.push(k);
    }
  }
  return keys;
}

export type FlowDiscountKlaviyoProps = {
  cart_permalink_with_flow_discounts: string;
  /** Comma-separated, e.g. companion299,doublethegold — for display or debugging */
  flow_discount_codes: string;
  discount_offer_companion: boolean;
  discount_offer_paydirt: boolean;
  discount_offer_minelab: boolean;
};

/** Line item for flow URL: optional membershipKey tags paydirt for qty bump. */
export type PermalinkLineInput = {
  variantId: string;
  quantity: number;
  membershipKey?: MembershipProductKey | null;
};

/**
 * doublethegold expects two paydirt cans in the cart URL when paydirt is in the bundle.
 * Only used for cart_permalink_with_flow_discounts (not cart_permalink).
 */
export function bumpPaydirtQtyForFlowDiscountPermalink(
  lines: PermalinkLineInput[],
  membershipKeys: MembershipProductKey[]
): Array<{ variantId: string; quantity: number }> {
  if (!membershipKeys.includes("paydirt")) {
    return lines.map(({ variantId, quantity }) => ({ variantId, quantity }));
  }
  return lines.map((line) => {
    if (line.membershipKey !== "paydirt") {
      return { variantId: line.variantId, quantity: line.quantity };
    }
    return {
      variantId: line.variantId,
      quantity: Math.max(line.quantity, 2),
    };
  });
}

/**
 * Builds the cart URL with only the flow discounts that match items in the cart.
 * Paydirt line quantity is raised to at least 2 when paydirt is present (for doublethegold).
 * @param permalinkLines variant lines; include membershipKey per line when known
 * @param membershipKeys keys present in the cart / quote (e.g. companion, paydirt)
 */
export function buildFlowDiscountKlaviyoProps(
  permalinkLines: PermalinkLineInput[],
  membershipKeys: MembershipProductKey[]
): FlowDiscountKlaviyoProps {
  const codes = getFlowDiscountCodesForMembershipKeys(membershipKeys);
  const joined = codes.join(",");
  const linesForFlowUrl = bumpPaydirtQtyForFlowDiscountPermalink(
    permalinkLines,
    membershipKeys
  );
  const cart_permalink_with_flow_discounts =
    linesForFlowUrl.length === 0
      ? ""
      : buildShopifyCartPermalink(linesForFlowUrl, codes.length ? joined : "");

  return {
    cart_permalink_with_flow_discounts,
    flow_discount_codes: joined,
    discount_offer_companion: membershipKeys.includes("companion"),
    discount_offer_paydirt: membershipKeys.includes("paydirt"),
    discount_offer_minelab: membershipKeys.includes("minelab"),
  };
}
