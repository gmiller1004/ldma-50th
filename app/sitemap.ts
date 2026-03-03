import type { MetadataRoute } from "next";
import { getAllCollectionHandles, getAllProductHandles } from "@/lib/shopify";
import {
  isCampgroundCollection,
  isMembersOnlyCollection,
} from "@/lib/collections-config";
import { getValidCampSlugs } from "@/lib/directory-camps";
import { getPosts } from "@/lib/blog";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://ldma-50th.vercel.app";

const STATIC_PATHS = [
  "",
  "/about",
  "/blog",
  "/campgrounds",
  "/contact",
  "/events",
  "/memberships",
  "/shop",
  "/faq",
  "/privacy",
  "/membership-terms",
  "/careers",
  "/maintenance",
  "/50-years",
  "/directory",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  const now = new Date().toISOString();

  for (const path of STATIC_PATHS) {
    entries.push({
      url: `${BASE}${path || "/"}`,
      lastModified: now,
      changeFrequency: path === "" || path === "/events" ? "weekly" : "monthly",
      priority: path === "" ? 1 : 0.8,
    });
  }

  for (const slug of getValidCampSlugs()) {
    entries.push({
      url: `${BASE}/campgrounds/${slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    });
  }

  try {
    const [collectionHandles, productHandles] = await Promise.all([
      getAllCollectionHandles(),
      getAllProductHandles(),
    ]);

    const publicCollectionHandles = collectionHandles.filter(
      (h) => !isCampgroundCollection(h) && !isMembersOnlyCollection(h)
    );

    for (const handle of publicCollectionHandles) {
      entries.push({
        url: `${BASE}/collections/${handle}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      });
    }

    for (const handle of productHandles) {
      entries.push({
        url: `${BASE}/products/${handle}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      });
    }

    const blogPosts = await getPosts({ publishedOnly: true, limit: 500 });
    for (const post of blogPosts) {
      entries.push({
        url: `${BASE}/blog/${post.slug}`,
        lastModified: post.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.5,
      });
    }
  } catch {
    // Shopify/env may be missing at build; static + campgrounds still included
  }

  return entries;
}
