import Link from "next/link";
import Image from "next/image";
import { ShareButton } from "./ShareButton";
import { SimilarPosts } from "./SimilarPosts";
import { FeaturedLinks } from "./FeaturedLinks";
import { BlogCommentsSection } from "./BlogCommentsSection";
import type { BlogPost } from "@/lib/blog";
import { slugifyTag } from "@/lib/blog";
import type { BlogComment } from "@/lib/blog-comments";

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
  initialComments,
  baseUrl,
}: {
  post: BlogPost;
  similarPosts: BlogPost[];
  initialComments: BlogComment[];
  baseUrl: string;
}) {
  const dateStr = formatDate(post.publishedAt ?? post.updatedAt);
  const postUrl = `${baseUrl}/blog/${post.slug}`;

  const tagList = post.tags?.length ? post.tags : [];

  return (
    <div className="max-w-6xl mx-auto space-y-10 md:space-y-12">
      {/* 1. Full-width: tags, photo, category, title, date, author, excerpt */}
      <header className="w-full">
        {tagList.length > 0 && (
          <ul className="flex flex-wrap gap-2 mb-4" aria-label="Tags">
            {tagList.map((tag) => (
              <li key={tag}>
                <Link
                  href={`/blog/tag/${slugifyTag(tag)}`}
                  className="inline-block px-3 py-1 rounded-full text-sm bg-[#d4af37]/20 text-[#d4af37] hover:bg-[#d4af37]/30 transition-colors"
                >
                  {tag}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {post.featuredImageUrl && (
          <div className="relative aspect-[16/9] rounded-xl overflow-hidden mb-8 bg-[#0f3d1e]/40">
            <Image
              src={post.featuredImageUrl}
              alt=""
              fill
              className="object-cover"
              sizes="100vw"
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
          <p className="text-lg text-[#e8e0d5]/90 mb-0 leading-relaxed max-w-3xl">
            {post.excerpt}
          </p>
        )}
      </header>

      {/* 2. Two columns: body + share (left), sidebar (right) */}
      <div className="flex flex-col md:flex-row gap-8 md:gap-12">
        <div className="min-w-0 flex-1">
          <article>
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
        </div>
        <aside className="w-full md:w-80 md:shrink-0 border-t border-[#d4af37]/20 pt-8 md:border-0 md:pt-0 space-y-10 md:space-y-12">
          {similarPosts.length > 0 && (
            <SimilarPosts posts={similarPosts} sidebar />
          )}
          <FeaturedLinks />
        </aside>
      </div>

      {/* 3. Full-width: comments */}
      <div className="w-full border-t border-[#d4af37]/20 pt-8">
        <BlogCommentsSection post={{ id: post.id, slug: post.slug }} initialComments={initialComments} />
      </div>
    </div>
  );
}
