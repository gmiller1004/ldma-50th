import Image from "next/image";
import { ShareButton } from "./ShareButton";
import { SimilarPosts } from "./SimilarPosts";
import { FeaturedLinks } from "./FeaturedLinks";
import type { BlogPost } from "@/lib/blog";

/** Strip tags that can change document-wide behavior (e.g. <base href> breaks nav and relative images). */
function sanitizePostBody(html: string): string {
  if (!html || typeof html !== "string") return "";
  return html
    .replace(/<base\s[^>]*>/gi, "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "");
}

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

export function BlogPostContent({
  post,
  similarPosts,
  baseUrl,
}: {
  post: BlogPost;
  similarPosts: BlogPost[];
  baseUrl: string;
}) {
  const dateStr = formatDate(post.publishedAt ?? post.updatedAt);
  const postUrl = `${baseUrl}/blog/${post.slug}`;

  return (
    <div className="max-w-4xl mx-auto">
      <article>
        {post.featuredImageUrl && (
          <div className="relative aspect-[16/9] rounded-xl overflow-hidden mb-8 bg-[#0f3d1e]/40">
            <Image
              src={post.featuredImageUrl}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 896px"
              priority
            />
          </div>
        )}

        {post.categoryLabel && (
          <span className="inline-block text-sm font-medium text-[#d4af37] mb-2">
            {post.categoryLabel}
          </span>
        )}

        <h1 className="font-serif text-3xl md:text-4xl font-bold text-[#f0d48f] mb-4">
          {post.title}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-sm text-[#e8e0d5]/70 mb-6">
          {dateStr && (
            <time dateTime={post.publishedAt ?? post.updatedAt}>{dateStr}</time>
          )}
          {post.authorDisplayName && (
            <span>By {post.authorDisplayName}</span>
          )}
        </div>

        {post.excerpt && (
          <p className="text-lg text-[#e8e0d5]/90 mb-6 leading-relaxed">
            {post.excerpt}
          </p>
        )}

        <div
          className="prose prose-invert prose-lg max-w-none text-[#e8e0d5]/90 prose-headings:text-[#f0d48f] prose-a:text-[#d4af37] prose-strong:text-[#e8e0d5]"
          dangerouslySetInnerHTML={{ __html: sanitizePostBody(post.body) }}
        />

        <div className="mt-8 pt-6 border-t border-[#d4af37]/20">
          <ShareButton
            url={postUrl}
            title={post.title}
            text={post.excerpt ?? undefined}
          />
        </div>
      </article>

      {similarPosts.length > 0 && (
        <SimilarPosts posts={similarPosts} />
      )}

      <aside className="mt-12">
        <FeaturedLinks />
      </aside>
    </div>
  );
}
