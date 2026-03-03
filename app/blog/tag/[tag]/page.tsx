import type { Metadata } from "next";
import Link from "next/link";
import { getPosts, getCategories } from "@/lib/blog";
import { BlogPostCard } from "@/components/BlogPostCard";
import { BlogCategoryFilter } from "@/components/BlogCategoryFilter";

type Props = {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ category?: string }>;
};

function tagSlugToLabel(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  const label = tagSlugToLabel(tag);
  return {
    title: `Posts tagged "${label}" | Blog | LDMA 50th Anniversary`,
    description: `Blog posts tagged with ${label} from the Lost Dutchman's Mining Association.`,
  };
}

export default async function BlogTagPage({ params, searchParams }: Props) {
  const { tag } = await params;
  const { category } = await searchParams;
  const tagSlug = decodeURIComponent(tag);

  const [posts, categories] = await Promise.all([
    getPosts({
      tagSlug,
      categoryId: category,
      publishedOnly: true,
      limit: 48,
    }),
    getCategories(),
  ]);

  const label = tagSlugToLabel(tagSlug);

  return (
    <div className="py-8">
      <h1 className="font-serif text-3xl md:text-4xl font-bold text-[#f0d48f] mb-2">
        Posts tagged &ldquo;{label}&rdquo;
      </h1>
      <p className="text-[#e8e0d5]/80 mb-8 max-w-2xl">
        <Link href="/blog" className="text-[#d4af37] hover:underline">
          ← All blog posts
        </Link>
      </p>

      <BlogCategoryFilter
        categories={categories}
        currentCategory={category}
        basePath={`/blog/tag/${encodeURIComponent(tagSlug)}`}
      />

      {posts.length === 0 ? (
        <p className="text-[#e8e0d5]/60 py-12">
          No posts with this tag yet. <Link href="/blog" className="text-[#d4af37] hover:underline">Browse all posts</Link>.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
          {posts.map((post) => (
            <BlogPostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
