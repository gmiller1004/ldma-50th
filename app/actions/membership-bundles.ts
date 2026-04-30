"use server";

import {
  getMembershipBundleKeyFromHandle,
  getMembershipBundleKeyFromTitle,
  type MembershipBundleKey,
} from "@/lib/membership-bundle-config";
import { getMembershipCollectionProductList, type ShopifyProduct } from "@/lib/shopify";

export type MembershipBundleProductInfo = {
  key: MembershipBundleKey;
  product: ShopifyProduct;
  variantId: string;
  price: string;
  compareAtPrice: string | null;
  title: string;
};

const BUNDLE_ORDER: MembershipBundleKey[] = ["gm1000", "gm24k", "gm2000"];

function hasBundleTag(product: ShopifyProduct): boolean {
  const tags = product.tags ?? [];
  return tags.some((tag) => tag.trim().toLowerCase() === "ldma-bundle");
}

function hasSpecificBundleTag(product: ShopifyProduct, key: MembershipBundleKey): boolean {
  const tags = product.tags ?? [];
  const wanted = `ldma-bundle-${key}`;
  return tags.some((tag) => tag.trim().toLowerCase() === wanted);
}

function inferBundleKeyFromPricing(
  price: string,
  compareAtPrice: string | null
): MembershipBundleKey | null {
  const p = Number.parseFloat(price);
  const c = compareAtPrice ? Number.parseFloat(compareAtPrice) : Number.NaN;
  if (Number.isFinite(c)) {
    if (Math.abs(c - 10409) < 1) return "gm24k";
    if (Math.abs(c - 10498) < 1) return "gm1000";
    if (Math.abs(c - 11498) < 1) return "gm2000";
  }
  if (Number.isFinite(p) && Math.abs(p - 4000) < 1) return "gm2000";
  return null;
}

function isAddOnLikeProduct(product: ShopifyProduct): boolean {
  const lowerTitle = product.title.toLowerCase();
  const lowerHandle = product.handle.toLowerCase();
  return (
    lowerTitle.includes("add on") ||
    lowerTitle.includes("add-on") ||
    lowerTitle.includes("addon") ||
    lowerHandle.includes("add-on") ||
    lowerHandle.includes("addon")
  );
}

export async function getBundleMembershipProducts(): Promise<MembershipBundleProductInfo[]> {
  const products = await getMembershipCollectionProductList();
  const taggedProducts = products.filter(hasBundleTag);
  const sourceProducts = taggedProducts.length > 0 ? taggedProducts : products;
  const byKey: Partial<Record<MembershipBundleKey, MembershipBundleProductInfo>> = {};

  for (const product of sourceProducts) {
    if (isAddOnLikeProduct(product)) continue;

    const variant = product.variants?.edges?.[0]?.node;
    if (!variant) continue;

    const compareAtPrice =
      variant.compareAtPrice?.amount && parseFloat(variant.compareAtPrice.amount) > 0
        ? variant.compareAtPrice.amount
        : null;

    const keyFromSpecificTag = BUNDLE_ORDER.find((key) => hasSpecificBundleTag(product, key)) ?? null;
    const inferredKey =
      keyFromSpecificTag ||
      getMembershipBundleKeyFromTitle(product.title) ||
      getMembershipBundleKeyFromHandle(product.handle) ||
      inferBundleKeyFromPricing(variant.price.amount, compareAtPrice);
    if (!inferredKey || byKey[inferredKey]) continue;

    byKey[inferredKey] = {
      key: inferredKey,
      product,
      variantId: variant.id,
      price: variant.price.amount,
      compareAtPrice,
      title: product.title,
    };
  }

  return BUNDLE_ORDER.map((key) => byKey[key]).filter(
    (item): item is MembershipBundleProductInfo => Boolean(item)
  );
}
