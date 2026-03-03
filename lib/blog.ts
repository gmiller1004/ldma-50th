import { sql, hasDb } from "./db";

/** Decode common HTML/XML entities so titles and excerpts display correctly (e.g. &apos; → ') */
export function decodeHtmlEntities(str: string | null | undefined): string {
  if (str == null || typeof str !== "string") return "";
  return str
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function withDecodedTextFields(post: BlogPost): BlogPost {
  return {
    ...post,
    title: decodeHtmlEntities(post.title),
    excerpt: post.excerpt ? decodeHtmlEntities(post.excerpt) : post.excerpt,
  };
}

export type BlogCategory = {
  id: string;
  label: string;
  sortOrder: number;
};

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  categoryId: string;
  categoryLabel?: string;
  featuredImageUrl: string | null;
  authorContactId: string | null;
  authorDisplayName: string | null;
  publishedAt: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export async function getCategories(): Promise<BlogCategory[]> {
  if (!hasDb() || !sql) return [];
  const rows = await sql`
    SELECT id, label, sort_order AS "sortOrder"
    FROM blog_categories
    ORDER BY sort_order ASC
  `;
  return rows as BlogCategory[];
}

/** Slug for URL: lowercase, spaces to hyphens, strip non-alphanumeric/hyphen */
export function slugifyTag(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "tag";
}

export async function getPosts(options: {
  categoryId?: string;
  tagSlug?: string;
  publishedOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<BlogPost[]> {
  const { categoryId, tagSlug, publishedOnly = true, limit = 50, offset = 0 } = options;
  if (!hasDb() || !sql) return [];

  const categoryFilter = categoryId ? sql`AND p.category_id = ${categoryId}` : sql``;
  const publishedFilter = publishedOnly
    ? sql`AND p.published_at IS NOT NULL`
    : sql``;
  const normalizedTagSlug = tagSlug?.trim().toLowerCase().replace(/-+/g, "-").replace(/^-|-$/g, "") || "";
  const tagFilter =
    normalizedTagSlug
      ? sql`AND EXISTS (
          SELECT 1 FROM unnest(COALESCE(p.tags, ARRAY[]::TEXT[])) AS t
          WHERE trim(both '-' from regexp_replace(regexp_replace(regexp_replace(lower(trim(t)), '\s+', '-', 'g'), '[^a-z0-9-]', '', 'gi'), '-+', '-', 'g')) = ${normalizedTagSlug}
        )`
      : sql``;

  const rows = await sql`
    SELECT
      p.id, p.slug, p.title, p.excerpt, p.body, p.category_id AS "categoryId",
      c.label AS "categoryLabel",
      p.featured_image_url AS "featuredImageUrl",
      p.author_contact_id AS "authorContactId",
      p.author_display_name AS "authorDisplayName",
      p.published_at AS "publishedAt",
      COALESCE(p.tags, ARRAY[]::TEXT[]) AS tags,
      p.created_at AS "createdAt",
      p.updated_at AS "updatedAt"
    FROM blog_posts p
    JOIN blog_categories c ON c.id = p.category_id
    WHERE 1=1 ${categoryFilter} ${publishedFilter} ${tagFilter}
    ORDER BY COALESCE(p.published_at, p.updated_at) DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;
  return (rows as BlogPost[]).map(withDecodedTextFields);
}

export async function getPostBySlug(
  slug: string,
  options: { publishedOnly?: boolean } = {}
): Promise<BlogPost | null> {
  const { publishedOnly = true } = options;
  if (!hasDb() || !sql) return null;

  const publishedFilter = publishedOnly
    ? sql`AND published_at IS NOT NULL`
    : sql``;

  const rows = (await sql`
    SELECT
      p.id, p.slug, p.title, p.excerpt, p.body, p.category_id AS "categoryId",
      c.label AS "categoryLabel",
      p.featured_image_url AS "featuredImageUrl",
      p.author_contact_id AS "authorContactId",
      p.author_display_name AS "authorDisplayName",
      p.published_at AS "publishedAt",
      COALESCE(p.tags, ARRAY[]::TEXT[]) AS tags,
      p.created_at AS "createdAt",
      p.updated_at AS "updatedAt"
    FROM blog_posts p
    JOIN blog_categories c ON c.id = p.category_id
    WHERE p.slug = ${slug} ${publishedFilter}
    LIMIT 1
  `) as BlogPost[];
  const row = rows[0];
  return row ? withDecodedTextFields(row) : null;
}

export async function getPostById(id: string): Promise<BlogPost | null> {
  if (!hasDb() || !sql) return null;
  const rows = (await sql`
    SELECT
      p.id, p.slug, p.title, p.excerpt, p.body, p.category_id AS "categoryId",
      c.label AS "categoryLabel",
      p.featured_image_url AS "featuredImageUrl",
      p.author_contact_id AS "authorContactId",
      p.author_display_name AS "authorDisplayName",
      p.published_at AS "publishedAt",
      COALESCE(p.tags, ARRAY[]::TEXT[]) AS tags,
      p.created_at AS "createdAt",
      p.updated_at AS "updatedAt"
    FROM blog_posts p
    JOIN blog_categories c ON c.id = p.category_id
    WHERE p.id = ${id}
    LIMIT 1
  `) as BlogPost[];
  const row = rows[0];
  return row ? withDecodedTextFields(row) : null;
}

export async function getSimilarPosts(
  postId: string,
  categoryId: string,
  limit = 4
): Promise<BlogPost[]> {
  if (!hasDb() || !sql) return [];
  const rows = await sql`
    SELECT
      p.id, p.slug, p.title, p.excerpt, p.body, p.category_id AS "categoryId",
      c.label AS "categoryLabel",
      p.featured_image_url AS "featuredImageUrl",
      p.author_contact_id AS "authorContactId",
      p.author_display_name AS "authorDisplayName",
      p.published_at AS "publishedAt",
      COALESCE(p.tags, ARRAY[]::TEXT[]) AS tags,
      p.created_at AS "createdAt",
      p.updated_at AS "updatedAt"
    FROM blog_posts p
    JOIN blog_categories c ON c.id = p.category_id
    WHERE p.category_id = ${categoryId}
      AND p.id != ${postId}
      AND p.published_at IS NOT NULL
    ORDER BY p.published_at DESC
    LIMIT ${limit}
  `;
  return (rows as BlogPost[]).map(withDecodedTextFields);
}

export type CreatePostInput = {
  slug: string;
  title: string;
  excerpt?: string | null;
  body: string;
  categoryId: string;
  featuredImageUrl?: string | null;
  authorContactId?: string | null;
  authorDisplayName?: string | null;
  publishedAt?: string | null;
  tags?: string[];
};

export async function createPost(input: CreatePostInput): Promise<BlogPost | null> {
  if (!hasDb() || !sql) return null;
  const now = new Date().toISOString();
  const tags = Array.isArray(input.tags) ? input.tags.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim()) : [];
  const rows = (await sql`
    INSERT INTO blog_posts (
      slug, title, excerpt, body, category_id,
      featured_image_url, author_contact_id, author_display_name,
      published_at, tags, created_at, updated_at
    )
    VALUES (
      ${input.slug}, ${input.title}, ${input.excerpt ?? null}, ${input.body}, ${input.categoryId},
      ${input.featuredImageUrl ?? null}, ${input.authorContactId ?? null}, ${input.authorDisplayName ?? null},
      ${input.publishedAt ?? null}, ${tags}, ${now}::timestamptz, ${now}::timestamptz
    )
    RETURNING id
  `) as { id: string }[];
  const row = rows[0];
  if (!row) return null;
  return getPostById(row.id);
}

export type UpdatePostInput = Partial<{
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  categoryId: string;
  featuredImageUrl: string | null;
  authorContactId: string | null;
  authorDisplayName: string | null;
  publishedAt: string | null;
  tags: string[];
}>;

export async function updatePost(id: string, input: UpdatePostInput): Promise<BlogPost | null> {
  if (!hasDb() || !sql) return null;
  const now = new Date().toISOString();
  const current = await getPostById(id);
  if (!current) return null;

  const slug = input.slug ?? current.slug;
  const title = input.title ?? current.title;
  const excerpt = input.excerpt !== undefined ? input.excerpt : current.excerpt;
  const body = input.body ?? current.body;
  const categoryId = input.categoryId ?? current.categoryId;
  const featuredImageUrl =
    input.featuredImageUrl !== undefined ? input.featuredImageUrl : current.featuredImageUrl;
  const authorContactId =
    input.authorContactId !== undefined ? input.authorContactId : current.authorContactId;
  const authorDisplayName =
    input.authorDisplayName !== undefined ? input.authorDisplayName : current.authorDisplayName;
  const publishedAt = input.publishedAt !== undefined ? input.publishedAt : current.publishedAt;
  const tags = input.tags !== undefined
    ? (Array.isArray(input.tags) ? input.tags.filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim()) : [])
    : (current.tags ?? []);

  await sql`
    UPDATE blog_posts SET
      updated_at = ${now}::timestamptz,
      slug = ${slug},
      title = ${title},
      excerpt = ${excerpt},
      body = ${body},
      category_id = ${categoryId},
      featured_image_url = ${featuredImageUrl},
      author_contact_id = ${authorContactId},
      author_display_name = ${authorDisplayName},
      published_at = ${publishedAt},
      tags = ${tags}
    WHERE id = ${id}::uuid
  `;
  return getPostById(id);
}

export async function deletePost(id: string): Promise<boolean> {
  if (!hasDb() || !sql) return false;
  await sql`DELETE FROM blog_posts WHERE id = ${id}::uuid`;
  return true;
}
