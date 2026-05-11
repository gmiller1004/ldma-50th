/**
 * Resolve which Shopify products count as event registrations (same collection as storefront Events page).
 * Uses Admin GraphQL `collectionByHandle` (the `collection` query is id-only). Paginates with cursors (250/page).
 */

import { EVENT_COLLECTION_HANDLE } from "@/lib/events-config";
import { shopifyAdminGraphql } from "@/lib/shopify-admin-auth";

type EventProductNode = { id?: string; legacyResourceId?: string | number | null };
type EventProductIdsData = {
  /** Admin `collection` is id-only; use `collectionByHandle` for the storefront handle. */
  collectionByHandle: {
    products: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      edges: Array<{ node: EventProductNode }>;
    };
  } | null;
};

type EventProductIdsGqlResponse = { data?: EventProductIdsData; errors?: unknown } | null;

type EventCollectionNode = NonNullable<EventProductIdsData["collectionByHandle"]>;
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
    const variables: Record<string, unknown> = {
      handle: EVENT_COLLECTION_HANDLE,
      first: 250,
    };
    if (cursor) variables.after = cursor;

    const gqlResponse: EventProductIdsGqlResponse = await shopifyAdminGraphql<EventProductIdsData>(
      `#graphql
      query EventProductIds($handle: String!, $first: Int!, $after: String) {
        collectionByHandle(handle: $handle) {
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
      variables
    );

    const collection: EventProductIdsData["collectionByHandle"] =
      gqlResponse?.data?.collectionByHandle ?? null;
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

  // Never cache an empty set at full TTL: a failed GraphQL response would block
  // all line items for TTL_MS. Short negative cache avoids hammering Shopify
  // while still allowing retry after transient failures.
  const NEGATIVE_CACHE_MS = 60_000;
  if (ids.size > 0) {
    cachedIds = { ids, expiresAt: now + TTL_MS };
  } else {
    cachedIds = { ids: new Set(), expiresAt: now + NEGATIVE_CACHE_MS };
  }
  return ids;
}

export function clearEventProductIdCache(): void {
  cachedIds = null;
}
