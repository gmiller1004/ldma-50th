/**
 * Read-only: order counts and buyer counts for Family Legacy products (all time), plus details for
 * membership-like line items since the offer began (product handle, price, sample order dates).
 *
 *   npx tsx --env-file=.env.local scripts/inspect-legacy-order-counts.ts [sinceIsoDate]
 */
import { shopifyAdminGraphql } from "@/lib/shopify-admin-auth";

type LineItem = { title: string; variantTitle: string | null; product: { handle: string; title: string } | null; originalUnitPriceSet: { shopMoney: { amount: string } } };
type OrderNode = { name: string; createdAt: string; email: string | null; cancelledAt: string | null; lineItems: { edges: { node: LineItem }[] } };
type OrderPage = { orders: { edges: { node: OrderNode }[]; pageInfo: { hasNextPage: boolean; endCursor: string } } };

const QUERY = `query($q: String!, $after: String) {
  orders(first: 250, query: $q, after: $after) {
    edges { node { name createdAt email cancelledAt lineItems(first: 50) { edges { node { title variantTitle originalUnitPriceSet { shopMoney { amount } } product { handle title } } } } } }
    pageInfo { hasNextPage endCursor }
  }
}`;

async function allOrders(q: string): Promise<OrderNode[]> {
  const out: OrderNode[] = [];
  let after: string | null = null;
  for (let i = 0; i < 200; i++) {
    const res: { data?: OrderPage; errors?: unknown } | null = await shopifyAdminGraphql<OrderPage>(QUERY, { q, after });
    if (!res?.data) throw new Error(`orders query failed: ${JSON.stringify(res?.errors ?? "no response").slice(0, 300)}`);
    out.push(...res.data.orders.edges.map((e) => e.node));
    if (!res.data.orders.pageInfo.hasNextPage) break;
    after = res.data.orders.pageInfo.endCursor;
  }
  return out;
}

async function main() {
  const since = process.argv[2] ?? "2026-07-01";

  for (const handle of ["legacy-complete-package", "complete-family-legacy-add-on-special-offer"]) {
    const prod = await shopifyAdminGraphql<{ productByHandle: { id: string; title: string } | null }>(
      `query($h: String!) { productByHandle(handle: $h) { id title } }`,
      { h: handle }
    );
    const id = prod?.data?.productByHandle?.id.split("/").pop();
    if (!id) {
      console.log(`${handle}: product not found`);
      continue;
    }
    const orders = await allOrders(`product_id:${id}`);
    const live = orders.filter((o) => !o.cancelledAt);
    const emails = new Set(live.map((o) => (o.email ?? "").toLowerCase()).filter(Boolean));
    const dates = live.map((o) => o.createdAt.slice(0, 10)).sort();
    console.log(`${prod?.data?.productByHandle?.title} (${id}): ${live.length} orders (${orders.length - live.length} cancelled), ${emails.size} unique buyer emails, first ${dates[0] ?? "-"}, last ${dates[dates.length - 1] ?? "-"}`);
  }

  const recent = await allOrders(`created_at:>='${since}'`);
  console.log(`\nOrders since ${since}: ${recent.length}`);
  const stats = new Map<string, { n: number; prices: Set<string>; handles: Set<string>; first: string; last: string }>();
  for (const o of recent) {
    if (o.cancelledAt) continue;
    for (const { node: li } of o.lineItems.edges) {
      if (!/ldma|legacy|lifetime|membership|companion|transfer/i.test(li.title)) continue;
      if (/tee|shirt|hood|tank|mug|patch|sluice|party/i.test(li.title)) continue;
      const s = stats.get(li.title) ?? { n: 0, prices: new Set(), handles: new Set(), first: o.createdAt, last: o.createdAt };
      s.n++;
      s.prices.add(li.originalUnitPriceSet.shopMoney.amount);
      s.handles.add(li.product?.handle ?? "(deleted product)");
      if (o.createdAt < s.first) s.first = o.createdAt;
      if (o.createdAt > s.last) s.last = o.createdAt;
      stats.set(li.title, s);
    }
  }
  for (const [title, s] of [...stats.entries()].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`  ${s.n} · ${title} · handle ${[...s.handles].join("/")} · prices ${[...s.prices].slice(0, 6).join(", ")} · ${s.first.slice(0, 10)}..${s.last.slice(0, 10)}`);
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
