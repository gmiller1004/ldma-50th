import { GraphQLClient } from "graphql-request";
import {
  MEMBERSHIP_COLLECTION_HANDLE,
  getMembershipKeyFromTitle,
  type MembershipProductKey,
} from "./membership-config";
import { EVENT_COLLECTION_HANDLE } from "./events-config";

const SHOPIFY_API_VERSION = "2026-01";

function getShopifyEndpoint() {
  const domain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
  const token = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN;

  if (!domain || !token) {
    throw new Error(
      "Missing NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN or NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN"
    );
  }

  return `https://${domain}/api/${SHOPIFY_API_VERSION}/graphql.json`;
}

export function shopifyFetch<T>({
  query,
  variables = {},
}: {
  query: string;
  variables?: Record<string, unknown>;
}): Promise<T> {
  const endpoint = getShopifyEndpoint();
  const token = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN!;

  const client = new GraphQLClient(endpoint, {
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
  });

  return client.request<T>(query, variables);
}

// Collection handles to try for 50th merch (in order of preference)
// "merch" first — main merch collection where new products are typically added
const MERCH_COLLECTION_HANDLES = [
  "merch",
  "50th-anniversary",
  "50th anniversary",
  "membership",
  "dirtfest",
  "all",
];

/** Primary collection handle for full shop page */
export const SHOP_COLLECTION_HANDLE = "merch";

export type ProductOption = {
  name: string;
  optionValues: Array<{ name: string }>;
};

export type ProductVariant = {
  id: string;
  price: { amount: string; currencyCode: string };
  compareAtPrice: { amount: string; currencyCode: string } | null;
  selectedOptions: Array<{ name: string; value: string }>;
};

export type ShopifyProduct = {
  id: string;
  title: string;
  handle: string;
  options: ProductOption[];
  variants: {
    edges: Array<{ node: ProductVariant }>;
  };
  featuredImage: {
    url: string;
    altText: string | null;
    width: number;
    height: number;
  } | null;
};

export type EventProductImage = {
  url: string;
  altText: string | null;
  width: number;
  height: number;
};

export type EventVariant = {
  id: string;
  availableForSale: boolean;
  price: { amount: string; currencyCode: string };
  compareAtPrice: { amount: string; currencyCode: string } | null;
  selectedOptions: Array<{ name: string; value: string }>;
  metafields?: Array<{ key: string; value: string }>;
};

export type EventProductOption = {
  name: string;
  optionValues: Array<{ name: string }>;
};

export type EventProduct = {
  id: string;
  title: string;
  handle: string;
  descriptionHtml?: string;
  tags: string[];
  metafields?: Array<{ namespace?: string; key: string; value: string }>;
  featuredImage: EventProductImage | null;
  images?: {
    edges: Array<{ node: EventProductImage }>;
  };
  options?: EventProductOption[];
  variants: {
    edges: Array<{ node: EventVariant }>;
  };
};

/** Product for VIP upsell modal (variant metafields for price_level). */
export type VipUpsellProduct = {
  id: string;
  title: string;
  handle: string;
  descriptionHtml?: string;
  featuredImage: EventProductImage | null;
  images?: { edges: Array<{ node: EventProductImage }> };
  options?: EventProductOption[];
  variants: { edges: Array<{ node: EventVariant }> };
};

const PRODUCT_FRAGMENT = `
  fragment ProductFields on Product {
    id
    title
    handle
    featuredImage {
      url
      altText
      width
      height
    }
    options(first: 10) {
      name
      optionValues {
        name
      }
    }
    variants(first: 100) {
      edges {
        node {
          id
          price {
            amount
            currencyCode
          }
          compareAtPrice {
            amount
            currencyCode
          }
          selectedOptions {
            name
            value
          }
        }
      }
    }
  }
`;

