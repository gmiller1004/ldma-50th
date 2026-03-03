#!/usr/bin/env node
/**
 * Fetch myldma.com blog sitemap, parse article URLs, and insert into our blog_posts table.
 * Creates posts with title, slug, featured image, published_at, and a placeholder body linking to the original.
 *
 * Usage: node --env-file=.env.local scripts/seed-blog-from-myldma-sitemap.mjs
 *
 * Requires: POSTGRES_URL or DATABASE_URL
 * Requires: Blog schema already run (npm run db:blog:init)
 */
import { fileURLToPath } from "url";
import { dirname } from "path";
import pg from "pg";
const { Client } = pg;

const SITEMAP_URL = "https://myldma.com/sitemap_blogs_1.xml";

/** Map old myldma blog handle to our blog_categories.id */
const CATEGORY_MAP = {
  "explore-ldma": "camp-life",
  "news": "events",
  "stanton-411": "camp-life",
  "dirt-fest-event-schedules": "events",
  "dirt-fest-event-schedules-1": "events",
  "oconee-sc-events": "events",
};

function parseSitemapXml(xml) {
  const entries = [];
  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/gi) || [];
  for (const block of urlBlocks) {
    const loc = block.match(/<loc>([^<]+)<\/loc>/i)?.[1]?.trim();
    const lastmod = block.match(/<lastmod>([^<]+)<\/lastmod>/i)?.[1]?.trim();
    const imageLoc = block.match(/<image:loc>([^<]+)<\/image:loc>/i)?.[1]?.trim();
    const imageTitle = block.match(/<image:title>([^<]*)<\/image:title>/i)?.[1]?.trim();
    if (loc) entries.push({ loc, lastmod, imageLoc, imageTitle });
  }
  return entries;
}

/** Only article pages: /blogs/category/article-slug (3 path segments after blogs) */
function isArticleUrl(loc) {
  try {
    const path = new URL(loc).pathname;
    const parts = path.split("/").filter(Boolean);
    return parts[0] === "blogs" && parts.length === 3;
  } catch {
    return false;
  }
}

/** Get slug from URL path (last segment). Decode and sanitize for our slug. */
function slugFromLoc(loc) {
  try {
    const path = new URL(loc).pathname;
    const segments = path.split("/").filter(Boolean);
    const last = segments[segments.length - 1] || "post";
    const decoded = decodeURIComponent(last);
    return decoded
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "post";
  } catch {
    return "post";
  }
}

/** Get blog handle (category) from URL path: /blogs/handle/slug -> handle */
function handleFromLoc(loc) {
  try {
    const path = new URL(loc).pathname;
    const segments = path.split("/").filter(Boolean);
    return segments[1] || "news";
  } catch {
    return "news";
  }
}

function parseLastmod(lastmod) {
  if (!lastmod) return null;
  try {
    const d = new Date(lastmod);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

/** Clean image URL (fix escaped underscores if any) */
function cleanImageUrl(url) {
  if (!url || typeof url !== "string") return null;
  return url.replace(/\\_/g, "_").trim() || null;
}

/** Decode HTML/XML entities in text from sitemap (e.g. &apos; → ') */
function decodeHtmlEntities(str) {
  if (str == null || typeof str !== "string") return "";
  return str
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

const PLACEHOLDER_BODY = `<p>This article was migrated from the LDMA blog at myldma.com. Content can be updated in the blog admin.</p>
<p><a href="https://myldma.com/blogs">Visit the original blog</a> for the full archive.</p>`;

async function main() {
  // Prefer new Neon (STORAGE_*); fall back to old free Neon
  const connectionString =
    process.env.STORAGE_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Error: STORAGE_DATABASE_URL, POSTGRES_URL, or DATABASE_URL not set.");
    process.exit(1);
  }

  console.log("Fetching sitemap from", SITEMAP_URL);
  const res = await fetch(SITEMAP_URL);
  if (!res.ok) {
    console.error("Failed to fetch sitemap:", res.status);
    process.exit(1);
  }
  const xml = await res.text();
  const entries = parseSitemapXml(xml);
  const articles = entries.filter((e) => isArticleUrl(e.loc));
  console.log("Found", articles.length, "article URLs (excluding blog index pages).");

  const client = new Client({ connectionString });
  await client.connect();

  let inserted = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const a of articles) {
    const slug = slugFromLoc(a.loc);
    const handle = handleFromLoc(a.loc);
    const categoryId = CATEGORY_MAP[handle] || "camp-life";
    const rawTitle = (a.imageTitle && a.imageTitle.trim()) || slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const title = decodeHtmlEntities(rawTitle);
    const featuredImageUrl = cleanImageUrl(a.imageLoc);
    const publishedAt = parseLastmod(a.lastmod);

    try {
      const result = await client.query(
        `INSERT INTO blog_posts (
          slug, title, excerpt, body, category_id,
          featured_image_url, author_contact_id, author_display_name,
          published_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL, $7, $8, $8)
        ON CONFLICT (slug) DO NOTHING`,
        [slug, title, null, PLACEHOLDER_BODY, categoryId, featuredImageUrl, publishedAt, now]
      );
      if (result.rowCount > 0) {
        inserted++;
        console.log("  +", slug);
      } else {
        skipped++;
      }
    } catch (e) {
      console.error("  ✗", slug, e.message);
    }
  }

  await client.end();
  console.log("\nDone. Inserted:", inserted, "Skipped (duplicate slug):", skipped);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
