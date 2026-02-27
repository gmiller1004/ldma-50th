import { GraphQLClient } from "graphql-request";

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

export type ShopifyProduct = {
  id: string;
  title: string;
  handle: string;
  variants: {
    edges: Array<{
      node: {
        id: string;
        price: {
          amount: string;
          currencyCode: string;
        };
      };
    }>;
  };
  featuredImage: {
    url: string;
    altText: string | null;
    width: number;
    height: number;
  } | null;
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
    variants(first: 1) {
      edges {
        node {
          id
          price {
            amount
            currencyCode
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

export async function createCartAndAddLine(variantId: string) {
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
      input: {
        lines: [{ merchandiseId: variantId, quantity: 1 }],
      },
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
    variables: {
      cartId,
      lines: [{ merchandiseId: variantId, quantity: 1 }],
    },
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