/** Product fragment for shop collection page. Full details for product cards and modal. */
export type ShopProductVariant = {
  id: string;
  availableForSale: boolean;
  price: { amount: string; currencyCode: string };
  compareAtPrice: { amount: string; currencyCode: string } | null;
  selectedOptions: Array<{ name: string; value: string }>;
  /** Linked product image (same URL as one of product.images when set in Shopify admin). */
  image: EventProductImage | null;
  /** Subscription plans that apply to this variant (when using subscriptions). */
  sellingPlanAllocations?: {
    edges: Array<{
      node: {
        sellingPlan: { id: string; name: string };
      };
    }>;
  };
};

export type ShopProduct = {
  id: string;
  title: string;
  handle: string;
  productType?: string;
  publishedAt?: string;
  descriptionHtml?: string;
  featuredImage: EventProductImage | null;
  images?: {
    edges: Array<{ node: EventProductImage }>;
  };
  options?: EventProductOption[];
  variants: {
    edges: Array<{ node: ShopProductVariant }>;
  };
};

export type SellingPlanOption = {
  id: string;
  name: string;
};

/** Product with optional selling plans and collection membership. getProductByHandle returns this. */
export type ProductWithSellingPlans = ShopProduct & {
  collections?: { edges: Array<{ node: { handle: string } }> };
  sellingPlanGroups?: {
    edges: Array<{
      node: {
        name: string;
        appName?: string;
        sellingPlans: { edges: Array<{ node: SellingPlanOption }> };
      };
    }>;
  };
};

const SHOP_PRODUCT_FRAGMENT = `
  fragment ShopProductFields on Product {
    id
    title
    handle
    productType
    publishedAt
    descriptionHtml
    featuredImage {
      url
      altText
      width
      height
    }
    images(first: 10) {
      edges {
        node {
          url
          altText
          width
          height
        }
      }
    }
    options(first: 10) {
      name
      optionValues { name }
    }
    variants(first: 50) {
      edges {
        node {
          id
          availableForSale
          price { amount currencyCode }
          compareAtPrice { amount currencyCode }
          selectedOptions { name value }
          image {
            url
            altText
            width
            height
          }
          sellingPlanAllocations(first: 10) {
            edges {
              node {
                sellingPlan {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`;

/** Product with variant price_level metafields (for VIP upsell). */
const VIP_PRODUCT_FRAGMENT = `
  fragment VipProductFields on Product {
    id
    title
    handle
    descriptionHtml
    featuredImage {
      url
      altText
      width
      height
    }
    images(first: 5) {
      edges {
        node {
          url
          altText
          width
          height
        }
      }
    }
    options(first: 10) {
      name
      optionValues { name }
    }
    variants(first: 50) {
      edges {
        node {
          id
          availableForSale
          price { amount currencyCode }
          compareAtPrice { amount currencyCode }
          selectedOptions { name value }
          metafields(identifiers: [{ namespace: "custom", key: "price_level" }]) {
            key
            value
          }
        }
      }
    }
  }
`;

/** Product fragment for events. Requires unauthenticated_read_product_tags scope for tags. */
const EVENT_PRODUCT_FRAGMENT = `
  fragment EventProductFields on Product {
    id
    title
    handle
    descriptionHtml
    tags
    metafields(identifiers: [
      { namespace: "event", key: "start_date" },
      { namespace: "event", key: "end_date" },
      { namespace: "custom", key: "start_date" },
      { namespace: "custom", key: "end_date" }
    ]) {
      namespace
      key
      value
    }
    featuredImage {
      url
      altText
      width
      height
    }
    images(first: 10) {
      edges {
        node {
          url
          altText
          width
          height
        }
      }
    }
    options(first: 10) {
      name
      optionValues { name }
    }
    variants(first: 50) {
      edges {
        node {
          id
          availableForSale
          price { amount currencyCode }
          compareAtPrice { amount currencyCode }
          selectedOptions { name value }
          metafields(identifiers: [{ namespace: "custom", key: "price_level" }]) {
            key
            value
          }
        }
      }
    }
  }
`;


