import { getFeaturedProducts } from "@/lib/shopify";
import { shopifyFetch } from "@/lib/shopify";

export async function GET() {
  const domain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
  const token = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN;

  if (!domain || !token) {
    return Response.json(
      {
        ok: false,
        error: "Missing Shopify env vars (NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN or NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN)",
      },
      { status: 500 }
    );
  }

  const collectionHandles = [
    "50th-anniversary",
    "50th anniversary",
    "membership",
    "dirtfest",
    "merch",
    "all",
  ];

  const collectionResults: Record<string, { found: boolean; productCount: number }> = {};

  for (const handle of collectionHandles) {
    try {
      const result = await shopifyFetch<{
        collection: {
          id: string;
          title: string;
          products: { edges: unknown[] };
        } | null;
      }>({
        query: `
          query GetCollection($handle: String!) {
            collection(handle: $handle) {
              id
              title
              products(first: 10) {
                edges {
                  node { id title }
                }
              }
            }
          }
        `,
        variables: { handle },
      });

      if (result?.collection) {
        collectionResults[handle] = {
          found: true,
          productCount: result.collection.products.edges.length,
        };
      } else {
        collectionResults[handle] = { found: false, productCount: 0 };
      }
    } catch (e) {
      collectionResults[handle] = {
        found: false,
        productCount: 0,
      };
    }
  }

  let products: Awaited<ReturnType<typeof getFeaturedProducts>> = [];
  let productsError: string | null = null;

  try {
    products = await getFeaturedProducts(4);
  } catch (e) {
    productsError = e instanceof Error ? e.message : String(e);
  }

  return Response.json({
    ok: true,
    store: domain,
    collectionCheck: collectionResults,
    productsReturned: products.length,
    products: products.map((p) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      hasImage: !!p.featuredImage,
      price: p.variants?.edges?.[0]?.node?.price,
    })),
    error: productsError,
  });
}
