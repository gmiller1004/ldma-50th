import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://ldma-50th.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/members/", "/api/", "/admin/"],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