export async function getFeaturedProducts(
  limit = 4
): Promise<ShopifyProduct[]> {
  for (const handle of MERCH_COLLECTION_HANDLES) {
    try {
      const result = await shopifyFetch<{
        collection: {
          products: {
            edges: Array<{ node: ShopifyProduct }>;
          };
        } | null;
      }>({
        query: `
          ${PRODUCT_FRAGMENT}
          query GetCollectionProducts($handle: String!, $first: Int!) {
            collection(handle: $handle) {
              products(first: $first) {
                edges {
                  node {
                    ...ProductFields
                  }
                }
              }
            }
          }
        `,
        variables: { handle, first: limit },
      });

      if (result?.collection?.products?.edges?.length) {
        return result.collection.products.edges.map((e) => e.node);
      }
    } catch {
      continue;
    }
  }

  // Fallback: get any products from the store
  try {
    const result = await shopifyFetch<{
      products: {
        edges: Array<{ node: ShopifyProduct }>;
      };
    }>({
      query: `
        ${PRODUCT_FRAGMENT}
        query GetProducts($first: Int!) {
          products(first: $first) {
            edges {
              node {
                ...ProductFields
              }
            }
          }
        }
      `,
      variables: { first: limit },
    });

    return (
      result?.products?.edges?.map((e) => e.node) ?? []
    );
  } catch {
    return [];
  }
}

export type MembershipProductsMap = Partial<
  Record<MembershipProductKey, ShopifyProduct>
>;

/** Fetch membership collection products and map by key (lifetime, companion, paydirt, minelab, gpaa) */
export async function getMembershipCollectionProducts(): Promise<MembershipProductsMap> {
  try {
    const result = await shopifyFetch<{
      collection: {
        products: {
          edges: Array<{ node: ShopifyProduct }>;
        };
      } | null;
    }>({
      query: `
        ${PRODUCT_FRAGMENT}
        query GetMembershipProducts($handle: String!) {
          collection(handle: $handle) {
            products(first: 50) {
              edges {
                node {
                  ...ProductFields
                }
              }
            }
          }
        }
      `,
      variables: { handle: MEMBERSHIP_COLLECTION_HANDLE },
    });

    const products = result?.collection?.products?.edges ?? [];
    const map: MembershipProductsMap = {};

    for (const { node } of products) {
      const key = getMembershipKeyFromTitle(node.title);
      if (key && !map[key]) {
        map[key] = node;
      }
    }

    return map;
  } catch {
    return {};
  }
}

/** Fetch event products from the events collection only. */
export async function getEventProducts(): Promise<EventProduct[]> {
  try {
    const result = await shopifyFetch<{
      collection: {
        products: {
          edges: Array<{ node: EventProduct }>;
        };
      } | null;
    }>({
      query: `
        ${EVENT_PRODUCT_FRAGMENT}
        query GetEventProducts($handle: String!) {
          collection(handle: $handle) {
            products(first: 50, sortKey: TITLE) {
              edges {
                node {
                  ...EventProductFields
                }
              }
            }
          }
        }
      `,
      variables: { handle: EVENT_COLLECTION_HANDLE },
    });

    const products = result?.collection?.products?.edges ?? [];
    return products.map(({ node }) => ({
      ...node,
      tags: (node as { tags?: string[] }).tags ?? [],
      metafields: node.metafields,
    }));
  } catch (e) {
    throw e;
  }
}

export type MerchShopData = {
  products: ShopProduct[];
  collectionDescription?: string;
};

/** Fetch products and collection info from the merch collection for the shop page. */
export async function getMerchProducts(): Promise<MerchShopData> {
  for (const handle of MERCH_COLLECTION_HANDLES) {
    try {
      const result = await shopifyFetch<{
        collection: {
          description: string;
          descriptionHtml?: string;
          products: {
            edges: Array<{ node: ShopProduct }>;
          };
        } | null;
      }>({
        query: `
          ${SHOP_PRODUCT_FRAGMENT}
          query GetMerchProducts($handle: String!) {
            collection(handle: $handle) {
              description
              descriptionHtml
              products(first: 50, sortKey: TITLE) {
                edges {
                  node {
                    ...ShopProductFields
                  }
                }
              }
            }
          }
        `,
        variables: { handle },
      });

      const collection = result?.collection;
      const products = collection?.products?.edges ?? [];
      if (products.length > 0) {
        const desc =
          (collection?.descriptionHtml || collection?.description || "").trim();
        return {
          products: products.map(({ node }) => node),
          collectionDescription: desc || undefined,
        };
      }
    } catch {
      continue;
    }
  }
  return { products: [] };
}

