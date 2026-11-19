import { EVENT_COLLECTION_HANDLE } from "@/lib/events-config";
import { getCampLabel, getEventDates } from "@/lib/event-display";
import { sql, hasDb } from "@/lib/db";
import { shopifyAdminGraphql } from "@/lib/shopify-admin-auth";
import { sanitizeTrainerHtml, trainerPlainText } from "@/lib/trainers-sanitize";
import type { TrainerDetail, TrainerEventLink, TrainerProfile } from "@/lib/trainers-types";
import type { EventProduct } from "@/lib/shopify";
import type { TrainerUpdateInput, TrainerWriteInput } from "@/lib/trainers-validate";

export type { TrainerUpdateInput, TrainerWriteInput } from "@/lib/trainers-validate";
export { TrainerValidationError } from "@/lib/trainers-validate";

export class TrainerSlugConflictError extends Error {
  constructor() {
    super("A trainer with that URL slug already exists. Choose a different slug.");
    this.name = "TrainerSlugConflictError";
  }
}

export type TrainerEventOption = {
  productGid: string;
  title: string;
  handle: string;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const NEGATIVE_CACHE_MS = 60 * 1000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TrainerRow = {
  id: string;
  slug: string;
  name: string;
  title: string | null;
  summary: string | null;
  bodyHtml: string;
  photoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  websiteUrl: string | null;
  sortOrder: number;
  publishedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

function toIso(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function plainOrNull(value: string | null | undefined): string | null {
  const text = trainerPlainText(value);
  return text ? text : null;
}

function mapProfile(row: TrainerRow): TrainerProfile {
  return {
    id: String(row.id),
    slug: row.slug,
    name: trainerPlainText(row.name) || row.name,
    title: plainOrNull(row.title),
    summary: plainOrNull(row.summary),
    bodyHtml: sanitizeTrainerHtml(row.bodyHtml),
    photoUrl: emptyToNull(row.photoUrl),
    contact: {
      email: emptyToNull(row.contactEmail),
      phone: emptyToNull(row.contactPhone),
      websiteUrl: emptyToNull(row.websiteUrl),
    },
    sortOrder: Number(row.sortOrder) || 0,
    publishedAt: toIso(row.publishedAt),
    createdAt: toIso(row.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIso(row.updatedAt) ?? new Date(0).toISOString(),
  };
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code) : "";
  if (code === "23505") return true;
  const message = "message" in error ? String((error as { message?: unknown }).message) : "";
  return /trainers_slug_key|duplicate key value/i.test(message);
}

async function eventGidsFor(trainerId: string): Promise<string[]> {
  if (!sql) return [];
  const rows = (await sql`
    SELECT product_gid AS "productGid"
    FROM trainer_events
    WHERE trainer_id = ${trainerId}::uuid
    ORDER BY sort_order ASC, product_gid ASC
  `) as { productGid: string }[];
  return rows.map((row) => row.productGid);
}

type ShopifyMetafield = { namespace?: string | null; key?: string | null; value?: string | null } | null;

type ShopifyProductNode = {
  id?: string;
  title?: string;
  handle?: string;
  tags?: string[];
  featuredMedia?: {
    preview?: { image?: { url?: string | null } | null } | null;
  } | null;
  mfEventStart?: ShopifyMetafield;
  mfCustomStart?: ShopifyMetafield;
  mfEventEnd?: ShopifyMetafield;
  mfCustomEnd?: ShopifyMetafield;
};

type EventNodesData = { nodes: Array<ShopifyProductNode | null> };

const nodeCache = new Map<string, { expiresAt: number; link: TrainerEventLink }>();

function metafieldsFromNode(node: ShopifyProductNode): EventProduct["metafields"] {
  const fields = [node.mfEventStart, node.mfCustomStart, node.mfEventEnd, node.mfCustomEnd];
  const metafields: NonNullable<EventProduct["metafields"]> = [];
  for (const field of fields) {
    if (!field?.key || field.value == null || String(field.value).trim() === "") continue;
    metafields.push({
      namespace: field.namespace ?? undefined,
      key: field.key,
      value: String(field.value),
    });
  }
  return metafields;
}

function subtitleFor(node: ShopifyProductNode): string | null {
  const title = node.title ?? "";
  const handle = node.handle ?? "";
  const stub = {
    id: node.id ?? "",
    title,
    handle,
    tags: node.tags ?? [],
    metafields: metafieldsFromNode(node),
    featuredImage: null,
    variants: { edges: [] },
  } as EventProduct;
  const dateLine = getEventDates(stub).formatted;
  const camp = getCampLabel(stub);
  const parts = [dateLine, camp].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : null;
}

function linkFromNode(gid: string, node: ShopifyProductNode | null): TrainerEventLink {
  if (!node?.id || !node.title || !node.handle) {
    return { productGid: gid, title: null, handle: null, imageUrl: null, subtitle: null };
  }
  return {
    productGid: node.id,
    title: node.title,
    handle: node.handle,
    imageUrl: node.featuredMedia?.preview?.image?.url ?? null,
    subtitle: subtitleFor(node),
  };
}

async function fetchEventNodes(ids: string[]): Promise<Map<string, TrainerEventLink> | null> {
  const result = new Map<string, TrainerEventLink>();
  if (ids.length === 0) return result;

  const response = await shopifyAdminGraphql<EventNodesData>(
    `#graphql
    query TrainerEventNodes($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on Product {
          id
          title
          handle
          tags
          featuredMedia {
            preview {
              image {
                url
              }
            }
          }
          mfEventStart: metafield(namespace: "event", key: "start_date") { namespace key value }
          mfCustomStart: metafield(namespace: "custom", key: "start_date") { namespace key value }
          mfEventEnd: metafield(namespace: "event", key: "end_date") { namespace key value }
          mfCustomEnd: metafield(namespace: "custom", key: "end_date") { namespace key value }
        }
      }
    }`,
    { ids }
  );

  if (!response?.data?.nodes || response.errors) return null;

  const byId = new Map<string, ShopifyProductNode>();
  for (const node of response.data.nodes) {
    if (node?.id) byId.set(node.id, node);
  }
  for (const id of ids) {
    result.set(id, linkFromNode(id, byId.get(id) ?? null));
  }
  return result;
}

/** Resolve stored product GIDs to live Shopify event cards. Never throws. */
export async function resolveTrainerEvents(gids: string[]): Promise<TrainerEventLink[]> {
  const now = Date.now();
  const resolved = new Map<string, TrainerEventLink>();
  const missing: string[] = [];

  for (const gid of gids) {
    const cached = nodeCache.get(gid);
    if (cached && cached.expiresAt > now) resolved.set(gid, cached.link);
    else missing.push(gid);
  }

  if (missing.length > 0) {
    try {
      const fetched = await fetchEventNodes(missing);
      if (!fetched) {
        for (const gid of missing) {
          resolved.set(gid, {
            productGid: gid,
            title: null,
            handle: null,
            imageUrl: null,
            subtitle: null,
          });
        }
      } else {
        for (const [gid, link] of fetched) {
          nodeCache.set(gid, { link, expiresAt: now + CACHE_TTL_MS });
          resolved.set(gid, link);
        }
      }
    } catch (error) {
      console.error("[trainers] Shopify event lookup failed:", error);
      for (const gid of missing) {
        resolved.set(gid, {
          productGid: gid,
          title: null,
          handle: null,
          imageUrl: null,
          subtitle: null,
        });
      }
    }
  }

  return gids.map(
    (gid) =>
      resolved.get(gid) ?? {
        productGid: gid,
        title: null,
        handle: null,
        imageUrl: null,
        subtitle: null,
      }
  );
}

async function withEvents(profile: TrainerProfile): Promise<TrainerDetail> {
  try {
    const gids = await eventGidsFor(profile.id);
    const events = await resolveTrainerEvents(gids);
    return { ...profile, events };
  } catch (error) {
    console.error("[trainers] event load failed:", error);
    return { ...profile, events: [] };
  }
}

type DetailCacheEntry = { expiresAt: number; value: TrainerDetail | null };
const detailCache = new Map<string, DetailCacheEntry>();

function clearPublicCache(): void {
  detailCache.clear();
}

/** Published trainers only, ordered by sort order then name. Never throws. */
export async function getPublishedTrainers(): Promise<TrainerProfile[]> {
  try {
    if (!hasDb() || !sql) return [];
    const rows = (await sql`
      SELECT
        id, slug, name, title, summary,
        body_html AS "bodyHtml",
        photo_url AS "photoUrl",
        contact_email AS "contactEmail",
        contact_phone AS "contactPhone",
        website_url AS "websiteUrl",
        sort_order AS "sortOrder",
        published_at AS "publishedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM trainers
      WHERE published_at IS NOT NULL
      ORDER BY sort_order ASC, name ASC
    `) as TrainerRow[];
    return rows.map(mapProfile);
  } catch (error) {
    console.error("[trainers] getPublishedTrainers failed:", error);
    return [];
  }
}

/** Published trainer plus resolved events. Cached about 5 minutes. Never throws. */
export async function getTrainerBySlug(slug: string): Promise<TrainerDetail | null> {
  try {
    const key = slug.trim().toLowerCase();
    if (!key) return null;
    const now = Date.now();
    const cached = detailCache.get(key);
    if (cached && cached.expiresAt > now) return cached.value;

    if (!hasDb() || !sql) return null;
    const rows = (await sql`
      SELECT
        id, slug, name, title, summary,
        body_html AS "bodyHtml",
        photo_url AS "photoUrl",
        contact_email AS "contactEmail",
        contact_phone AS "contactPhone",
        website_url AS "websiteUrl",
        sort_order AS "sortOrder",
        published_at AS "publishedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM trainers
      WHERE slug = ${key}
        AND published_at IS NOT NULL
      LIMIT 1
    `) as TrainerRow[];
    const row = rows[0];
    if (!row) {
      detailCache.set(key, { value: null, expiresAt: now + NEGATIVE_CACHE_MS });
      return null;
    }
    const detail = await withEvents(mapProfile(row));
    const shopifyMiss =
      detail.events.length > 0 && detail.events.every((event) => event.title == null && event.handle == null);
    detailCache.set(key, {
      value: detail,
      expiresAt: now + (shopifyMiss ? NEGATIVE_CACHE_MS : CACHE_TTL_MS),
    });
    return detail;
  } catch (error) {
    console.error("[trainers] getTrainerBySlug failed:", error);
    return null;
  }
}

/** All trainers, including drafts. Ordered like the public directory. */
export async function listTrainers(): Promise<TrainerProfile[]> {
  if (!hasDb() || !sql) return [];
  const rows = (await sql`
    SELECT
      id, slug, name, title, summary,
      body_html AS "bodyHtml",
      photo_url AS "photoUrl",
      contact_email AS "contactEmail",
      contact_phone AS "contactPhone",
      website_url AS "websiteUrl",
      sort_order AS "sortOrder",
      published_at AS "publishedAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM trainers
    ORDER BY sort_order ASC, name ASC
  `) as TrainerRow[];
  return rows.map(mapProfile);
}

async function profileById(id: string): Promise<TrainerProfile | null> {
  if (!hasDb() || !sql) return null;
  if (!UUID_RE.test(id)) return null;
  const rows = (await sql`
    SELECT
      id, slug, name, title, summary,
      body_html AS "bodyHtml",
      photo_url AS "photoUrl",
      contact_email AS "contactEmail",
      contact_phone AS "contactPhone",
      website_url AS "websiteUrl",
      sort_order AS "sortOrder",
      published_at AS "publishedAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM trainers
    WHERE id = ${id}::uuid
    LIMIT 1
  `) as TrainerRow[];
  const row = rows[0];
  return row ? mapProfile(row) : null;
}

export async function getTrainerById(id: string): Promise<TrainerDetail | null> {
  const profile = await profileById(id);
  if (!profile) return null;
  return withEvents(profile);
}

export async function createTrainer(input: TrainerWriteInput): Promise<TrainerDetail | null> {
  if (!hasDb() || !sql) return null;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const name = trainerPlainText(input.name) || input.name;
  const title = plainOrNull(input.title);
  const summary = plainOrNull(input.summary);
  const bodyHtml = sanitizeTrainerHtml(input.bodyHtml);
  try {
    await sql.transaction((tx) => [
      tx`
        INSERT INTO trainers (
          id, slug, name, title, summary, body_html, photo_url,
          contact_email, contact_phone, website_url,
          sort_order, published_at, created_at, updated_at
        )
        VALUES (
          ${id}::uuid,
          ${input.slug},
          ${name},
          ${title},
          ${summary},
          ${bodyHtml},
          ${input.photoUrl},
          ${input.contactEmail},
          ${input.contactPhone},
          ${input.websiteUrl},
          ${input.sortOrder},
          ${input.publishedAt},
          ${now}::timestamptz,
          ${now}::timestamptz
        )
      `,
      ...input.eventProductGids.map(
        (gid, index) =>
          tx`INSERT INTO trainer_events (trainer_id, product_gid, sort_order) VALUES (${id}::uuid, ${gid}, ${index})`
      ),
    ]);
  } catch (error) {
    if (isUniqueViolation(error)) throw new TrainerSlugConflictError();
    throw error;
  }
  clearPublicCache();
  return getTrainerById(id);
}

export async function updateTrainer(id: string, input: TrainerUpdateInput): Promise<TrainerDetail | null> {
  if (!hasDb() || !sql) return null;
  if (!UUID_RE.test(id)) return null;
  const current = await profileById(id);
  if (!current) return null;

  const slug = input.slug ?? current.slug;
  const name = trainerPlainText(input.name ?? current.name) || current.name;
  const title = plainOrNull(input.title !== undefined ? input.title : current.title);
  const summary = plainOrNull(input.summary !== undefined ? input.summary : current.summary);
  const bodyHtml = sanitizeTrainerHtml(input.bodyHtml !== undefined ? input.bodyHtml : current.bodyHtml);
  const photoUrl = input.photoUrl !== undefined ? input.photoUrl : current.photoUrl;
  const contactEmail = input.contactEmail !== undefined ? input.contactEmail : current.contact.email;
  const contactPhone = input.contactPhone !== undefined ? input.contactPhone : current.contact.phone;
  const websiteUrl = input.websiteUrl !== undefined ? input.websiteUrl : current.contact.websiteUrl;
  const sortOrder = input.sortOrder !== undefined ? input.sortOrder : current.sortOrder;
  const publishedAt = input.publishedAt !== undefined ? input.publishedAt : current.publishedAt;
  const now = new Date().toISOString();

  const eventGids = input.eventProductGids;
  try {
    await sql.transaction((tx) => [
      tx`
        UPDATE trainers SET
          slug = ${slug},
          name = ${name},
          title = ${title},
          summary = ${summary},
          body_html = ${bodyHtml},
          photo_url = ${photoUrl},
          contact_email = ${contactEmail},
          contact_phone = ${contactPhone},
          website_url = ${websiteUrl},
          sort_order = ${sortOrder},
          published_at = ${publishedAt},
          updated_at = ${now}::timestamptz
        WHERE id = ${id}::uuid
      `,
      ...(eventGids !== undefined
        ? [
            tx`DELETE FROM trainer_events WHERE trainer_id = ${id}::uuid`,
            ...eventGids.map(
              (gid, index) =>
                tx`INSERT INTO trainer_events (trainer_id, product_gid, sort_order) VALUES (${id}::uuid, ${gid}, ${index})`
            ),
          ]
        : []),
    ]);
  } catch (error) {
    if (isUniqueViolation(error)) throw new TrainerSlugConflictError();
    throw error;
  }

  clearPublicCache();
  return getTrainerById(id);
}

export async function deleteTrainer(id: string): Promise<boolean> {
  if (!hasDb() || !sql) return false;
  if (!UUID_RE.test(id)) return false;
  const rows = (await sql`
    DELETE FROM trainers WHERE id = ${id}::uuid RETURNING id
  `) as { id: string }[];
  clearPublicCache();
  return rows.length > 0;
}

type EventOptionNode = { id?: string; title?: string; handle?: string; status?: string };
type EventOptionsData = {
  collectionByHandle: {
    products: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      edges: Array<{ node: EventOptionNode }>;
    };
  } | null;
};

let cachedOptions: { expiresAt: number; options: TrainerEventOption[] } | null = null;

/** Products in the Shopify Events collection, for the admin picker. Never throws. */
export async function getEventOptions(): Promise<TrainerEventOption[]> {
  const now = Date.now();
  if (cachedOptions && cachedOptions.expiresAt > now) return cachedOptions.options;

  const options: TrainerEventOption[] = [];
  try {
    let cursor: string | null = null;
    for (let page = 0; page < 40; page++) {
      const variables: Record<string, unknown> = {
        handle: EVENT_COLLECTION_HANDLE,
        first: 100,
      };
      if (cursor) variables.after = cursor;

      const response = await shopifyAdminGraphql<EventOptionsData>(
        `#graphql
        query TrainerEventOptions($handle: String!, $first: Int!, $after: String) {
          collectionByHandle(handle: $handle) {
            products(first: $first, after: $after) {
              pageInfo { hasNextPage endCursor }
              edges {
                node { id title handle status }
              }
            }
          }
        }`,
        variables
      );

      const collection = response?.data?.collectionByHandle;
      if (!collection) break;
      for (const edge of collection.products?.edges ?? []) {
        const node = edge.node;
        if (!node?.id || !node.title || !node.handle) continue;
        if (node.status === "ARCHIVED") continue;
        options.push({ productGid: node.id, title: node.title, handle: node.handle });
      }
      const pageInfo = collection.products?.pageInfo;
      if (pageInfo?.hasNextPage && pageInfo.endCursor) cursor = pageInfo.endCursor;
      else break;
    }
  } catch (error) {
    console.error("[trainers] getEventOptions failed:", error);
  }

  options.sort((a, b) => a.title.localeCompare(b.title, "en"));
  cachedOptions = {
    options,
    expiresAt: now + (options.length > 0 ? CACHE_TTL_MS : NEGATIVE_CACHE_MS),
  };
  return options;
}
