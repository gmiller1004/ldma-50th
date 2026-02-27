import { getEventProducts } from "@/lib/shopify";
import { shopifyFetch } from "@/lib/shopify";
import { EVENT_COLLECTION_HANDLE } from "@/lib/events-config";

/** Debug endpoint: verify events collection and products. GET /api/test-events or /api/test-events?view=html */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const viewHtml = searchParams.get("view") === "html";
  const domain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
  const token = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN;

  if (!domain || !token) {
    return Response.json(
      {
        ok: false,
        error: "Missing Shopify env vars",
      },
      { status: 500 }
    );
  }

  const collectionChecks: Record<
    string,
    { found: boolean; productCount: number; error?: string }
  > = {};

  for (const handle of [EVENT_COLLECTION_HANDLE, "dirtfest", "detector-events"]) {
    try {
      const result = await shopifyFetch<{
        collection: {
          id: string;
          title: string;
          handle: string;
          products: { edges: Array<{ node: { id: string; title: string } }> };
        } | null;
      }>({
        query: `
          query GetCollection($handle: String!) {
            collection(handle: $handle) {
              id
              title
              handle
              products(first: 50) {
                edges {
                  node { id title handle }
                }
              }
            }
          }
        `,
        variables: { handle },
      });

      if (result?.collection) {
        collectionChecks[handle] = {
          found: true,
          productCount: result.collection.products.edges.length,
        };
      } else {
        collectionChecks[handle] = { found: false, productCount: 0 };
      }
    } catch (e) {
      collectionChecks[handle] = {
        found: false,
        productCount: 0,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  let eventProducts: Awaited<ReturnType<typeof getEventProducts>> = [];
  let eventProductsError: string | null = null;

  try {
    eventProducts = await getEventProducts();
  } catch (e) {
    eventProductsError = e instanceof Error ? e.message : String(e);
  }

  const data = {
    ok: true,
    store: domain,
    collectionChecks,
    eventProductsCount: eventProducts.length,
    eventProducts: eventProducts.map((p) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      tags: p.tags,
      hasVariant: !!(p.variants?.edges?.[0]?.node),
    })),
    eventProductsError,
  };

  if (viewHtml) {
    const html = `<!DOCTYPE html>
<html>
<head><title>Events Test</title><meta charset="utf-8"><style>
  body{font-family:system-ui;max-width:900px;margin:2rem auto;padding:0 1rem;background:#1a120b;color:#e8e0d5;}
  h1{color:#d4af37;} h2{color:#f0d48f;margin-top:2rem;}
  table{border-collapse:collapse;width:100%;} th,td{border:1px solid #d4af37/30;padding:0.5rem 0.75rem;text-align:left;}
  th{background:#d4af37/20;color:#d4af37;} .ok{color:#4ade80;} .err{color:#f87171;}
  .tags{font-size:0.9em;} .empty{color:#78716c;}
  a{color:#d4af37;} pre{overflow-x:auto;background:#0f0d0a;padding:1rem;border-radius:6px;}
</style></head>
<body>
  <h1>Events Test</h1>
  <p>Store: <strong>${domain}</strong></p>
  <h2>Collections</h2>
  <table>
    <tr><th>Handle</th><th>Found</th><th>Products</th><th>Error</th></tr>
    ${Object.entries(collectionChecks).map(([h, c]) => `
    <tr>
      <td><code>${h}</code></td>
      <td class="${c.found ? "ok" : "err"}">${c.found ? "Yes" : "No"}</td>
      <td>${c.productCount}</td>
      <td>${c.error ?? "—"}</td>
    </tr>`).join("")}
  </table>
  <h2>Event Products (${eventProducts.length})</h2>
  ${eventProductsError ? `<p class="err">Error: ${eventProductsError}</p>` : ""}
  <table>
    <tr><th>Title</th><th>Tags</th><th>Has variant</th></tr>
    ${eventProducts.map((p) => `
    <tr>
      <td>${p.title}</td>
      <td class="tags ${p.tags?.length ? "ok" : "empty"}">${p.tags?.length ? p.tags.join(", ") : "(none)"}</td>
      <td>${p.variants?.edges?.[0]?.node ? "Yes" : "No"}</td>
    </tr>`).join("")}
  </table>
  ${eventProducts.length === 0 && !eventProductsError ? '<p class="err">No event products. Add products to the &quot;events&quot; collection.</p>' : ""}
  <p style="margin-top:2rem;"><a href="?view=json">View raw JSON</a></p>
</body>
</html>`;
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return Response.json(data);
}
