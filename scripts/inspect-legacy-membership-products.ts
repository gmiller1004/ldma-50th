/**
 * Read-only: list Shopify products (any status) for Family Legacy add-ons and LDMA memberships,
 * and count orders since the offer began that include them.
 *
 *   npx tsx --env-file=.env.local scripts/inspect-legacy-membership-products.ts [sinceIsoDate]
 */
import { shopifyAdminGraphql } from "@/lib/shopify-admin-auth";

type ProductNode = { id: string; title: string; handle: string; status: string; productType: string; createdAt: string };
type ProductPage = {
  products: { edges: { node: ProductNode }[]; pageInfo: { hasNextPage: boolean; endCursor: string } };
};

async function products(query: string): Promise<ProductNode[]> {
  const out: ProductNode[] = [];
  let after: string | null = null;
  for (;;) {
    const res: { data?: ProductPage; errors?: unknown } | null = await shopifyAdminGraphql<ProductPage>(
      `query($q: String!, $after: String) {
        products(first: 100, query: $q, after: $after) {
          edges { node { id title handle status productType createdAt } }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { q: query, after }
    );
    if (!res?.data) throw new Error(`Shopify query failed: ${JSON.stringify(res?.errors ?? "no response")}`);
    out.push(...res.data.products.edges.map((e) => e.node));
    if (!res.data.products.pageInfo.hasNextPage) break;
    after = res.data.products.pageInfo.endCursor;
  }
  return out;
}

async function main() {
  const since = process.argv[2] ?? "2026-07-01";
  const legacy = await products("title:*legacy*");
  console.log(`Products with "legacy" in the title: ${legacy.length}`);
  for (const p of legacy) console.log(`  ${p.id.split("/").pop()} · ${p.status} · ${p.title} (${p.handle})`);

  const membershipCollection = await shopifyAdminGraphql<{
    collectionByHandle: { products: { edges: { node: ProductNode }[] } } | null;
  }>(
    `{ collectionByHandle(handle: "membership") { products(first: 100) { edges { node { id title handle status productType createdAt } } } } }`
  );
  const inCollection = membershipCollection?.data?.collectionByHandle?.products.edges.map((e) => e.node) ?? [];
  const ldma = await products("title:*LDMA*");
  const byId = new Map<string, ProductNode>();
  for (const p of [...inCollection, ...ldma]) byId.set(p.id, p);
  console.log(`\nMembership collection + "LDMA" titled products: ${byId.size}`);
  for (const p of [...byId.values()].sort((a, b) => a.title.localeCompare(b.title))) {
    console.log(`  ${p.id.split("/").pop()} · ${p.status} · ${p.productType || "-"} · ${p.title} (${p.handle})`);
  }

  const res = await shopifyAdminGraphql<{
    orders: { edges: { node: { lineItems: { edges: { node: { title: string; product: { id: string } | null } }[] } } }[]; pageInfo: { hasNextPage: boolean; endCursor: string } };
  }>(
    `query($q: String!) {
      orders(first: 250, query: $q) {
        edges { node { lineItems(first: 50) { edges { node { title product { id } } } } } }
        pageInfo { hasNextPage endCursor }
      }
    }`,
    { q: `created_at:>='${since}'` }
  );
  if (!res?.data) {
    console.log(`\nOrders query unavailable: ${JSON.stringify(res?.errors ?? "no response").slice(0, 300)}`);
    return;
  }
  const counts = new Map<string, number>();
  let pages = 1;
  let page = res.data.orders;
  for (;;) {
    for (const o of page.edges) {
      const titles = new Set(o.node.lineItems.edges.map((li) => li.node.title));
      for (const t of titles) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    if (!page.pageInfo.hasNextPage || pages >= 40) break;
    const next = await shopifyAdminGraphql<typeof res.data>(
      `query($q: String!, $after: String) {
        orders(first: 250, query: $q, after: $after) {
          edges { node { lineItems(first: 50) { edges { node { title product { id } } } } } }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { q: `created_at:>='${since}'`, after: page.pageInfo.endCursor }
    );
    if (!next?.data) break;
    page = next.data.orders;
    pages++;
  }
  console.log(`\nOrders since ${since} by line-item title (legacy / membership / LDMA only):`);
  for (const [t, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    if (/legacy|membership|ldma|lifetime|bundle|companion|transfer/i.test(t)) console.log(`  ${n} · ${t}`);
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
