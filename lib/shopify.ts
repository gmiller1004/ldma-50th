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
  metafields?: Array<{ key: string; value: string }>;
  featuredImage: EventProductImage | null;
  images?: {
    edges: Array<{ node: EventProductImage }>;
  };
  options?: EventProductOption[];
  variants: {
    edges: Array<{ node: EventVariant }>;
  };
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
      { namespace: "event", key: "end_date" }
    ]) {
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

export async function createCartAndAddLine(variantId: string) {
  return createCartAndAddLines([variantId]);
}

export async function createCartAndAddLines(variantIds: string[]) {
  const lines = variantIds.map((id) => ({ merchandiseId: id, quantity: 1 }));
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
      input: { lines },
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

export async function addLineToExistingCart(cartId: string, variantId: string) {
  return addLinesToExistingCart(cartId, [variantId]);
}

export async function addLinesToExistingCart(
  cartId: string,
  variantIds: string[]
) {
  const lines = variantIds.map((id) => ({ merchandiseId: id, quantity: 1 }));
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
    variables: { cartId, lines },
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
                    product { title handle featuredImage { url } }
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