/** Fetch all active (published) collection handles. */
export async function getAllCollectionHandles(): Promise<string[]> {
  try {
    const result = await shopifyFetch<{
      collections: { edges: Array<{ node: { handle: string } }> };
    }>({
      query: `
        query GetAllCollectionHandles($first: Int!) {
          collections(first: $first, sortKey: TITLE) {
            edges {
              node { handle }
            }
          }
        }
      `,
      variables: { first: 100 },
    });
    return (result?.collections?.edges ?? []).map((e) => e.node.handle);
  } catch (e) {
    console.error("getAllCollectionHandles error:", e);
    return [];
  }
}

/** Fetch all active (published) product handles for sitemap. */
export async function getAllProductHandles(): Promise<string[]> {
  try {
    const result = await shopifyFetch<{
      products: { edges: Array<{ node: { handle: string } }> };
    }>({
      query: `
        query GetAllProductHandles($first: Int!) {
          products(first: $first, sortKey: TITLE) {
            edges {
              node { handle }
            }
          }
        }
      `,
      variables: { first: 250 },
    });
    return (result?.products?.edges ?? []).map((e) => e.node.handle);
  } catch (e) {
    console.error("getAllProductHandles error:", e);
    return [];
  }
}

export type CollectionPageData = {
  handle: string;
  title: string;
  products: ShopProduct[];
  collectionDescription?: string;
};

/** Fetch a collection by handle with products. Returns null if not found. */
export async function getCollectionByHandle(
  handle: string
): Promise<CollectionPageData | null> {
  try {
    const result = await shopifyFetch<{
      collection: {
        handle: string;
        title: string;
        description?: string;
        descriptionHtml?: string;
        products: { edges: Array<{ node: ShopProduct }> };
      } | null;
    }>({
      query: `
        ${SHOP_PRODUCT_FRAGMENT}
        query GetCollectionByHandle($handle: String!) {
          collection(handle: $handle) {
            handle
            title
            description
            descriptionHtml
            products(first: 100, sortKey: TITLE) {
              edges {
                node {
                  ...ShopProductFields
                }
              }
            }
          }
        }
      `,
      variables: { handle },
    });

    const c = result?.collection;
    if (!c) return null;

    const edges = c.products?.edges;
    const products = Array.isArray(edges) ? edges.map((e) => e.node) : [];
    const desc = (c.descriptionHtml || c.description || "").trim();
    return {
      handle: c.handle,
      title: c.title,
      products,
      collectionDescription: desc || undefined,
    };
  } catch (e) {
    console.error("getCollectionByHandle error:", e);
    return null;
  }
}

/** Fetch related products from a collection, excluding one by handle. */
export async function getRelatedProducts(
  collectionHandle: string,
  excludeHandle: string,
  limit = 4
): Promise<ShopProduct[]> {
  try {
    const result = await shopifyFetch<{
      collection: {
        products: { edges: Array<{ node: ShopProduct }> };
      } | null;
    }>({
      query: `
        ${SHOP_PRODUCT_FRAGMENT}
        query GetRelatedProducts($handle: String!, $first: Int!) {
          collection(handle: $handle) {
            products(first: $first, sortKey: TITLE) {
              edges {
                node {
                  ...ShopProductFields
                }
              }
            }
          }
        }
      `,
      variables: { handle: collectionHandle, first: Math.min(limit + 10, 50) },
    });

    const edges = result?.collection?.products?.edges ?? [];
    const filtered = edges
      .map((e) => e.node)
      .filter((p): p is NonNullable<typeof p> => p != null && p.handle !== excludeHandle)
      .slice(0, limit);
    return filtered;
  } catch (e) {
    console.error("getRelatedProducts error:", e);
    return [];
  }
}

