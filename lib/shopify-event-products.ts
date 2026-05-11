/**
 * Resolve which Shopify products count as event registrations (same collection as storefront Events page).
 * Paginates the entire `events` collection — Admin GraphQL returns max 250 products per page.
 */

import { EVENT_COLLECTION_HANDLE } from "@/lib/events-config";
import { shopifyAdminGraphql } from "@/lib/shopify-admin-auth";

type EventProductNode = { id?: string; legacyResourceId?: string | number | null };
type EventProductIdsData = {
  collection: {
    products: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      edges: Array<{ node: EventProductNode }>;
    };
  } | null;
};

type EventProductIdsGqlResponse = { data?: EventProductIdsData; errors?: unknown } | null;

type EventCollectionNode = NonNullable<EventProductIdsData["collection"]>;
type EventProductsPageInfo = EventCollectionNode["products"]["pageInfo"];

let cachedIds: { ids: Set<string>; expiresAt: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

function productNumericId(node: EventProductNode): string | null {
  const lr = node.legacyResourceId;
  if (lr != null) {
    const s = String(lr).trim();
    if (s.length > 0) return s;
  }
  const gid = node.id;
  if (!gid || typeof gid !== "string") return null;
  const m = gid.trim().match(/\/Product\/(\d+)/);
  return m ? m[1] : null;
}

/** Numeric product ids as strings (REST order line items use numeric ids). */
export async function getEventRegistrationProductIds(): Promise<Set<string>> {
  const now = Date.now();
  if (cachedIds && now < cachedIds.expiresAt) return cachedIds.ids;

  const ids = new Set<string>();
  let cursor: string | null = null;
  const maxPages = 40; // 40 * 250 = 10k products safety cap

  for (let pages = 0; pages < maxPages; pages++) {
    const gqlResponse: EventProductIdsGqlResponse = await shopifyAdminGraphql<EventProductIdsData>(
      `#graphql
      query EventProductIds($handle: String!, $first: Int!, $after: String) {
        collection(handle: $handle) {
          products(first: $first, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                id
                legacyResourceId
              }
            }
          }
        }
      }`,
      {
        handle: EVENT_COLLECTION_HANDLE,
        first: 250,
        after: cursor,
      }
    );

    const collection: EventProductIdsData["collection"] =
      gqlResponse?.data?.collection ?? null;
    if (!collection) {
      if (gqlResponse && "errors" in gqlResponse && gqlResponse.errors) {
        console.error("[shopify-event-products] GraphQL errors:", gqlResponse.errors);
      } else {
        console.error(
          "[shopify-event-products] No collection for handle:",
          EVENT_COLLECTION_HANDLE
        );
      }
      break;
    }

    const edges = collection.products?.edges ?? [];
    for (const e of edges) {
      const id = productNumericId(e.node);
      if (id) ids.add(id);
    }

    const pageInfo: EventProductsPageInfo | undefined = collection.products?.pageInfo;
    if (pageInfo?.hasNextPage && pageInfo.endCursor) {
      cursor = pageInfo.endCursor;
    } else {
      break;
    }
  }

  // Never cache an empty set: a failed or partial GraphQL response would block
  // all line items for TTL_MS; callers can retry on the next request.
  if (ids.size > 0) {
    cachedIds = { ids, expiresAt: now + TTL_MS };
  } else {
    cachedIds = null;
  }
  return ids;
}

export function clearEventProductIdCache(): void {
  cachedIds = null;
}
