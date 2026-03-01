"use server";

import { getMembershipCollectionProducts } from "@/lib/shopify";
import type { ShopifyProduct } from "@/lib/shopify";
import type { MembershipProductKey } from "@/lib/membership-config";

export type MembershipProductInfo = {
  key: MembershipProductKey;
  product: ShopifyProduct;
  variantId: string;
  price: string;
  compareAtPrice: string | null;
  title: string;
};

/** Funnel order for the customization flow */
const FLOW_ORDER: MembershipProductKey[] = [
  "lifetime",
  "companion",
  "paydirt",
  "minelab",
  "gpaa",
];

export async function getMembershipProductsForFlow(): Promise<
  MembershipProductInfo[]
> {
  const map = await getMembershipCollectionProducts();
  const result: MembershipProductInfo[] = [];

  for (const key of FLOW_ORDER) {
    const product = map[key];
    if (!product) continue;
    const variant = product.variants?.edges?.[0]?.node;
    if (!variant) continue;
    const compareAtPrice =
      variant.compareAtPrice?.amount && parseFloat(variant.compareAtPrice.amount) > 0
        ? variant.compareAtPrice.amount
        : null;

    result.push({
      key,
      product,
      variantId: variant.id,
      price: variant.price.amount,
      compareAtPrice,
      title: product.title,
    });
  }

  return result;
}

/** Get Companion add-on product for profile upsell (members without it). */
export async function getCompanionAddOnProduct(): Promise<MembershipProductInfo | null> {
  const map = await getMembershipCollectionProducts();
  const product = map.companion;
  if (!product) return null;
  const variant = product.variants?.edges?.[0]?.node;
  if (!variant) return null;
  const compareAtPrice =
    variant.compareAtPrice?.amount && parseFloat(variant.compareAtPrice.amount) > 0
      ? variant.compareAtPrice.amount
      : null;

  return {
    key: "companion",
    product,
    variantId: variant.id,
    price: variant.price.amount,
    compareAtPrice,
    title: product.title,
  };
}