/** Fetch a single product by handle. Returns null if not found. Only returns published (active) products. */
export async function getProductByHandle(
  handle: string
): Promise<ProductWithSellingPlans | null> {
  try {
    const result = await shopifyFetch<{
      product: (ShopProduct & {
        collections?: { edges: Array<{ node: { handle: string } }> };
        sellingPlanGroups?: {
          edges: Array<{
            node: {
              name: string;
              appName?: string;
              sellingPlans: { edges: Array<{ node: { id: string; name: string } }> };
            };
          }>;
        };
      }) | null;
    }>({
      query: `
        ${SHOP_PRODUCT_FRAGMENT}
        query GetProductByHandle($handle: String!) {
          product(handle: $handle) {
            ...ShopProductFields
            collections(first: 20) {
              edges {
                node { handle }
              }
            }
            sellingPlanGroups(first: 5) {
              edges {
                node {
                  name
                  appName
                  sellingPlans(first: 20) {
                    edges {
                      node {
                        id
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `,
      variables: { handle },
    });

    const product = result?.product;
    if (!product) return null;

    return {
      ...product,
      sellingPlanGroups: product.sellingPlanGroups,
    };
  } catch (e) {
    console.error("getProductByHandle error:", e);
    return null;
  }
}

/** Fetch a product by handle with variant price_level metafields (for VIP upsell modal). */
export async function getProductByHandleWithVariantMetafields(
  handle: string
): Promise<VipUpsellProduct | null> {
  try {
    const result = await shopifyFetch<{
      product: VipUpsellProduct | null;
    }>({
      query: `
        ${VIP_PRODUCT_FRAGMENT}
        query GetVipUpsellProduct($handle: String!) {
          product(handle: $handle) {
            ...VipProductFields
          }
        }
      `,
      variables: { handle },
    });
    return result?.product ?? null;
  } catch (e) {
    console.error("getProductByHandleWithVariantMetafields error:", e);
    return null;
  }
}

export type CartLineInput = {
  merchandiseId: string;
  quantity?: number;
  sellingPlanId?: string;
};

export async function createCartAndAddLine(
  variantId: string,
  sellingPlanId?: string
) {
  return createCartAndAddLines([{ merchandiseId: variantId, sellingPlanId }]);
}

export async function createCartAndAddLines(
  lines: CartLineInput[] | string[]
) {
  const normalizedLines: CartLineInput[] = lines.map((item) =>
    typeof item === "string"
      ? { merchandiseId: item, quantity: 1 }
      : { merchandiseId: item.merchandiseId, quantity: item.quantity ?? 1, sellingPlanId: item.sellingPlanId }
  );
  const result = await shopifyFetch<{
    cartCreate: {
      cart: { checkoutUrl: string; id: string } | null;
      userErrors: Array<{ message: string }>;
    };
  }>({
    query: `
      mutation cartCreate($input: CartInput!) {
        cartCreate(input: $input) {
          cart {
            id
            checkoutUrl
          }
          userErrors {
            message
          }
        }
      }
    `,
    variables: {
      input: { lines: normalizedLines },
    },
  });

  const { cart, userErrors } = result.cartCreate;
  if (userErrors?.length) {
    throw new Error(userErrors[0].message);
  }
  if (!cart?.checkoutUrl) {
    throw new Error("Failed to create cart");
  }
  return { checkoutUrl: cart.checkoutUrl, cartId: cart.id };
}

export async function addLineToExistingCart(
  cartId: string,
  variantId: string,
  sellingPlanId?: string
) {
  return addLinesToExistingCart(cartId, [{ merchandiseId: variantId, sellingPlanId }]);
}

