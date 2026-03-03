"use client";

import Link from "next/link";
import type { BlogCategory } from "@/lib/blog";

export function BlogCategoryFilter({
  categories,
  currentCategory,
  basePath = "/blog",
}: {
  categories: BlogCategory[];
  currentCategory?: string;
  /** Base path for links (e.g. /blog or /blog/tag/my-tag) */
  basePath?: string;
}) {
  const allHref = basePath === "/blog" ? "/blog" : basePath;
  const categoryHref = (catId: string) =>
    basePath === "/blog" ? `/blog?category=${encodeURIComponent(catId)}` : `${basePath}?category=${encodeURIComponent(catId)}`;

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={allHref}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
          !currentCategory
            ? "bg-[#d4af37] text-[#1a120b]"
            : "bg-[#0f3d1e]/50 text-[#e8e0d5]/80 hover:bg-[#d4af37]/20 hover:text-[#d4af37]"
        }`}
      >
        All
      </Link>
      {categories.map((cat) => (
        <Link
          key={cat.id}
          href={categoryHref(cat.id)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            currentCategory === cat.id
              ? "bg-[#d4af37] text-[#1a120b]"
              : "bg-[#0f3d1e]/50 text-[#e8e0d5]/80 hover:bg-[#d4af37]/20 hover:text-[#d4af37]"
          }`}
        >
          {cat.label}
        </Link>
      ))}
    </div>
  );
}
