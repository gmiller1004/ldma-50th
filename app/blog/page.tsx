import type { Metadata } from "next";
import Link from "next/link";
import { getPosts, getCategories } from "@/lib/blog";
import { BlogPostCard } from "@/components/BlogPostCard";
import { BlogCategoryFilter } from "@/components/BlogCategoryFilter";

export const metadata: Metadata = {
  title: "Blog | LDMA 50th Anniversary",
  description:
    "Camp life, events, mining gear, LDMA history, prospecting tips, and member stories from the Lost Dutchman's Mining Association.",
};

type Props = {
  searchParams: Promise<{ category?: string }>;
};

export default async function BlogIndexPage({ searchParams }: Props) {
  const { category } = await searchParams;
  const [posts, categories] = await Promise.all([
    getPosts({ categoryId: category, publishedOnly: true, limit: 24 }),
    getCategories(),
  ]);

  return (
    <div className="py-8">
      <h1 className="font-serif text-3xl md:text-4xl font-bold text-[#f0d48f] mb-2">
        Blog
      </h1>
      <p className="text-[#e8e0d5]/80 mb-8 max-w-2xl">
        Camp life, events, prospecting tips, and stories from the LDMA community.
      </p>

      <BlogCategoryFilter categories={categories} currentCategory={category} />

      {posts.length === 0 ? (
        <p className="text-[#e8e0d5]/60 py-12">No posts yet. Check back soon.</p>
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
