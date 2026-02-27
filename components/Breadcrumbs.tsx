"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  /** Base URL for JSON-LD (e.g. https://ldma50.com). Falls back to empty for relative URLs. */
  baseUrl?: string;
};

export function Breadcrumbs({ items, baseUrl = "" }: BreadcrumbsProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href && baseUrl
        ? { item: `${baseUrl}${item.href}` }
        : {}),
    })),
  };

  return (
    <nav aria-label="Breadcrumb" className="py-4 overflow-visible">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-[#e8e0d5]/70">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && (
              <ChevronRight
                className="w-4 h-4 text-[#d4af37]/50 flex-shrink-0"
                aria-hidden
              />
            )}
            {item.href ? (
              <Link
                href={item.href}
                className="hover:text-[#d4af37] transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-[#e8e0d5] font-medium" aria-current="page">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
