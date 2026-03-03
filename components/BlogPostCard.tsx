import Link from "next/link";
import Image from "next/image";
import type { BlogPost } from "@/lib/blog";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export function BlogPostCard({ post }: { post: BlogPost }) {
  const dateStr = formatDate(post.publishedAt ?? post.updatedAt);

  return (
    <article className="group rounded-xl overflow-hidden border border-[#d4af37]/20 hover:border-[#d4af37]/40 transition-colors bg-[#1a120b]">
      <Link href={`/blog/${post.slug}`} className="block">
        <div className="relative aspect-[16/10] bg-[#0f3d1e]/40">
          {post.featuredImageUrl ? (
            <Image
              src={post.featuredImageUrl}
              alt=""
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[#d4af37]/20">
              <span className="text-4xl">🪙</span>
            </div>
          )}
        </div>
        <div className="p-5">
          {post.categoryLabel && (
            <span className="inline-block text-xs font-medium text-[#d4af37] mb-2">
              {post.categoryLabel}
            </span>
          )}
          <h2 className="font-serif text-xl font-semibold text-[#f0d48f] group-hover:text-[#d4af37] transition-colors line-clamp-2 mb-2">
            {post.title}
          </h2>
          {post.excerpt && (
            <p className="text-[#e8e0d5]/80 text-sm line-clamp-2 mb-3">
              {post.excerpt}
            </p>
          )}
          {dateStr && (
            <time className="text-xs text-[#e8e0d5]/50" dateTime={post.publishedAt ?? post.updatedAt}>
              {dateStr}
            </time>
          )}
        </div>
      </Link>
    </article>
  );
}
