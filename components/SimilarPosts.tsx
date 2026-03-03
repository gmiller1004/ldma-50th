import { BlogPostCard } from "./BlogPostCard";
import type { BlogPost } from "@/lib/blog";

export function SimilarPosts({
  posts,
  sidebar,
}: {
  posts: BlogPost[];
  /** When true, use single column (e.g. in desktop sidebar) */
  sidebar?: boolean;
}) {
  if (posts.length === 0) return null;

  return (
    <section
      className={sidebar ? "pt-0" : "mt-12 pt-8 border-t border-[#d4af37]/20"}
      aria-labelledby="similar-posts-heading"
    >
      <h2 id="similar-posts-heading" className="font-serif text-xl font-semibold text-[#f0d48f] mb-4">
        You might also like
      </h2>
      <div
        className={
          sidebar
            ? "grid grid-cols-1 gap-4"
            : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        }
      >
        {posts.map((post) => (
          <BlogPostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
