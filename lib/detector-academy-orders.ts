/**
 * Shopify order lookup for the Garrett Detector Academy reservation (Axiom Lite bundle buyers).
 */

import { shopifyAdminGraphql } from "@/lib/shopify-admin-auth";
import { academyReservationStatus, type AcademyReservationStatus, type ShopifyOrderSummary } from "@/lib/detector-academy";

type OrdersPage = {
  orders: {
    nodes: {
      createdAt: string;
      cancelledAt: string | null;
      displayFinancialStatus: string | null;
      lineItems: { nodes: { product: { id: string } | null; variant: { id: string } | null }[] };
    }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

const ORDERS_QUERY = `query GarrettAcademyOrders($q: String!, $after: String) {
  orders(first: 50, query: $q, after: $after, sortKey: CREATED_AT, reverse: true) {
    nodes {
      createdAt
      cancelledAt
      displayFinancialStatus
      lineItems(first: 50) { nodes { product { id } variant { id } } }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

const numericId = (gid: string) => gid.split("/").pop() ?? gid;

export async function shopifyOrdersForEmail(email: string): Promise<ShopifyOrderSummary[] | null> {
  const q = `email:"${email.replace(/"/g, "")}"`;
  const out: ShopifyOrderSummary[] = [];
  let after: string | null = null;
  for (let page = 0; page < 10; page++) {
    const res: { data?: OrdersPage; errors?: unknown } | null = await shopifyAdminGraphql<OrdersPage>(ORDERS_QUERY, {
      q,
      after,
    });
    if (!res?.data) {
      console.error("[garrett-academy] order lookup failed:", JSON.stringify(res?.errors ?? "no response").slice(0, 300));
      return null;
    }
    for (const o of res.data.orders.nodes) {
      out.push({
        createdAt: o.createdAt,
        cancelled: Boolean(o.cancelledAt),
        financialStatus: o.displayFinancialStatus,
        productIds: o.lineItems.nodes.map((li) => (li.product ? numericId(li.product.id) : "")).filter(Boolean),
        variantIds: o.lineItems.nodes.map((li) => (li.variant ? numericId(li.variant.id) : "")).filter(Boolean),
      });
    }
    if (!res.data.orders.pageInfo.hasNextPage) break;
    after = res.data.orders.pageInfo.endCursor;
  }
  return out;
}

/** null when Shopify could not be reached. */
export async function academyReservationStatusForEmail(email: string): Promise<AcademyReservationStatus | null> {
  const orders = await shopifyOrdersForEmail(email);
  return orders ? academyReservationStatus(orders) : null;
}