export async function addLinesToExistingCart(
  cartId: string,
  lines: CartLineInput[] | string[]
) {
  const normalizedLines: CartLineInput[] = lines.map((item) =>
    typeof item === "string"
      ? { merchandiseId: item, quantity: 1 }
      : { merchandiseId: item.merchandiseId, quantity: item.quantity ?? 1, sellingPlanId: item.sellingPlanId }
  );
  const result = await shopifyFetch<{
    cartLinesAdd: {
      cart: { checkoutUrl: string } | null;
      userErrors: Array<{ message: string }>;
    };
  }>({
    query: `
      mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
        cartLinesAdd(cartId: $cartId, lines: $lines) {
          cart {
            checkoutUrl
          }
          userErrors {
            message
          }
        }
      }
    `,
    variables: { cartId, lines: normalizedLines },
  });

  const { cart, userErrors } = result.cartLinesAdd;
  if (userErrors?.length) {
    throw new Error(userErrors[0].message);
  }
  if (!cart?.checkoutUrl) {
    throw new Error("Failed to add to cart");
  }
  return { checkoutUrl: cart.checkoutUrl };
}

export type CartLine = {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    product: {
      id: string;
      title: string;
      handle: string;
      featuredImage: { url: string } | null;
    };
    title: string;
    price: { amount: string; currencyCode: string };
    compareAtPrice: { amount: string; currencyCode: string } | null;
  };
  cost: { totalAmount: { amount: string; currencyCode: string } };
};

export type CartData = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  note?: string | null;
  cost: { subtotalAmount: { amount: string; currencyCode: string } };
  lines: { edges: Array<{ node: CartLine }> };
};

export async function getCart(cartId: string): Promise<CartData | null> {
  const result = await shopifyFetch<{ cart: CartData | null }>({
    query: `
      query GetCart($cartId: ID!) {
        cart(id: $cartId) {
          id
          checkoutUrl
          totalQuantity
          note
          cost {
            subtotalAmount { amount currencyCode }
          }
          lines(first: 100) {
            edges {
              node {
                id
                quantity
                merchandise {
                  ... on ProductVariant {
                    id
                    product { id title handle featuredImage { url } }
                    title
                    price { amount currencyCode }
                    compareAtPrice { amount currencyCode }
                  }
                }
                cost { totalAmount { amount currencyCode } }
              }
            }
          }
        }
      }
    `,
    variables: { cartId },
  });
  return result?.cart ?? null;
}

export async function cartNoteUpdate(cartId: string, note: string) {
  const result = await shopifyFetch<{
    cartNoteUpdate: {
      cart: { checkoutUrl: string } | null;
      userErrors: Array<{ message: string }>;
    };
  }>({
    query: `
      mutation cartNoteUpdate($cartId: ID!, $note: String!) {
        cartNoteUpdate(cartId: $cartId, note: $note) {
          cart { checkoutUrl }
          userErrors { message }
        }
      }
    `,
    variables: { cartId, note },
  });
  const { cart, userErrors } = result.cartNoteUpdate;
  if (userErrors?.length) {
    throw new Error(userErrors[0].message);
  }
  return { checkoutUrl: cart?.checkoutUrl };
}

export async function cartLinesUpdate(
  cartId: string,
  lines: Array<{ id: string; quantity: number }>
) {
  const result = await shopifyFetch<{
    cartLinesUpdate: {
      cart: { checkoutUrl: string } | null;
      userErrors: Array<{ message: string }>;
    };
  }>({
    query: `
      mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
        cartLinesUpdate(cartId: $cartId, lines: $lines) {
          cart { checkoutUrl }
          userErrors { message }
        }
      }
    `,
    variables: { cartId, lines },
  });

  const { cart, userErrors } = result.cartLinesUpdate;
  if (userErrors?.length) {
    throw new Error(userErrors[0].message);
  }
  if (!cart?.checkoutUrl) {
    throw new Error("Failed to update cart");
  }
  return { checkoutUrl: cart.checkoutUrl };
}

export async function cartLinesRemove(cartId: string, lineIds: string[]) {
  const result = await shopifyFetch<{
    cartLinesRemove: {
      cart: { checkoutUrl: string } | null;
      userErrors: Array<{ message: string }>;
    };
  }>({
    query: `
      mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
        cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
          cart { checkoutUrl }
          userErrors { message }
        }
      }
    `,
    variables: { cartId, lineIds },
  });

  const { cart, userErrors } = result.cartLinesRemove;
  if (userErrors?.length) {
    throw new Error(userErrors[0].message);
  }
  return { checkoutUrl: cart?.checkoutUrl };
}

