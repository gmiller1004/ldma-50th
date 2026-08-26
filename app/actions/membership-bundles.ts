"use server";

import {
  LDMA_AXIOM_LITE_BUNDLE_PRODUCT_ID,
  type MembershipBundleKey,
} from "@/lib/membership-bundle-config";
import { getProductById } from "@/lib/shopify";

export type MembershipBundleProductInfo = {
  key: MembershipBundleKey;
  productId: string;
  variantId: string;
  price: string;
  compareAtPrice: string | null;
  title: string;
  availableForSale: boolean;
  imageUrl: string | null;
  imageAlt: string | null;
};

export async function getBundleMembershipProducts(): Promise<MembershipBundleProductInfo[]> {
  const product = await getProductById(LDMA_AXIOM_LITE_BUNDLE_PRODUCT_ID);
  if (!product) return [];

  const variant = product.variants?.edges?.[0]?.node;
  if (!variant) return [];

  const compareAtPrice =
    variant.compareAtPrice?.amount && parseFloat(variant.compareAtPrice.amount) > 0
      ? variant.compareAtPrice.amount
      : null;

  return [
    {
      key: "axiom-lite",
      productId: product.id,
      variantId: variant.id,
      price: variant.price.amount,
      compareAtPrice,
      title: product.title,
      availableForSale: variant.availableForSale !== false,
      imageUrl: product.featuredImage?.url ?? product.images?.edges?.[0]?.node?.url ?? null,
      imageAlt: product.featuredImage?.altText ?? product.images?.edges?.[0]?.node?.altText ?? null,
    },
  ];
}
