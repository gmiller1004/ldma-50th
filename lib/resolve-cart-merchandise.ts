import { getProductById } from "@/lib/shopify";

/**
 * Cart permalink lines use numeric Shopify ids. Email links may pass a product id
 * (admin "Product ID") or a variant id — resolve to a ProductVariant GID for cartCreate.
 */
export async function resolveMerchandiseIdForCart(numericOrGid: string): Promise<string> {
  if (numericOrGid.startsWith("gid://shopify/ProductVariant/")) {
    return numericOrGid;
  }

  if (numericOrGid.startsWith("gid://shopify/Product/")) {
    const product = await getProductById(numericOrGid);
    const variantId = product?.variants?.edges?.[0]?.node?.id;
    if (variantId) return variantId;
    throw new Error("Product has no variants");
  }

  const product = await getProductById(numericOrGid);
  const variantFromProduct = product?.variants?.edges?.[0]?.node?.id;
  if (variantFromProduct) return variantFromProduct;

  return `gid://shopify/ProductVariant/${numericOrGid}`;
}
