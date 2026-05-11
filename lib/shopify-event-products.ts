/**
 * Resolve which Shopify products count as event registrations (same collection as storefront Events page).
 */

import { EVENT_COLLECTION_HANDLE } from "@/lib/events-config";
import { shopifyAdminGraphql } from "@/lib/shopify-admin-auth";

let cachedIds: { ids: Set<string>; expiresAt: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

/** Numeric product ids as strings (REST order line items use numeric ids). */
export async function getEventRegistrationProductIds(): Promise<Set<string>> {
  const now = Date.now();
  if (cachedIds && now < cachedIds.expiresAt) return cachedIds.ids;

  type Data = {
    collection: {
      products: {
        edges: Array<{ node: { legacyResourceId: string } }>;
      };
    } | null;
  };

  const result = await shopifyAdminGraphql<Data>(
    `#graphql
    query EventProductIds($handle: String!, $first: Int!) {
      collection(handle: $handle) {
        products(first: $first) {
          edges {
            node {
              legacyResourceId
            }
          }
        }
      }
    }`,
    { handle: EVENT_COLLECTION_HANDLE, first: 250 }
  );

  const ids = new Set<string>();
  const edges = result?.data?.collection?.products?.edges ?? [];
  for (const e of edges) {
    const id = e.node?.legacyResourceId;
    if (id) ids.add(String(id));
  }

  cachedIds = { ids, expiresAt: now + TTL_MS };
  return ids;
}

export function clearEventProductIdCache(): void {
  cachedIds = null;
}
